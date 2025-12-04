// screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, ScrollView, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { Avatar, Title, Button, Text, Card, Divider, ActivityIndicator, Chip, IconButton } from 'react-native-paper';
import { supabase } from '../supabase';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');
const imageSize = (width - 40) / 3;

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { deletePost: contextDeletePost } = useApp();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
  }, []);

  const fetchProfile = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDeletePost = (postId, imageUrl) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await contextDeletePost(postId, imageUrl);
            if (result.success) {
              // Remove from local state
              setPosts(posts.filter(post => post.id !== postId));
              Alert.alert('Success', 'Post deleted successfully');
            } else {
              Alert.alert('Error', 'Failed to delete post: ' + (result.error || 'Unknown error'));
            }
          }
        }
      ]
    );
  };

  const renderPost = ({ item }) => (
    <View style={styles.postItem}>
      <TouchableOpacity 
        style={styles.postImageContainer}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.image_url }} style={styles.postImage} />
      </TouchableOpacity>
      <IconButton
        icon="delete"
        size={20}
        iconColor="white"
        style={styles.deleteButton}
        onPress={() => handleDeletePost(item.id, item.image_url)}
      />
    </View>
  );

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
        <Title style={styles.headerTitle}>Profile</Title>
        <Button 
          icon="logout" 
          mode="text" 
          onPress={handleLogout}
          textColor="white"
        >
          Logout
        </Button>
      </View>

      <ScrollView>
        <View style={styles.profileHeader}>
          <Avatar.Icon size={80} icon="account" style={styles.avatar} />
          <Title style={styles.username}>{profile?.username || 'User'}</Title>
          <Text style={styles.email}>{profile?.email}</Text>

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
          </View>
        </View>

        <Divider />

        <View style={styles.tabContainer}>
          <Chip
            selected={activeTab === 'posts'}
            onPress={() => setActiveTab('posts')}
            style={styles.tab}
            mode={activeTab === 'posts' ? 'flat' : 'outlined'}
          >
            Posts
          </Chip>
          <Chip
            selected={activeTab === 'friends'}
            onPress={() => setActiveTab('friends')}
            style={styles.tab}
            mode={activeTab === 'friends' ? 'flat' : 'outlined'}
          >
            Friends
          </Chip>
        </View>

        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          ) : (
            <FlatList
              data={posts}
              renderItem={renderPost}
              keyExtractor={(item) => item.id.toString()}
              numColumns={3}
              contentContainerStyle={styles.postsGrid}
              scrollEnabled={false}
            />
          )
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No friends yet</Text>
          </View>
        )}
      </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  profileHeader: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  avatar: {
    backgroundColor: '#6200ee',
    marginBottom: 10,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 5,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 40,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    backgroundColor: 'white',
  },
  tab: {
    flex: 1,
  },
  postsGrid: {
    padding: 2,
  },
  postItem: {
    width: imageSize,
    height: imageSize,
    margin: 2,
    position: 'relative',
  },
  postImageContainer: {
    width: '100%',
    height: '100%',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    margin: 0,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});