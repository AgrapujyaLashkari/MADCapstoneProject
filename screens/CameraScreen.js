// screens/CameraScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Image, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Dimensions,
  Keyboard
} from 'react-native';
import { Button, TextInput, Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';
import { useIsFocused } from '@react-navigation/native'; // Import to track screen focus

export default function CameraScreen({ navigation }) {
  const isFocused = useIsFocused(); // Hook to know if screen is active
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  const [photo, setPhoto] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
        setPhoto(photo);
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const pickFromGallery = async () => {
    try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false, 
          quality: 0.7,
        });
  
        if (!result.canceled) {
          const asset = result.assets[0];
          setPhoto(asset);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to pick image');
      }
  };

  const uploadPost = async () => {
    if (!photo || !caption.trim()) {
      Alert.alert('Error', 'Please add a caption');
      return;
    }

    Keyboard.dismiss();
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const mediaUri = photo.uri;
      const fileExtension = 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExtension}`;
      const mimeType = 'image/jpeg';

      // 1. Read file as Base64
      const base64 = await FileSystem.readAsStringAsync(mediaUri, {
        encoding: 'base64',
      });

      // 2. Convert Base64 to ArrayBuffer
      const arrayBuffer = decode(base64);

      // 3. Upload ArrayBuffer
      const { data, error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, arrayBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('posts')
        .insert([{
          user_id: user.id,
          caption: caption,
          media_type: 'photo',
          image_url: publicUrl,
          video_duration: null
        }]);

      if (dbError) throw dbError;

      Alert.alert('Success', 'Post uploaded successfully!');
      resetState();
      navigation.navigate('Home');

    } catch (error) {
      console.error('Error uploading:', error);
      Alert.alert('Error', 'Failed to upload post: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const resetState = () => {
    setPhoto(null); 
    setCaption('');
    setUploading(false);
  };

  if (!cameraPermission || !cameraPermission.granted) {
    return (
      <View style={styles.container}>
        <Button mode="contained" onPress={requestCameraPermission}>Grant Permission</Button>
      </View>
    );
  }

  // --- PREVIEW SCREEN ---
  if (photo) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.previewContainer}>
              <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="contain" />
            </View>
            
            <View style={styles.formContainer}>
              <TextInput
                label="Caption"
                placeholder="Write a caption..."
                value={caption}
                onChangeText={setCaption}
                mode="outlined"
                style={styles.captionInput}
                multiline
                numberOfLines={3}
                disabled={uploading}
              />
              
              <View style={styles.actionButtons}>
                <Button 
                  mode="outlined" 
                  onPress={resetState} 
                  style={styles.cancelButton}
                  textColor="#666"
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button 
                  mode="contained" 
                  onPress={uploadPost} 
                  loading={uploading}
                  disabled={uploading}
                  style={styles.postButton}
                  buttonColor="#6200ee"
                >
                  {uploading ? 'Posting...' : 'Post'}
                </Button>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- CAMERA SCREEN ---
  return (
    <View style={styles.container}>
      {isFocused && ( // Only render camera when screen is focused
        <CameraView 
          style={styles.camera} 
          ref={cameraRef} 
          facing="back"
          mode="picture"
        />
      )}
      
      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          onPress={takePicture}
          style={styles.captureButton}
        >
          Take Photo
        </Button>

        <Button 
          mode="contained" 
          onPress={pickFromGallery}
          style={styles.galleryButton}
        >
          Gallery
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1, backgroundColor: '#fff' },
  keyboardAvoidingView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start' },
  camera: { flex: 1 },
  buttonContainer: { position: 'absolute', bottom: 40, flexDirection: 'row', width: '100%', justifyContent: 'space-around', paddingHorizontal: 20 },
  captureButton: { flex: 1, marginHorizontal: 5 },
  galleryButton: { flex: 1, marginHorizontal: 5 },
  previewContainer: { 
    height: 400, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center',
    width: '100%'
  },
  previewImage: { width: '100%', height: '100%' },
  formContainer: { padding: 20, backgroundColor: '#fff' },
  captionInput: { backgroundColor: '#fff', marginBottom: 20 },
  actionButtons: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  cancelButton: { flex: 1, borderColor: '#ccc' },
  postButton: { flex: 1 },
});