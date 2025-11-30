// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Avatar, Text, ActivityIndicator, IconButton } from 'react-native-paper';
import { VideoView, useVideoPlayer } from 'expo-video'; // Import useVideoPlayer
import { supabase } from '../supabase';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');

// --- NEW COMPONENT: Handles individual video items safely ---
const FeedVideo = ({ uri }) => {
  // Initialize the player using the hook
  const player = useVideoPlayer(uri, player => {
    player.loop = true;
    // Note: We usually don't want auto-play in a feed as it consumes data/battery
    // player.play(); 
  });

  return (
    <VideoView
      style={styles.media}
      player={player}
      nativeControls
      // allowsFullscreen is deprecated, handling via nativeControls usually suffices
    />
  );
};

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

  const handleLikeChange = (payload) => {
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
  };

  const fetchPosts = async (isInitial = false, currentUser = null) => {
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
  };

  const onRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    fetchPosts(true, user);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchPosts(false);
    }
  };

  const toggleLike = async (postId, currentlyLiked) => {
    await contextToggleLike(postId, currentlyLiked);
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#6200ee" />
        <Text style={styles.loadingText}>Loading more posts...</Text>
      </View>
    );
  };

  // Modified renderPost to use the new FeedVideo component
  const renderPost = ({ item }) => {
    return (
      <Card style={styles.card}>
        <Card.Title
          title={item.profiles?.username || 'Unknown User'}
          left={(props) => <Avatar.Icon {...props} icon="account" />}
          right={(props) => item.media_type === 'video' ? (
            <IconButton {...props} icon="video" size={20} />
          ) : null}
        />
        
        <TouchableOpacity 
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          activeOpacity={0.9}
        >
          {item.media_type === 'video' ? (
            // FIX: Using the separated component here
            <FeedVideo uri={item.image_url} />
          ) : (
            <Card.Cover source={{ uri: item.image_url }} style={styles.media} />
          )}
        </TouchableOpacity>
        
        <Card.Actions style={styles.actions}>
          <IconButton
            icon={item.user_has_liked ? 'heart' : 'heart-outline'}
            iconColor={item.user_has_liked ? '#e91e63' : '#666'}
            size={28}
            onPress={() => toggleLike(item.id, item.user_has_liked)}
          />
          <Text style={styles.likesCount}>
            {item.likes_count || 0} {(item.likes_count || 0) === 1 ? 'like' : 'likes'}
          </Text>
        </Card.Actions>
        
        <TouchableOpacity onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
          <Card.Content>
            <Paragraph>{item.caption}</Paragraph>
            <Text style={styles.timestamp}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </Card.Content>
        </TouchableOpacity>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Social Feed</Title>
      </View>
      {contextPosts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No posts yet. Be the first to post!</Text>
        </View>
      ) : (
        <FlatList
          data={contextPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 15,
    backgroundColor: '#6200ee',
    paddingTop: 50,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  listContent: {
    padding: 10,
  },
  card: {
    marginBottom: 15,
  },
  media: {
    height: 300,
    width: '100%', // Ensure width is set for video
    backgroundColor: '#000', // Good practice for loading state
  },
  actions: {
    paddingLeft: 8,
    alignItems: 'center',
  },
  likesCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});