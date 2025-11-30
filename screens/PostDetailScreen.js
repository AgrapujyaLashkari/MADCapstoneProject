// screens/PostDetailScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Dimensions } from 'react-native';
import { Card, Title, Paragraph, Avatar, Text, IconButton, Divider } from 'react-native-paper';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function PostDetailScreen({ route }) {
  const { postId } = route.params;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    getCurrentUser();
    fetchPostDetail();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchPostDetail = async () => {
    try {
      // Fetch post details
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (username)
        `)
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      // Get total likes count
      const { count, error: countError } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      // Check if current user has liked
      const { data: userLike, error: likeError } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser?.id)
        .maybeSingle();

      setPost({
        ...postData,
        likes_count: count || 0,
        user_has_liked: !!userLike
      });
    } catch (error) {
      console.error('Error fetching post detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async () => {
    if (!post) return;

    const currentlyLiked = post.user_has_liked;

    // Optimistic update
    setPost(prev => ({
      ...prev,
      user_has_liked: !currentlyLiked,
      likes_count: currentlyLiked ? (prev.likes_count || 1) - 1 : (prev.likes_count || 0) + 1
    }));

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
        // Like
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
      setPost(prev => ({
        ...prev,
        user_has_liked: currentlyLiked,
        likes_count: currentlyLiked ? (prev.likes_count || 0) + 1 : (prev.likes_count || 1) - 1
      }));
    }
  };

  if (loading || !post) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Icon icon="account" size={40} />
        <View style={styles.userInfo}>
          <Title style={styles.username}>{post.profiles?.username || 'Unknown User'}</Title>
          <Text style={styles.timestamp}>
            {new Date(post.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <Image 
        source={{ uri: post.image_url }} 
        style={styles.fullImage}
        resizeMode="contain"
      />

      <View style={styles.actionsContainer}>
        <View style={styles.likeSection}>
          <IconButton
            icon={post.user_has_liked ? 'heart' : 'heart-outline'}
            iconColor={post.user_has_liked ? '#e91e63' : '#666'}
            size={28}
            onPress={toggleLike}
          />
          <Text style={styles.likesText}>
            {post.likes_count || 0} {(post.likes_count || 0) === 1 ? 'like' : 'likes'}
          </Text>
        </View>
      </View>

      <View style={styles.captionContainer}>
        <Text style={styles.username}>{post.profiles?.username || 'Unknown User'}</Text>
        <Paragraph style={styles.caption}>{post.caption}</Paragraph>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.commentsSection}>
        <Title style={styles.commentsTitle}>Comments</Title>
        <View style={styles.comingSoonContainer}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
          <Text style={styles.comingSoonSubtext}>
            Comment feature will be available in the next update
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  userInfo: {
    marginLeft: 10,
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  fullImage: {
    width: width,
    height: width,
    backgroundColor: '#f0f0f0',
  },
  actionsContainer: {
    paddingHorizontal: 10,
  },
  likeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: -5,
  },
  captionContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    marginVertical: 15,
  },
  commentsSection: {
    padding: 15,
  },
  commentsTitle: {
    fontSize: 18,
    marginBottom: 15,
  },
  comingSoonContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  comingSoonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  comingSoonSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
