// screens/PostDetailScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Avatar, Text, IconButton } from 'react-native-paper';
import { Image } from 'expo-image'; // Use expo-image
import { VideoView, useVideoPlayer } from 'expo-video';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const PostVideoPlayer = ({ uri }) => {
  const player = useVideoPlayer(uri, player => {
    player.loop = true;
    player.play();
  });

  return (
    <View style={styles.mediaContainer}>
      <VideoView
        style={styles.fullVideo}
        player={player}
        nativeControls
        allowsFullscreen
        contentFit="contain"
      />
    </View>
  );
};

export default function PostDetailScreen({ route }) {
  const { postId } = route.params;
  const { user, loading: userLoading, fetchPostWithLikes, toggleLike: contextToggleLike } = useApp();
  const [post, setPost] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('PostDetailScreen effect. PostID:', postId, 'User:', user?.id, 'UserLoading:', userLoading);

    // Wait for user to be loaded before fetching post
    if (userLoading) {
      return; // Still waiting for auth
    }

    if (user) {
      loadPost();
    } else {
      // No user after loading complete
      setError('Please log in to view post details');
      setPageLoading(false);
    }
  }, [user, userLoading, postId]);

  const loadPost = async () => {
    console.log('Starting loadPost for post:', postId);
    try {
      setPageLoading(true);
      setError(null);

      const postData = await fetchPostWithLikes(postId);

      console.log('Post data fetched:', postData ? 'Success' : 'Null');
      if (postData) {
        console.log('Post Liked Status:', postData.user_has_liked);
        setPost(postData);
      } else {
        setError('Post not found');
      }
    } catch (error) {
      console.error('Error fetching post detail:', error);
      setError('Failed to load post: ' + error.message);
    } finally {
      setPageLoading(false);
    }
  };

  const toggleLike = async () => {
    if (!post || !user) return;

    // Call context function and wait for result
    const result = await contextToggleLike(post.id, post.user_has_liked);

    if (result && result.success) {
      setPost(prev => ({
        ...prev,
        user_has_liked: result.liked,
        likes_count: result.liked ? (prev.likes_count || 0) + 1 : Math.max(0, (prev.likes_count || 1) - 1)
      }));
    } else {
      console.error('Failed to toggle like:', result?.error);
      // Optionally show a snackbar or alert here
    }
  };

  if (userLoading || pageLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>LOADING...</Text>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error || 'POST_NOT_FOUND'}</Text>
        <TouchableOpacity onPress={loadPost} style={styles.retryBtn}>
          <Text style={styles.retryText}>RETRY</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Neo-Brutalist Card */}
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarBox}>
            <Avatar.Icon icon="account" size={40} style={styles.avatar} color="#000" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username}>@{post.profiles?.username || 'user'}</Text>
            <Text style={styles.timestamp}>
              {new Date(post.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Media */}
        <View style={styles.mediaWrapper}>
          {post.media_type === 'video' ? (
            <PostVideoPlayer uri={post.image_url} />
          ) : (
            <Image
              source={{ uri: post.image_url }}
              style={styles.fullImage}
              contentFit="contain"
              transition={200}
              placeholder={require('../assets/adaptive-icon.png')}
            />
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={toggleLike} style={[styles.actionBtn, post.user_has_liked && styles.likedBtn]}>
            <Ionicons
              name={post.user_has_liked ? "heart" : "heart-outline"}
              size={28}
              color={post.user_has_liked ? "#fff" : "#000"}
            />
          </TouchableOpacity>
          <View style={styles.likesBox}>
            <Text style={styles.likesText}>{post.likes_count || 0} LIKES</Text>
          </View>
        </View>

        {/* Caption */}
        <View style={styles.captionBox}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUser}>{post.profiles?.username}: </Text>
            {post.caption}
          </Text>
        </View>
      </View>

      {/* Comments Placeholder */}
      <View style={styles.commentsSection}>
        <Text style={styles.sectionTitle}>COMMENTS</Text>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>COMING_SOON</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0', padding: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' },
  loadingText: { fontWeight: '900', fontSize: 20 },
  errorText: { fontWeight: '900', fontSize: 18, color: 'red', marginBottom: 20 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#000',
  },
  retryText: { color: '#fff', fontWeight: 'bold' },

  card: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  avatarBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFD700', // Yellow
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatar: { backgroundColor: 'transparent' },
  userInfo: { flex: 1 },
  username: { fontSize: 18, fontWeight: '900', color: '#000' },
  timestamp: { fontSize: 12, color: '#666', fontWeight: 'bold' },

  mediaWrapper: {
    width: '100%',
    backgroundColor: '#000',
    borderBottomWidth: 3,
    borderBottomColor: '#000',
    minHeight: width, // Ensure square minimum
  },
  mediaContainer: { width: '100%', aspectRatio: 1 },
  fullImage: { width: '100%', aspectRatio: 1, backgroundColor: '#f0f0f0' },
  fullVideo: { width: '100%', height: '100%' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
    gap: 15,
  },
  actionBtn: {
    width: 50,
    height: 50,
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  likedBtn: {
    backgroundColor: '#FF69B4', // Pink
  },
  likesBox: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#4169E1', // Blue
    borderWidth: 3,
    borderColor: '#000',
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  likesText: { color: '#fff', fontWeight: '900' },

  captionBox: { padding: 15 },
  captionText: { fontSize: 16, lineHeight: 22, color: '#000' },
  captionUser: { fontWeight: '900' },

  commentsSection: { marginTop: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '900', marginBottom: 10 },
  placeholderBox: {
    padding: 30,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  placeholderText: { fontSize: 18, fontWeight: '900', color: '#999' },
});