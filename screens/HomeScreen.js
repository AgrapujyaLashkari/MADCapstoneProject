// screens/HomeScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Platform,
  Animated,
  ActivityIndicator
} from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import { Image } from 'expo-image'; // Use expo-image
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '../supabase';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// --- FEED VIDEO COMPONENT ---
const FeedVideo = React.memo(({ uri }) => {
  const player = useVideoPlayer(uri, player => {
    player.loop = true;
    player.muted = true;
  });

  return (
    <View style={styles.mediaContainer}>
      <VideoView
        style={styles.media}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />
    </View>
  );
});

export default function HomeScreen() {
  const navigation = useNavigation();
  const {
    user,
    posts: contextPosts,
    fetchPosts,
    toggleLike: contextToggleLike,
    hasMore,
    loadingMore,
    loading
  } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState([]);

  // Animation Refs
  const scaleAnims = useRef({}).current;

  useEffect(() => {
    setPosts(contextPosts);
  }, [contextPosts]);

  useEffect(() => {
    // Fetch posts when user becomes available
    if (user && contextPosts.length === 0) {
      fetchPosts(true, user);
    }
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts(true, user).then(() => setRefreshing(false));
  }, [fetchPosts, user]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPosts(false, user);
    }
  }, [loadingMore, hasMore, fetchPosts, user]);

  // --- BOUNCY LIKE ANIMATION ---
  const handleLike = async (postId, currentlyLiked) => {
    if (!user) return;

    // Trigger bounce
    if (!scaleAnims[postId]) scaleAnims[postId] = new Animated.Value(1);

    Animated.sequence([
      Animated.spring(scaleAnims[postId], {
        toValue: 0.8,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[postId], {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    const result = await contextToggleLike(postId, currentlyLiked);
    if (!result?.success) {
      console.error('Failed to toggle like:', result?.error);
    }
  };

  const renderPost = useCallback(({ item }) => {
    if (!scaleAnims[item.id]) scaleAnims[item.id] = new Animated.Value(1);

    return (
      <View style={styles.cardContainer}>
        {/* Header Box */}
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatarBox}>
              <Avatar.Icon size={36} icon="account" style={styles.avatar} color="#000" />
            </View>
            <Text style={styles.username}>@{item.profiles?.username || 'user'}</Text>
          </View>
          <View style={styles.moreBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
          </View>
        </View>

        {/* Media Box */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          style={styles.mediaWrapper}
        >
          {item.media_type === 'video' ? (
            <FeedVideo uri={item.image_url} />
          ) : (
            <Image
              source={{ uri: item.image_url }}
              style={styles.media}
              contentFit="cover"
              transition={200} // Fade in
              placeholder={require('../assets/adaptive-icon.png')} // Optional placeholder if you have one, or just color
              placeholderContentFit="cover"
            />
          )}
        </TouchableOpacity>

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <View style={styles.leftActions}>
            <TouchableOpacity onPress={() => handleLike(item.id, item.user_has_liked)}>
              <Animated.View style={[styles.actionBtn, { transform: [{ scale: scaleAnims[item.id] }], backgroundColor: item.user_has_liked ? '#FF69B4' : '#fff' }]}>
                <Ionicons
                  name={item.user_has_liked ? "heart" : "heart-outline"}
                  size={24}
                  color="#000"
                />
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
              <Ionicons name="chatbubble-outline" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.likesBox}>
            <Text style={styles.likesText}>{item.likes_count || 0} LIKES</Text>
          </View>
        </View>

        {/* Caption */}
        <View style={styles.captionBox}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUser}>{item.profiles?.username}: </Text>
            {item.caption}
          </Text>
        </View>
      </View>
    );
  }, [navigation, contextToggleLike]);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  };

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>LOADING_FEED...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Neo Header */}
      <View style={styles.appHeader}>
        <Text style={styles.headerTitle}>SOCIAL_APP</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="notifications-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0', // Off-white bg
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 20,
    backgroundColor: '#FFD700', // Yellow Header
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: -1,
  },
  headerBtn: {
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
  listContent: {
    padding: 20,
    paddingBottom: 100, // Space for floating dock
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    marginBottom: 25,
    // Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20, // Circle
    borderWidth: 2,
    borderColor: '#000',
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: '#FF69B4', // Pink bg
  },
  avatar: {
    backgroundColor: 'transparent',
  },
  username: {
    fontWeight: '800',
    fontSize: 16,
    color: '#000',
  },
  moreBtn: {
    padding: 5,
  },
  mediaWrapper: {
    width: '100%',
    height: width - 46, // Adjust for borders/padding
    backgroundColor: '#000',
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  mediaContainer: {
    width: '100%',
    height: '100%',
  },
  media: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
    backgroundColor: '#fff',
  },
  leftActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    // Small Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  likesBox: {
    backgroundColor: '#4169E1', // Royal Blue
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#000',
    // Small Hard Shadow
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  likesText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  captionBox: {
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  captionText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  captionUser: {
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
});