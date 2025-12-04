// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './context/AppContext';
import { supabase } from './supabase';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import CameraScreen from './screens/CameraScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StatusBar, View } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- NEON NOIR THEME ---
const neonTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#00f3ff', // Neon Cyan
    secondary: '#ff00ff', // Neon Pink
    tertiary: '#ffe600', // Neon Yellow
    background: '#0a0a12', // Deep Dark
    surface: '#12121a', // Slightly lighter dark
    onSurface: '#e0e0e0',
    elevation: {
      level1: '#1a1a24',
      level2: '#22222e',
    }
  },
  roundness: 2, // Sharp edges
};

const navigationTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    background: '#0a0a12',
    card: '#12121a',
    text: '#e0e0e0',
    border: '#333',
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Camera') {
            iconName = 'scan-circle';
          }

          // Glowing effect for active icon
          return (
            <View style={{
              shadowColor: focused ? color : 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: focused ? 1 : 0,
              shadowRadius: 10,
              elevation: focused ? 5 : 0,
            }}>
              <Ionicons name={iconName} size={route.name === 'Camera' ? 32 : size} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: '#00f3ff', // Neon Cyan
        tabBarInactiveTintColor: '#666',
        tabBarShowLabel: false, // Cleaner look
        tabBarStyle: {
          backgroundColor: '#0a0a12',
          borderTopColor: '#333',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingTop: 10,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          tabBarStyle: { display: 'none' }
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <PaperProvider theme={neonTheme}>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0a12" />
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a12' }
              }}
            >
              {session ? (
                <>
                  <Stack.Screen
                    name="MainTabs"
                    component={MainTabs}
                  />
                  <Stack.Screen
                    name="PostDetail"
                    component={PostDetailScreen}
                    options={{
                      headerShown: true,
                      title: 'DATA_LOG',
                      headerBackTitle: 'BACK',
                      headerTintColor: '#00f3ff',
                      headerStyle: {
                        backgroundColor: '#0a0a12',
                      },
                      headerTitleStyle: {
                        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
                        fontWeight: 'bold',
                        color: '#00f3ff'
                      }
                    }}
                  />
                </>
              ) : (
                <>
                  <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                  />
                  <Stack.Screen
                    name="Signup"
                    component={SignupScreen}
                  />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}