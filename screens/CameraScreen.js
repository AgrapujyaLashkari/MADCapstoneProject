// screens/CameraScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Alert } from 'react-native';
import { Button, TextInput, Text, Portal, Modal, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabase';
import { decode } from 'base64-arraybuffer';

export default function CameraScreen({ navigation }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [media, setMedia] = useState(null);
  const [mediaType, setMediaType] = useState('photo'); // 'photo' or 'video'
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState('photo'); // 'photo' or 'video'
  const cameraRef = useRef(null);
  
  // Create video player when media is a video
  const videoPlayer = media && mediaType === 'video' ? useVideoPlayer(media.uri, player => {
    player.loop = true;
    player.play();
  }) : null;

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
        });
        setMedia(photo);
        setMediaType('photo');
        setModalVisible(true);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const startRecording = async () => {
    // Check microphone permission before recording
    if (!microphonePermission?.granted) {
      const result = await requestMicrophonePermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Microphone permission is required to record videos');
        return;
      }
    }

    if (cameraRef.current && !isRecording) {
      try {
        setIsRecording(true);
        const video = await cameraRef.current.recordAsync({
          maxDuration: 60, // 60 seconds max
        });
        setMedia(video);
        setMediaType('video');
        setModalVisible(true);
      } catch (error) {
        console.error('Error recording video:', error);
        Alert.alert('Error', 'Failed to record video: ' + error.message);
      } finally {
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === 'photo' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      videoMaxDuration: 60,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setMedia(asset);
      setMediaType(asset.type === 'video' ? 'video' : 'photo');
      setModalVisible(true);
    }
  };

  const uploadPost = async () => {
    if (!media || !caption.trim()) {
      Alert.alert('Error', 'Please add a caption');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let fileUrl;
      
      if (mediaType === 'photo') {
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(media.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Upload image to Supabase Storage
        const fileName = `${user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, decode(base64), {
            contentType: 'image/jpeg',
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);
        
        fileUrl = publicUrl;
      } else {
        // Upload video
        const fileUri = media.uri;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        if (!fileInfo.exists) {
          throw new Error('Video file does not exist');
        }

        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const fileName = `${user.id}/${Date.now()}.mp4`;
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, decode(base64), {
            contentType: 'video/mp4',
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);
        
        fileUrl = publicUrl;
      }

      // Save post to database
      const postData = {
        user_id: user.id,
        caption: caption,
        media_type: mediaType,
      };

      if (mediaType === 'photo') {
        postData.image_url = fileUrl;
      } else {
        postData.video_url = fileUrl;
      }

      const { error: dbError } = await supabase
        .from('posts')
        .insert([postData]);

      if (dbError) throw dbError;

      Alert.alert('Success', 'Post uploaded successfully!');
      setMedia(null);
      setCaption('');
      setModalVisible(false);
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error uploading:', error);
      Alert.alert('Error', 'Failed to upload post: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (!cameraPermission || !microphonePermission) {
    return <View style={styles.container}><Text>Requesting permissions...</Text></View>;
  }
  if (!cameraPermission.granted || !microphonePermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 10, padding: 20 }}>
          We need camera and microphone permissions for taking photos and recording videos
        </Text>
        <Button mode="contained" onPress={() => {
          requestCameraPermission();
          requestMicrophonePermission();
        }} style={{ marginHorizontal: 20 }}>
          Grant Permissions
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        ref={cameraRef} 
        facing="back"
        mode={mode}
      >
        <View style={styles.topControls}>
          <SegmentedButtons
            value={mode}
            onValueChange={setMode}
            buttons={[
              { value: 'photo', label: 'Photo', icon: 'camera' },
              { value: 'video', label: 'Video', icon: 'video' },
            ]}
            style={styles.segmentedButtons}
          />
        </View>
        
        <View style={styles.buttonContainer}>
          {mode === 'photo' ? (
            <Button 
              mode="contained" 
              onPress={takePicture}
              style={styles.captureButton}
              icon="camera"
            >
              Take Photo
            </Button>
          ) : (
            <Button 
              mode="contained" 
              onPress={isRecording ? stopRecording : startRecording}
              style={[styles.captureButton, isRecording && styles.recordingButton]}
              icon={isRecording ? 'stop' : 'video'}
            >
              {isRecording ? 'Stop Recording' : 'Record Video'}
            </Button>
          )}
          <Button 
            mode="contained" 
            onPress={pickMedia}
            style={styles.galleryButton}
            icon="image"
          >
            Gallery
          </Button>
        </View>
      </CameraView>

      <Portal>
        <Modal 
          visible={modalVisible} 
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          {media && (
            <>
              {mediaType === 'photo' ? (
                <Image source={{ uri: media.uri }} style={styles.preview} />
              ) : (
                videoPlayer && (
                  <VideoView
                    player={videoPlayer}
                    style={styles.preview}
                    allowsFullscreen
                    allowsPictureInPicture
                  />
                )
              )}
              <TextInput
                label="Caption"
                value={caption}
                onChangeText={setCaption}
                mode="outlined"
                style={styles.input}
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalButtons}>
                <Button 
                  mode="contained" 
                  onPress={uploadPost}
                  disabled={uploading}
                  style={styles.uploadButton}
                >
                  {uploading ? <ActivityIndicator color="white" /> : 'Post'}
                </Button>
                <Button 
                  mode="outlined" 
                  onPress={() => {
                    setModalVisible(false);
                    setMedia(null);
                    setCaption('');
                  }}
                  disabled={uploading}
                >
                  Cancel
                </Button>
              </View>
            </>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  topControls: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  segmentedButtons: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  buttonContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 40,
  },
  captureButton: {
    marginHorizontal: 10,
  },
  recordingButton: {
    backgroundColor: '#e91e63',
  },
  galleryButton: {
    marginHorizontal: 10,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    maxHeight: '80%',
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    marginBottom: 15,
  },
  input: {
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  uploadButton: {
    flex: 1,
  },
});