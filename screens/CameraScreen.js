// screens/CameraScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Button, TextInput, Text, IconButton, Surface } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabase';
import { useIsFocused } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function CameraScreen({ navigation }) {
  const isFocused = useIsFocused();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [photo, setPhoto] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [facing, setFacing] = useState('back');

  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const cameraRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (isMounted) {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
    })();

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      if (isMounted) setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      if (isMounted) setKeyboardVisible(false);
    });

    return () => {
      isMounted = false;
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const takePicture = useCallback(async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
        setPhoto(photo);
      } catch (error) {
        Alert.alert('ERROR', 'CAPTURE_FAILED');
      }
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
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
      Alert.alert('ERROR', 'GALLERY_ACCESS_FAILED');
    }
  }, []);

  const toggleCameraFacing = useCallback(() => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }, []);

  const uploadPost = useCallback(async () => {
    if (!photo || !caption.trim()) {
      Alert.alert('ERROR', 'CAPTION_REQUIRED');
      return;
    }

    Keyboard.dismiss();
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("USER_NOT_FOUND");

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

      Alert.alert('SUCCESS', 'UPLOAD_COMPLETE', [
        {
          text: 'ACKNOWLEDGE',
          onPress: () => {
            resetState();
            navigation.navigate('Home');
          }
        }
      ]);

    } catch (error) {
      console.error('Error uploading:', error);
      Alert.alert('ERROR', 'UPLOAD_FAILED: ' + (error.message || 'UNKNOWN_ERROR'));
    } finally {
      setUploading(false);
    }
  }, [photo, caption, navigation]);

  const resetState = useCallback(() => {
    setPhoto(null);
    setCaption('');
    setUploading(false);
  }, []);

  if (!cameraPermission || !cameraPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>CAMERA_ACCESS_REQUIRED</Text>
        <Button mode="contained" onPress={requestCameraPermission} style={styles.permissionButton}>
          GRANT_ACCESS
        </Button>
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
              <IconButton
                icon="close-circle"
                size={30}
                iconColor="#ff00ff"
                style={styles.closePreviewButton}
                onPress={resetState}
              />
              {/* Retro Overlay */}
              <View style={styles.recOverlay}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>PAUSED</Text>
              </View>
            </View>

            <Surface style={styles.formContainer} elevation={0}>
              <TextInput
                label="> ENTER_CAPTION"
                value={caption}
                onChangeText={setCaption}
                mode="outlined"
                style={styles.captionInput}
                multiline
                numberOfLines={3}
                disabled={uploading}
                textColor="#00f3ff"
                outlineColor="#333"
                activeOutlineColor="#00f3ff"
                theme={{
                  colors: {
                    onSurfaceVariant: '#666',
                    background: '#0a0a12'
                  },
                  fonts: {
                    bodyLarge: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' }
                  }
                }}
              />

              <View style={styles.actionButtons}>
                <Button
                  mode="outlined"
                  onPress={resetState}
                  style={styles.cancelButton}
                  textColor="#ff00ff"
                  disabled={uploading}
                  labelStyle={styles.buttonLabel}
                >
                  ABORT
                </Button>
                <Button
                  mode="contained"
                  onPress={uploadPost}
                  loading={uploading}
                  disabled={uploading}
                  style={styles.postButton}
                  buttonColor="#00f3ff"
                  labelStyle={[styles.buttonLabel, { color: '#000' }]}
                >
                  {uploading ? 'TRANSMITTING...' : 'INITIATE_UPLOAD'}
                </Button>
              </View>
            </Surface>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- CAMERA SCREEN ---
  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView
          style={styles.camera}
          ref={cameraRef}
          facing={facing}
          mode="picture"
        >
          {/* Retro Camcorder Overlay */}
          <View style={styles.camcorderOverlay} pointerEvents="none">
            <View style={styles.recIndicator}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC</Text>
            </View>
            <Text style={styles.batteryText}>BAT [|||||]</Text>

            {/* Crosshairs */}
            <View style={styles.crosshairCenter} />

            {/* Corner Brackets */}
            <View style={styles.bracketTL} />
            <View style={styles.bracketTR} />
            <View style={styles.bracketBL} />
            <View style={styles.bracketBR} />
          </View>

          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.6)']}
            style={styles.cameraControls}
          >
            <View style={styles.topControls}>
              <IconButton
                icon="camera-flip"
                iconColor="#00f3ff"
                size={30}
                onPress={toggleCameraFacing}
                style={styles.controlButton}
              />
            </View>

            <View style={styles.bottomControls}>
              <TouchableOpacity onPress={pickFromGallery} style={styles.galleryButton}>
                <IconButton icon="image" iconColor="#00f3ff" size={28} />
              </TouchableOpacity>

              <TouchableOpacity onPress={takePicture} style={styles.captureButtonOuter}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <View style={styles.spacer} />
            </View>
          </LinearGradient>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1, backgroundColor: '#0a0a12' },
  keyboardAvoidingView: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0a0a12',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#00f3ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  permissionButton: {
    backgroundColor: '#00f3ff',
  },

  camera: { flex: 1 },
  cameraControls: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 50,
  },

  // Retro Overlay Styles
  camcorderOverlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    bottom: 100,
    justifyContent: 'space-between',
  },
  recIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'red',
    marginRight: 8,
  },
  recText: {
    color: 'white',
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowRadius: 2,
  },
  batteryText: {
    position: 'absolute',
    top: 0,
    right: 0,
    color: '#00f3ff',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold',
  },
  crosshairCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    transform: [{ translateX: -10 }, { translateY: -10 }],
  },
  bracketTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 3, borderLeftWidth: 3, borderColor: 'white' },
  bracketTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 3, borderRightWidth: 3, borderColor: 'white' },
  bracketBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: 'white' },
  bracketBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 3, borderRightWidth: 3, borderColor: 'white' },

  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 40,
  },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: '#00f3ff',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  galleryButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00f3ff',
  },
  captureButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#00f3ff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    shadowColor: '#00f3ff',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  spacer: {
    width: 50,
  },

  previewContainer: {
    height: 400,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  previewImage: { width: '100%', height: '100%' },
  closePreviewButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  recOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  formContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: 'rgba(18, 18, 26, 0.6)',
    borderWidth: 1,
    borderColor: '#333',
  },
  captionInput: {
    backgroundColor: '#0a0a12',
    marginBottom: 20,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  actionButtons: { flexDirection: 'row', gap: 15 },
  cancelButton: {
    flex: 1,
    borderColor: '#ff00ff',
    borderWidth: 1,
    borderRadius: 0,
  },
  postButton: {
    flex: 1,
    borderRadius: 0,
  },
  buttonLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold',
  },
});