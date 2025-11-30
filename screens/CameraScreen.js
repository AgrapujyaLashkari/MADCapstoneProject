// screens/CameraScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Alert } from 'react-native';
import { Button, TextInput, Text, Portal, Modal, ActivityIndicator } from 'react-native-paper';
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
        setModalVisible(true);
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
        setModalVisible(true);
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
      setModalVisible(false);
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

      <Portal>
        <Modal 
          visible={modalVisible} 
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          {photo && (
            <>
              <Image source={{ uri: photo.uri }} style={styles.preview} />
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
                    setPhoto(null);
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