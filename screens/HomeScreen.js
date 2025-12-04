// screens/HomeScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Card, Title, Paragraph, Avatar, Text, ActivityIndicator, IconButton, Surface } from 'react-native-paper';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabase';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');

// --- Memoized video component for better performance ---
const FeedVideo = React.memo(({ uri }) => {
  const player = useVideoPlayer(uri, player => {
    player.loop = true;
    player.muted = true;
  });

  return (
    <View style={styles.videoContainer}>
      <VideoView
        style={styles.media}
        player={player}
        nativeControls={true}
        contentFit="cover"
        allowsFullscreen={true}
        allowsPictureInPicture={true}
      />
      {/* Retro Scanline Effect Overlay */}
      <View style={styles.scanlineOverlay} pointerEvents="none" />
    </View>
  );
});

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, posts: contextPosts, setPosts, toggleLike: contextToggleLike } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (user) {
      fetchPosts(true, user);
    }

    const likesSubscription = supabase
      .channel('likes_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'likes' },
        (payload) => {
          handleLikeChange(payload);
        }
      )
      .subscribe();

    return () => {
      likesSubscription.unsubscribe();
    };
  }, [user]);

  const handleLikeChange = useCallback((payload) => {
    setPosts(prevPosts => {
      return prevPosts.map(post => {
        if (post.id === payload.new?.post_id || post.id === payload.old?.post_id) {
          if (payload.eventType === 'INSERT') {
            return {
              ...post,
              likes_count: (post.likes_count || 0) + 1,
              user_has_liked: payload.new.user_id === user?.id ? true : post.user_has_liked
            };
          } else if (payload.eventType === 'DELETE') {
            return {
              ...post,
              likes_count: Math.max(0, (post.likes_count || 0) - 1),
              user_has_liked: payload.old.user_id === user?.id ? false : post.user_has_liked
            };
          }
        }
        return post;
      });
    });
  }, [user?.id, setPosts]);

  const fetchPosts = useCallback(async (isInitial = false, currentUser = null) => {
    if (!hasMore && !isInitial) return;

    try {
      const userId = currentUser?.id || user?.id;
      const from = isInitial ? 0 : contextPosts.length;
      const to = from + PAGE_SIZE - 1;

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`*, profiles:user_id (username)`)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (postsError) throw postsError;

      const postsWithLikes = await Promise.all(
        postsData.map(async (post) => {
          const { count } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          const { data: userLike } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', userId)
            .maybeSingle();

          return {
            ...post,
            likes_count: count || 0,
            user_has_liked: !!userLike
          };
        })
      );

      if (isInitial) {
        setPosts(postsWithLikes || []);
      } else {
        setPosts([...contextPosts, ...(postsWithLikes || [])]);
      }

      setHasMore(postsData?.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [hasMore, user, contextPosts.length, PAGE_SIZE, setPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    fetchPosts(true, user);
  }, [fetchPosts, user]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchPosts(false);
    }
  }, [loadingMore, hasMore, fetchPosts]);

  const toggleLike = useCallback(async (postId, currentlyLiked) => {
    await contextToggleLike(postId, currentlyLiked);
  }, [contextToggleLike]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#00f3ff" />
        <Text style={styles.loadingText}>LOADING_DATA...</Text>
      </View>
    );
  }, [loadingMore]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  // Memoized renderPost component
  const renderPost = useCallback(({ item }) => {
    return (
      <Surface style={styles.cardContainer} elevation={0}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              <Avatar.Icon size={40} icon="account" style={styles.avatar} color="#000" />
            </View>
            <View>
              <Title style={styles.username}>{item.profiles?.username || 'UNKNOWN_USER'}</Title>
              <Text style={styles.locationText}>LOCATION: UNKNOWN</Text>
            </View>
          </View>
          {item.media_type === 'video' && (
            <View style={styles.mediaTypeTag}>
              <Text style={styles.mediaTypeText}>VIDEO_FEED</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          activeOpacity={0.9}
          style={styles.mediaWrapper}
        >
          {item.media_type === 'video' ? (
            <FeedVideo uri={item.image_url} />
          ) : (
            <>
              <Card.Cover source={{ uri: item.image_url }} style={styles.media} />
              <View style={styles.scanlineOverlay} pointerEvents="none" />
            </>
          )}
          {/* Corner accents for retro monitor look */}
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </TouchableOpacity>

        <View style={styles.cardContent}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.likeButton}
              onPress={() => toggleLike(item.id, item.user_has_liked)}
            >
              <IconButton
                icon={item.user_has_liked ? 'heart' : 'heart-outline'}
                iconColor={item.user_has_liked ? '#ff00ff' : '#00f3ff'}
                size={26}
                style={styles.actionIcon}
              />
            </TouchableOpacity>
            <Text style={[styles.likesCount, { color: item.user_has_liked ? '#ff00ff' : '#00f3ff' }]}>
              {item.likes_count || 0} {(item.likes_count || 0) === 1 ? 'UNIT' : 'UNITS'}
            </Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
            <View style={styles.captionSection}>
              <Text style={styles.captionUsername}>@{item.profiles?.username || 'USER'}:</Text>
              <Text style={styles.captionText}>{item.caption}</Text>
            </View>
            <Text style={styles.timestamp}>
              TIMESTAMP: {new Date(item.created_at).toLocaleDateString(undefined, {
                month: 'numeric', day: 'numeric', year: '2-digit'
              })}
            </Text>
          </TouchableOpacity>
        </View>
      </Surface>
    );
  }, [navigation, toggleLike]);

  const refreshControl = useMemo(() => (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00f3ff" />
  ), [refreshing, onRefresh]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00f3ff" />
        <Text style={styles.loadingText}>INITIALIZING_FEED...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a12', '#12121a']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>SYSTEM_FEED</Text>
          <View style={styles.onlineIndicator} />
        </View>
      </LinearGradient>

      {contextPosts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconButton icon="post-outline" size={60} iconColor="#333" />
          <Text style={styles.emptyText}>NO_DATA_FOUND</Text>
          <Text style={styles.emptySubText}>INITIATE_FIRST_POST</Text>
        </View>
      ) : (
        <FlatList
          data={contextPosts}
          renderItem={renderPost}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={refreshControl}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          removeClippedSubviews={true}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={50}
          windowSize={10}
          initialNumToRender={5}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a12',
  },
  header: {
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#00f3ff',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 2,
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00f3ff',
    shadowColor: '#00f3ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a12',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold',
  },
  emptySubText: {
    fontSize: 14,
    color: '#333',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  listContent: {
    padding: 15,
    paddingBottom: 20,
  },
  cardContainer: {
    marginBottom: 25,
    backgroundColor: 'rgba(18, 18, 26, 0.6)',
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    borderWidth: 1,
    borderColor: '#00f3ff',
    borderRadius: 20,
    marginRight: 10,
  },
  avatar: {
    backgroundColor: '#00f3ff',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e0e0e0',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  locationText: {
    fontSize: 10,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  mediaTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#ff00ff',
    borderRadius: 4,
  },
  mediaTypeText: {
    color: '#ff00ff',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  videoContainer: {
    width: '100%',
    height: 350,
    backgroundColor: '#000',
    position: 'relative',
  },
  mediaWrapper: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  media: {
    width: '100%',
    height: 350,
    backgroundColor: '#111',
  },
  scanlineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    // In a real app, use a repeating linear gradient for scanlines
    opacity: 0.1,
  },
  // Retro Monitor Corners
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 10, height: 10, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#00f3ff' },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#00f3ff' },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 10, height: 10, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#00f3ff' },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#00f3ff' },

  cardContent: {
    padding: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  likeButton: {
    marginRight: 5,
  },
  actionIcon: {
    margin: 0,
  },
  likesCount: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  captionSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  captionUsername: {
    fontWeight: 'bold',
    marginRight: 6,
    fontSize: 14,
    color: '#00f3ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  captionText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#00f3ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});