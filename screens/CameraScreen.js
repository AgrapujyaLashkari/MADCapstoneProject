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
  Keyboard,
  TouchableOpacity
} from 'react-native';
import { Button, TextInput, Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function CameraScreen({ navigation }) {
  const isFocused = useIsFocused();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [photo, setPhoto] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [facing, setFacing] = useState('back');

  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
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

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
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

      const base64 = await FileSystem.readAsStringAsync(mediaUri, {
        encoding: 'base64',
      });
      const arrayBuffer = decode(base64);

      const { error: uploadError } = await supabase.storage
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

      Alert.alert('Success', 'Post shared!');
      resetState();
      navigation.navigate('Home');

    } catch (error) {
      console.error('Error uploading:', error);
      Alert.alert('Error', 'Failed to upload post');
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
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access needed</Text>
        <Button mode="contained" onPress={requestCameraPermission} buttonColor="#000">
          Grant Access
        </Button>
      </View>
    );
  }

  // --- PREVIEW SCREEN ---
  if (photo) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetState} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NEW_POST</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.previewCard}>
            <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.captionBox}>
              <TextInput
                placeholder="WRITE_CAPTION..."
                value={caption}
                onChangeText={setCaption}
                style={styles.captionInput}
                multiline
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                placeholderTextColor="#666"
                theme={{ colors: { background: '#fff' } }}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={uploadPost}
            disabled={uploading}
            style={[styles.shareBtn, uploading && styles.disabledBtn]}
          >
            <Text style={styles.shareBtnText}>{uploading ? 'POSTING...' : 'SHARE_NOW'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- CAMERA SCREEN ---
  return (
    <View style={styles.container}>
      {isFocused && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            ref={cameraRef}
            facing={facing}
            mode="picture"
          />
          <SafeAreaView style={styles.cameraUiContainer} pointerEvents="box-none">
            {/* Top Controls */}
            <View style={styles.topControls}>
              <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.closeBtn}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
              <TouchableOpacity onPress={pickFromGallery} style={styles.galleryButton}>
                <Ionicons name="images" size={24} color="#000" />
              </TouchableOpacity>

              <TouchableOpacity onPress={takePicture} style={styles.captureButtonOuter}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleCameraFacing} style={styles.flipButton}>
                <Ionicons name="camera-reverse" size={28} color="#000" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  permissionText: { marginBottom: 20, fontSize: 16, fontWeight: 'bold' },

  // Preview Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFD700',
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  scrollContent: { padding: 20 },
  previewCard: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    marginBottom: 20,
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  previewImage: { width: '100%', height: 300, borderBottomWidth: 3, borderBottomColor: '#000' },
  captionBox: { padding: 10 },
  captionInput: { fontSize: 16, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },

  shareBtn: {
    backgroundColor: '#4169E1', // Blue
    paddingVertical: 15,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  disabledBtn: { opacity: 0.7 },

  // Camera Styles
  cameraContainer: { flex: 1 },
  camera: { ...StyleSheet.absoluteFillObject },
  cameraUiContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topControls: { padding: 20, alignItems: 'flex-start' },
  closeBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  captureButtonOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3040', // Red button
    borderWidth: 2,
    borderColor: '#000',
  },
  galleryButton: {
    width: 50,
    height: 50,
    backgroundColor: '#FFD700',
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  flipButton: {
    width: 50,
    height: 50,
    backgroundColor: '#FF69B4',
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
});