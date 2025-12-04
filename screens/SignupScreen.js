import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import { TextInput, Button, Text, Title, Snackbar, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabase';

const { width, height } = Dimensions.get('window');

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  const handleSignup = async () => {
    if (!email || !password || !username) {
      setMessage('Please fill in all fields');
      setVisible(true);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: username,
        }
      }
    });

    if (error) {
      setMessage(error.message);
      setVisible(true);
    } else {
      // Create user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            username: username,
            email: email
          }
        ]);

      if (profileError) {
        setMessage('Account created but profile setup failed');
        setVisible(true);
      } else {
        setMessage('ID_CREATED_SUCCESSFULLY');
        setVisible(true);
        setTimeout(() => navigation.navigate('Login'), 2000);
      }
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a12', '#1a1a2e', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.logoContainer}>
            <View style={styles.logoGlitch}>
              <Text style={[styles.logoText, styles.glitchTextRed]}>NEW_USER</Text>
              <Text style={[styles.logoText, styles.glitchTextCyan]}>NEW_USER</Text>
              <Text style={styles.logoText}>NEW_USER</Text>
            </View>
            <Text style={styles.subLogoText}>INITIALIZE_REGISTRATION</Text>
          </View>

          <Surface style={styles.card} elevation={0}>
            <View style={styles.cardHeader}>
              <View style={styles.headerDot} />
              <Text style={styles.headerTitle}>CREATE_ID</Text>
              <View style={styles.headerLine} />
            </View>

            <TextInput
              label="> SET_USERNAME"
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              style={styles.input}
              autoCapitalize="none"
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

            <TextInput
              label="> SET_EMAIL"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
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

            <TextInput
              label="> SET_PASSWORD"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={secureTextEntry}
              style={styles.input}
              textColor="#00f3ff"
              outlineColor="#333"
              activeOutlineColor="#00f3ff"
              right={
                <TextInput.Icon
                  icon={secureTextEntry ? "eye" : "eye-off"}
                  onPress={() => setSecureTextEntry(!secureTextEntry)}
                  color="#00f3ff"
                />
              }
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

            <Button
              mode="contained"
              onPress={handleSignup}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              {loading ? 'PROCESSING...' : 'EXECUTE_REGISTRATION'}
            </Button>

            <View style={styles.footer}>
              <Text style={styles.footerText}>ID_EXISTS?</Text>
              <Button
                mode="text"
                onPress={() => navigation.navigate('Login')}
                labelStyle={styles.linkButtonLabel}
                compact
              >
                [LOGIN]
              </Button>
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={visible}
        onDismiss={() => setVisible(false)}
        duration={3000}
        style={styles.snackbar}
        action={{
          label: 'CLOSE',
          onPress: () => setVisible(false),
          textColor: '#000'
        }}
      >
        <Text style={styles.snackbarText}>{message}</Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a12',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoGlitch: {
    position: 'relative',
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 4,
  },
  glitchTextRed: {
    position: 'absolute',
    top: 2,
    left: 2,
    color: '#ff00ff',
    opacity: 0.7,
  },
  glitchTextCyan: {
    position: 'absolute',
    top: -2,
    left: -2,
    color: '#00f3ff',
    opacity: 0.7,
  },
  subLogoText: {
    color: '#ff00ff',
    fontSize: 12,
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 2,
  },
  card: {
    padding: 25,
    backgroundColor: 'rgba(18, 18, 26, 0.8)',
    borderWidth: 1,
    borderColor: '#ff00ff', // Pink border for signup
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  headerDot: {
    width: 8,
    height: 8,
    backgroundColor: '#ff00ff',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    color: '#ff00ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold',
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
    marginLeft: 10,
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#0a0a12',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  button: {
    marginTop: 10,
    backgroundColor: '#ff00ff', // Pink button
    borderRadius: 0,
    borderWidth: 0,
  },
  buttonContent: {
    height: 50,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },
  footerText: {
    color: '#666',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  linkButtonLabel: {
    color: '#00f3ff',
    fontWeight: 'bold',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  snackbar: {
    backgroundColor: '#ff00ff',
    borderWidth: 1,
    borderColor: '#fff',
  },
  snackbarText: {
    color: '#000',
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  }
});