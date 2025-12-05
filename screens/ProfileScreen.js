// screens/ProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Platform,
  Alert
} from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import { Image } from 'expo-image'; // Use expo-image
import { supabase } from '../supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2; // Chunky 2-column grid
const IMAGE_SIZE = (width - 60) / COLUMN_COUNT; // Adjust for padding

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { deletePost: contextDeletePost } = useApp();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetchProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserPosts();
    }, [])
  );

  const fetchProfile = async (retries = 3) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle to avoid error on 0 rows

      if (error) throw error;

      if (!data) {
        // Profile not found yet
        if (retries > 0) {
          console.log(`Profile not found, retrying... (${retries} left)`);
          setTimeout(() => fetchProfile(retries - 1), 1000); // Wait 1s and retry
        } else {
          console.error('Profile not found after retries');
        }
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDeletePost = (post) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { success, error } = await contextDeletePost(post.id, post.image_url);
            if (success) {
              setPosts(prev => prev.filter(p => p.id !== post.id));
              Alert.alert("Deleted", "Post has been deleted.");
            } else {
              Alert.alert("Error", error || "Failed to delete post.");
            }
          }
        }
      ]
    );
  };

  const renderPost = ({ item }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      onLongPress={() => handleDeletePost(item)} // Add Delete on Long Press
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: item.image_url }}
        style={styles.gridImage}
        contentFit="cover"
        transition={200}
        placeholder={require('../assets/adaptive-icon.png')}
      />
      {item.media_type === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={16} color="#000" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFILE_ID</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ID Card Box */}
        <View style={styles.idCard}>
          <View style={styles.idHeader}>
            <Text style={styles.idLabel}>IDENTIFICATION</Text>
            <View style={styles.idHole} />
          </View>

          <View style={styles.idContent}>
            <View style={styles.avatarBox}>
              <Avatar.Icon size={80} icon="account" style={styles.avatar} color="#000" />
            </View>
            <View style={styles.idInfo}>
              <Text style={styles.username}>@{profile?.username || 'user'}</Text>
              <Text style={styles.role}>CREATOR</Text>
              <Text style={styles.email}>{profile?.email}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: '#FFD700' }]}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>POSTS</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FF69B4' }]}>
            <Text style={styles.statNumber}>128</Text>
            <Text style={styles.statLabel}>FANS</Text>
          </View>
        </View>

        {/* Grid Header */}
        <View style={styles.gridHeader}>
          <Text style={styles.gridTitle}>GALLERY</Text>
          <View style={styles.gridLine} />
        </View>

        {/* Grid */}
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id.toString()}
          numColumns={COLUMN_COUNT}
          scrollEnabled={false}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.gridColumnWrapper}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  logoutBtn: {
    padding: 5,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FF69B4', // Pink
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  idCard: {
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
  idHeader: {
    backgroundColor: '#4169E1', // Blue
    padding: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idLabel: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  idHole: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000',
  },
  idContent: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    marginRight: 20,
  },
  avatar: {
    backgroundColor: 'transparent',
  },
  idInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
    marginBottom: 4,
  },
  role: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#000',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 8,
  },
  email: {
    fontSize: 12,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 30,
  },
  statBox: {
    flex: 1,
    borderWidth: 3,
    borderColor: '#000',
    padding: 15,
    alignItems: 'center',
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    marginTop: 4,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  gridTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    marginRight: 10,
  },
  gridLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#000',
  },
  gridContainer: {
    gap: 15,
  },
  gridColumnWrapper: {
    gap: 15,
  },
  gridItem: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#fff',
    marginBottom: 15,
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
  },
  videoBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});