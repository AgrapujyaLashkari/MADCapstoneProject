import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Alert } from 'react-native';
import { Button, TextInput, Text, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase';
import { decode } from 'base64-arraybuffer';

export default function CameraScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
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
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });
      setPhoto(photo);
      setModalVisible(true);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0]);
      setModalVisible(true);
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
      
      // Upload image to Supabase Storage
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, decode(photo.base64), {
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
        .insert([
          {
            user_id: user.id,
            image_url: publicUrl,
            caption: caption,
          }
        ]);

      if (dbError) throw dbError;

      Alert.alert('Success', 'Post uploaded successfully!');
      setPhoto(null);
      setCaption('');
      setModalVisible(false);
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error uploading:', error);
      Alert.alert('Error', 'Failed to upload post');
    } finally {
      setUploading(false);
    }
  };

  if (!permission) {
    return <View style={styles.container}><Text>Requesting permissions...</Text></View>;
  }
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 10 }}>We need your permission to show the camera</Text>
        <Button mode="contained" onPress={requestPermission}>
          Grant Permission
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
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
            onPress={pickImage}
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
  galleryButton: {
    marginHorizontal: 10,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
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