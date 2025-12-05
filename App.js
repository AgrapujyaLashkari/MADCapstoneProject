// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
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
import { Platform, StatusBar, View, Text } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- NEO-BRUTALIST THEME ---
const neoTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#000000', // Black is the main color
    secondary: '#FFD700', // Vibrant Yellow
    tertiary: '#FF69B4', // Hot Pink
    background: '#f0f0f0', // Off-white background
    surface: '#ffffff',
    onSurface: '#000000',
    outline: '#000000', // Thick black borders
    elevation: {
      level1: '#ffffff',
    },
  },
  roundness: 0, // Sharp edges usually, but we might mix it up
};

const navigationTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    background: '#f0f0f0',
    card: '#ffffff',
    text: '#000000',
    border: '#000000',
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
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          }
          return <Ionicons name={iconName} size={28} color={color} />;
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#666666',
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          elevation: 0,
          backgroundColor: '#ffffff',
          borderRadius: 15,
          height: 70,
          borderWidth: 3,
          borderColor: '#000000',
          // Hard Shadow
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 0,
          paddingBottom: 0, // Center icons
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <PaperProvider theme={neoTheme}>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar barStyle="dark-content" backgroundColor="#f0f0f0" />
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#f0f0f0' }
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
                      title: 'POST_DETAILS',
                      headerBackTitleVisible: false,
                      headerTintColor: '#000000',
                      headerStyle: {
                        backgroundColor: '#FFD700', // Yellow Header
                        borderBottomWidth: 3,
                        borderBottomColor: '#000000',
                      },
                      headerTitleStyle: {
                        fontWeight: '900',
                        color: '#000000',
                        fontSize: 18,
                        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
                      },
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