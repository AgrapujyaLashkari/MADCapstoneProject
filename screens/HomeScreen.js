// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Dimensions } from 'react-native';
import { Card, Title, Paragraph, Avatar, Text, ActivityIndicator, IconButton } from 'react-native-paper';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    initializeData();
    
    // Setup realtime subscription for likes
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
  }, []);

  const initializeData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
    // Fetch posts after user is set
    await fetchPosts(true, user);
  };

  const handleLikeChange = (payload) => {
    setPosts(prevPosts => {
      return prevPosts.map(post => {
        if (post.id === payload.new?.post_id || post.id === payload.old?.post_id) {
          if (payload.eventType === 'INSERT') {
            return {
              ...post,
              likes_count: (post.likes_count || 0) + 1,
              user_has_liked: payload.new.user_id === currentUser?.id ? true : post.user_has_liked
            };
          } else if (payload.eventType === 'DELETE') {
            return {
              ...post,
              likes_count: Math.max(0, (post.likes_count || 0) - 1),
              user_has_liked: payload.old.user_id === currentUser?.id ? false : post.user_has_liked
            };
          }
        }
        return post;
      });
    });
  };

  const fetchPosts = async (isInitial = false, user = null) => {
    if (!hasMore && !isInitial) return;
    
    try {
      const userId = user?.id || currentUser?.id;
      const from = isInitial ? 0 : posts.length;
      const to = from + PAGE_SIZE - 1;

      // First fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (username)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (postsError) throw postsError;

      // Then fetch likes count and user's like status for each post
      const postsWithLikes = await Promise.all(
        postsData.map(async (post) => {
          // Get total likes count
          const { count, error: countError } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          // Check if current user has liked
          const { data: userLike, error: likeError } = await supabase
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
        setPosts(prev => [...prev, ...(postsWithLikes || [])]);
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
    fetchPosts(true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchPosts(false);
    }
  };

  const toggleLike = async (postId, currentlyLiked) => {
    // Optimistic update
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              user_has_liked: !currentlyLiked,
              likes_count: currentlyLiked ? (post.likes_count || 1) - 1 : (post.likes_count || 0) + 1
            }
          : post
      )
    );

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (currentlyLiked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Like - use upsert to avoid duplicate key errors
        const { error } = await supabase
          .from('likes')
          .upsert([{ post_id: postId, user_id: user.id }], {
            onConflict: 'user_id,post_id',
            ignoreDuplicates: false
          });
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update on error
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                user_has_liked: currentlyLiked,
                likes_count: currentlyLiked ? (post.likes_count || 0) + 1 : (post.likes_count || 1) - 1
              }
            : post
        )
      );
    }
  };

  const renderPost = ({ item }) => (
    <Card style={styles.card}>
      <Card.Title
        title={item.profiles?.username || 'Unknown User'}
        left={(props) => <Avatar.Icon {...props} icon="account" />}
      />
      
      <Card.Cover source={{ uri: item.image_url }} style={styles.media} />
      
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
      
      <Card.Content>
        <Paragraph>{item.caption}</Paragraph>
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" />
      </View>
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
      {posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No posts yet. Be the first to post!</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
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
});