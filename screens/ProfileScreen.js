// screens/ProfileScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Image, ScrollView, Dimensions, TouchableOpacity, Alert, Platform } from 'react-native';
import { Avatar, Title, Button, Text, IconButton, Surface } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');
const imageSize = (width - 4) / 3;

// Memoized PostItem component for better performance
const PostItem = React.memo(({ item, onPress, onDelete }) => (
  <View style={styles.postItem}>
    <TouchableOpacity
      style={styles.postImageContainer}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.image_url }}
        style={styles.postImage}
        resizeMode="cover"
      />
      {item.media_type === 'video' && (
        <View style={styles.videoIndicator}>
          <IconButton icon="video" size={20} iconColor="#00f3ff" />
        </View>
      )}
      {/* Grid Overlay for Retro Feel */}
      <View style={styles.gridOverlay} />
    </TouchableOpacity>
    <IconButton
      icon="delete"
      size={20}
      iconColor="#ff00ff"
      style={styles.deleteButton}
      onPress={onDelete}
    />
  </View>
));

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { deletePost: contextDeletePost } = useApp();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    fetchProfile();
  }, []);

  // Refresh posts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUserPosts();
    }, [])
  );

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  const fetchUserPosts = useCallback(async () => {
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
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const handleDeletePost = useCallback((postId, imageUrl) => {
    if (deleting) return; // Prevent multiple deletes

    Alert.alert(
      'DELETE_CONFIRMATION',
      'PERMANENTLY_ERASE_DATA?',
      [
        {
          text: 'CANCEL',
          style: 'cancel'
        },
        {
          text: 'ERASE',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            // Optimistically remove from UI immediately
            setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));

            const result = await contextDeletePost(postId, imageUrl);

            if (result.success) {
              // Success
            } else {
              // Revert on failure by refetching
              Alert.alert('ERROR', 'DELETION_FAILED: ' + (result.error || 'UNKNOWN_ERROR'));
              await fetchUserPosts();
            }
            setDeleting(false);
          }
        }
      ]
    );
  }, [deleting, contextDeletePost, fetchUserPosts]);

  const renderPost = useCallback(({ item }) => (
    <PostItem
      item={item}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      onDelete={() => handleDeletePost(item.id, item.image_url)}
    />
  ), [navigation, handleDeletePost]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  const getItemLayout = useCallback((data, index) => ({
    length: imageSize,
    offset: imageSize * Math.floor(index / 3),
    index,
  }), []);

  const statsData = useMemo(() => ({
    postsCount: posts.length,
    friendsCount: 0
  }), [posts.length]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>LOADING_PROFILE...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a12', '#12121a']}
        style={styles.headerBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />

      <View style={styles.header}>
        <Title style={styles.headerTitle}>USER_PROFILE</Title>
        <IconButton
          icon="logout"
          iconColor="#ff00ff"
          size={24}
          onPress={handleLogout}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Surface style={styles.profileCard} elevation={0}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Avatar.Icon size={80} icon="account" style={styles.avatar} color="#000" />
            </View>
            <Title style={styles.username}>{profile?.username || 'UNKNOWN_USER'}</Title>
            <Text style={styles.email}>ID: {profile?.email}</Text>

            <View style={styles.statsContainer}>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{statsData.postsCount}</Text>
                <Text style={styles.statLabel}>DATA_UNITS</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{statsData.friendsCount}</Text>
                <Text style={styles.statLabel}>LINKS</Text>
              </View>
            </View>
          </View>

          {/* HUD Corners */}
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </Surface>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>DATA_LOGS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
            onPress={() => setActiveTab('friends')}
          >
            <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>LINKED_USERS</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconButton icon="camera-off" size={50} iconColor="#333" />
              <Text style={styles.emptyText}>NO_DATA_LOGGED</Text>
            </View>
          ) : (
            <FlatList
              data={posts}
              renderItem={renderPost}
              keyExtractor={keyExtractor}
              getItemLayout={getItemLayout}
              numColumns={3}
              contentContainerStyle={styles.postsGrid}
              scrollEnabled={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={9}
              updateCellsBatchingPeriod={50}
              windowSize={5}
            />
          )
        ) : (
          <View style={styles.emptyContainer}>
            <IconButton icon="account-off" size={50} iconColor="#333" />
            <Text style={styles.emptyText}>NO_LINKS_FOUND</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a12',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  header: {
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#00f3ff',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a12',
  },
  loadingText: {
    color: '#00f3ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  profileCard: {
    margin: 15,
    marginTop: 10,
    backgroundColor: 'rgba(18, 18, 26, 0.6)',
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative',
    padding: 5,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 20,
  },
  avatarContainer: {
    borderWidth: 2,
    borderColor: '#00f3ff',
    borderRadius: 40,
    padding: 2,
    marginBottom: 10,
  },
  avatar: {
    backgroundColor: '#00f3ff',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 5,
    color: '#e0e0e0',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  email: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#333',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00f3ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  // HUD Corners
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#00f3ff' },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#00f3ff' },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#00f3ff' },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#00f3ff' },

  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  tab: {
    marginRight: 20,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#00f3ff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  activeTabText: {
    color: '#00f3ff',
  },
  postsGrid: {
    padding: 1,
  },
  postItem: {
    width: imageSize,
    height: imageSize,
    margin: 1,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#222',
  },
  postImageContainer: {
    width: '100%',
    height: '100%',
  },
  postImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8, // Slightly dimmed for retro feel
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 243, 255, 0.1)',
  },
  videoIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00f3ff',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    margin: 5,
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: '#ff00ff',
  },
  emptyContainer: {
    padding: 50,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});