// screens/CameraScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, TextInput, Text, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../supabase';
import { decode } from 'base64-arraybuffer';

export default function CameraScreen({ navigation }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const cameraRef = useRef(null);

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
        setPhoto(photo);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        setPhoto(asset);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image from gallery');
    }
  };

  const uploadPost = async () => {
    if (!photo || !caption.trim()) {
      Alert.alert('Error', 'Please add a caption');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(photo.uri, {
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

      // Save post to database
      const { error: dbError } = await supabase
        .from('posts')
        .insert([{
          user_id: user.id,
          caption: caption,
          media_type: 'photo',
          image_url: publicUrl
        }]);

      if (dbError) throw dbError;

      Alert.alert('Success', 'Post uploaded successfully!');
      setPhoto(null);
      setCaption('');
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error uploading:', error);
      Alert.alert('Error', 'Failed to upload post: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (!cameraPermission) {
    return <View style={styles.container}><Text>Requesting permissions...</Text></View>;
  }
  if (!cameraPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 10, padding: 20 }}>
          We need camera permission to take photos
        </Text>
        <Button mode="contained" onPress={requestCameraPermission} style={{ marginHorizontal: 20 }}>
          Grant Permission
        </Button>
      </View>
    );
  }

  // Preview screen when photo is selected
  if (photo) {
    return (
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="contain" />
        </View>
        
        <View style={styles.captionContainer}>
          <TextInput
            placeholder="Write a caption..."
            value={caption}
            onChangeText={setCaption}
            mode="outlined"
            style={styles.captionInput}
            multiline
            maxLength={500}
          />
          <View style={styles.actionButtons}>
            <Button 
              mode="outlined" 
              onPress={() => {
                setPhoto(null);
                setCaption('');
              }}
              disabled={uploading}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={uploadPost}
              disabled={uploading}
              style={styles.postButton}
            >
              {uploading ? <ActivityIndicator color="white" /> : 'Post'}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Camera screen
  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        ref={cameraRef} 
        facing="back"
      />
      
      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          onPress={takePicture}
          style={styles.captureButton}
          icon="camera"
        >
          Take Photo
        </Button>
        <Button 
          mode="contained" 
          onPress={pickFromGallery}
          style={styles.galleryButton}
          icon="image"
        >
          Gallery
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  captureButton: {
    marginHorizontal: 10,
    flex: 1,
  },
  galleryButton: {
    marginHorizontal: 10,
    flex: 1,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  captionContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  captionInput: {
    backgroundColor: '#fff',
    maxHeight: 100,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  cancelButton: {
    flex: 1,
  },
  postButton: {
    flex: 1,
  },
});