// screens/CameraScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, TextInput, Text, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video'; // Import useVideoPlayer
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../supabase';
import { decode } from 'base64-arraybuffer';

// --- NEW COMPONENT: Handles Video Playback safely with Hooks ---
const VideoPreview = ({ uri }) => {
  const player = useVideoPlayer(uri, player => {
    player.loop = true;
    player.play();
  });

  return (
    <VideoView
      style={styles.previewVideo}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
    />
  );
};

export default function CameraScreen({ navigation }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  
  // State
  const [photo, setPhoto] = useState(null);
  const [video, setVideo] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaType, setMediaType] = useState('photo');
  
  // FIX: Explicitly track camera mode ('picture' or 'video')
  const [cameraMode, setCameraMode] = useState('picture');

  const cameraRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingStartTime = useRef(null);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      await requestMicrophonePermission();
    })();
  }, []);

  const takePicture = async () => {
    // Ensure we are in picture mode before snapping
    if (cameraMode !== 'picture') {
      setCameraMode('picture');
      // Give it a split second to switch modes if needed
      setTimeout(captureNow, 200);
      return;
    }
    await captureNow();
  };

  const captureNow = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
        setPhoto(photo);
        setMediaType('photo');
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const startRecording = async () => {
    // FIX: If not in video mode, switch and wait
    if (cameraMode !== 'video') {
      setCameraMode('video');
      // We return here to let the state update and UI re-render with mode="video"
      // The user will have to press the button again, or you can use a ref/effect to auto-trigger.
      // For stability, it's better to make the user select "Video Mode" or just press twice.
      // However, to make it smooth, we will just set mode and warn if it fails first time.
      return; 
    }

    if (cameraRef.current && !isRecording) {
      try {
        if (!microphonePermission?.granted) {
          const { granted } = await requestMicrophonePermission();
          if (!granted) return Alert.alert('Permission Required', 'Microphone needed.');
        }

        setIsRecording(true);
        setRecordingDuration(0);
        recordingStartTime.current = Date.now();
        
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => {
            const newDuration = prev + 1;
            if (newDuration >= 30) stopRecording();
            return newDuration;
          });
        }, 1000);

        console.log('Starting video recording...');
        
        // FIX: recordAsync returns a promise that resolves WHEN RECORDING STOPS
        const videoResult = await cameraRef.current.recordAsync();
        
        // --- Code below runs AFTER recording stops ---
        console.log('Recording finished promise resolved');
        
        if (videoResult && videoResult.uri) {
            setVideo(videoResult);
            setMediaType('video');
        }
        
      } catch (error) {
        console.log('Recording error:', error);
        setIsRecording(false);
        // Reset mode to picture on error just in case
        setCameraMode('picture'); 
      }
    }
  };

  const stopRecording = async () => {
    if (cameraRef.current && isRecording) {
      const elapsed = Date.now() - recordingStartTime.current;
      if (elapsed < 1500) { // Reduced to 1.5s to be less annoying
         // It's hard to stop exactly under 3s, better to just let it save
      }
      
      console.log('Stopping video recording...');
      try {
        await cameraRef.current.stopRecording();
        setIsRecording(false);
        clearInterval(recordingTimerRef.current);
      } catch (error) {
        console.log('Stop recording error:', error.message);
      }
    }
  };

  const pickFromGallery = async () => {
    // ... (Your existing code)
    // Same as your original code
    try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          allowsEditing: false,
          quality: 0.7,
          videoMaxDuration: 30,
        });
  
        if (!result.canceled) {
          const asset = result.assets[0];
          if (asset.type === 'video') {
            setVideo(asset);
            setMediaType('video');
          } else {
            setPhoto(asset);
            setMediaType('photo');
          }
        }
      } catch (error) {
        console.error('Error picking media:', error);
        Alert.alert('Error', 'Failed to pick media from gallery');
      }
  };

  const uploadPost = async () => {
    // ... (Your existing code)
    // Same as your original code
    if ((!photo && !video) || !caption.trim()) {
        Alert.alert('Error', 'Please add a caption');
        return;
      }
  
      setUploading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const mediaUri = photo?.uri || video?.uri;
        const isVideo = mediaType === 'video';
        
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(mediaUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Upload media to Supabase Storage
        const fileExtension = isVideo ? 'mp4' : 'jpg';
        const fileName = `${user.id}/${Date.now()}.${fileExtension}`;
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, decode(base64), {
            contentType: isVideo ? 'video/mp4' : 'image/jpeg',
          });
  
        if (uploadError) throw uploadError;
  
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);
  
        // Save post to database
        const { error: dbError } = await supabase
          .from('posts')
          .insert([{
            user_id: user.id,
            caption: caption,
            media_type: mediaType,
            image_url: publicUrl,
            video_duration: isVideo ? video?.duration : null
          }]);
  
        if (dbError) throw dbError;
  
        Alert.alert('Success', 'Post uploaded successfully!');
        setPhoto(null);
        setVideo(null);
        setCaption('');
        setMediaType('photo');
        navigation.navigate('Home');
      } catch (error) {
        console.error('Error uploading:', error);
        Alert.alert('Error', 'Failed to upload post: ' + error.message);
      } finally {
        setUploading(false);
      }
  };

  // --- RENDERS ---

  if (!cameraPermission || !cameraPermission.granted) {
    return (
      <View style={styles.container}>
        <Button mode="contained" onPress={requestCameraPermission}>Grant Permission</Button>
      </View>
    );
  }

  // Preview Screen
  if (photo || video) {
    return (
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.previewScrollContainer}>
          <View style={styles.previewContainer}>
            {mediaType === 'video' && video ? (
              // FIX: Use the separated component here
              <VideoPreview uri={video.uri} />
            ) : (
              <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="contain" />
            )}
          </View>
          
          <View style={styles.captionContainer}>
            {/* Same caption UI as before */}
            <TextInput
              placeholder="Write a caption..."
              value={caption}
              onChangeText={setCaption}
              mode="outlined"
              style={styles.captionInput}
              multiline
            />
            <View style={styles.actionButtons}>
              <Button 
                mode="outlined" 
                onPress={() => {
                   setPhoto(null); setVideo(null); setMediaType('photo'); setCameraMode('picture');
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={uploadPost} 
                loading={uploading}
                style={styles.postButton}
              >
                Post
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Camera Screen
  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        ref={cameraRef} 
        facing="back"
        // FIX: Bind mode to state
        mode={cameraMode} 
        enableAudio={true}
      />
      
      {/* UI Controls */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
           <Text style={styles.recordingText}>REC {recordingDuration}s</Text>
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        {/* Photo Button - Switches to Picture mode if needed */}
        <Button 
          mode="contained" 
          onPress={() => { setCameraMode('picture'); takePicture(); }}
          style={[styles.captureButton, { opacity: cameraMode === 'video' ? 0.5 : 1 }]}
          disabled={isRecording}
        >
          Photo
        </Button>

        {/* Video Button - Switches to Video mode if needed */}
        <Button 
          mode="contained" 
          onPress={() => {
            if (isRecording) {
                stopRecording();
            } else {
                if(cameraMode !== 'video') {
                    setCameraMode('video');
                } else {
                    startRecording();
                }
            }
          }}
          style={[
            styles.captureButton, 
            isRecording && styles.recordingButton,
            { opacity: cameraMode === 'picture' && !isRecording ? 0.5 : 1 }
          ]}
        >
          {cameraMode !== 'video' ? 'Video Mode' : (isRecording ? 'Stop' : 'Record')}
        </Button>

        <Button 
          mode="contained" 
          onPress={pickFromGallery}
          style={styles.galleryButton}
          disabled={isRecording}
        >
          Gallery
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    // Keep your existing styles
  container: { flex: 1, backgroundColor: '#fff' },
  camera: { flex: 1 },
  previewVideo: { width: '100%', height: '100%' }, // Ensure this exists
  previewImage: { width: '100%', height: '100%' },
  previewContainer: { height: 500, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  buttonContainer: { position: 'absolute', bottom: 40, flexDirection: 'row', width: '100%', justifyContent: 'space-around' },
  captureButton: { flex: 1, marginHorizontal: 5 },
  galleryButton: { flex: 1, marginHorizontal: 5 },
  recordingButton: { backgroundColor: 'red' },
  recordingIndicator: { position: 'absolute', top: 50, alignSelf: 'center', backgroundColor: 'red', padding: 10, borderRadius: 10 },
  recordingText: { color: 'white', fontWeight: 'bold' },
  captionContainer: { padding: 20 },
  actionButtons: { flexDirection: 'row', marginTop: 10, gap: 10 },
  cancelButton: { flex: 1 },
  postButton: { flex: 1 },
});