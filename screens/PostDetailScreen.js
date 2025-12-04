// screens/PostDetailScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Dimensions, Platform } from 'react-native';
import { Card, Title, Paragraph, Avatar, Text, IconButton, Divider, Surface } from 'react-native-paper';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');

// Helper component for Post Details video
const PostVideoPlayer = ({ uri }) => {
  const player = useVideoPlayer(uri, player => {
    player.loop = true;
    player.play();
  });

  return (
    <View style={styles.videoContainer}>
      <VideoView
        style={styles.fullVideo}
        player={player}
        nativeControls={true}
        allowsFullscreen={true}
        allowsPictureInPicture={true}
        contentFit="contain"
      />
    </View>
  );
};

export default function PostDetailScreen({ route }) {
  const { postId } = route.params;
  const { user, fetchPostWithLikes, toggleLike: contextToggleLike } = useApp();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadPost();
  }, [user]);

  const loadPost = async () => {
    try {
      const postData = await fetchPostWithLikes(postId);
      setPost(postData);
    } catch (error) {
      console.error('Error fetching post detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async () => {
    if (!post) return;
    await contextToggleLike(post.id, post.user_has_liked);
    await loadPost();
  };

  if (loading || !post) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>ACCESSING_DATABASE...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.contentSurface} elevation={0}>
          <View style={styles.header}>
            <View style={styles.avatarBorder}>
              <Avatar.Icon icon="account" size={40} style={styles.avatar} color="#000" />
            </View>
            <View style={styles.userInfo}>
              <Title style={styles.username}>{post.profiles?.username || 'UNKNOWN_ENTITY'}</Title>
              <Text style={styles.timestamp}>
                LOG_DATE: {new Date(post.created_at).toLocaleDateString(undefined, {
                  year: 'numeric', month: '2-digit', day: '2-digit'
                })}
              </Text>
            </View>
            {post.media_type === 'video' && <IconButton icon="video" size={24} iconColor="#00f3ff" />}
          </View>

          <View style={styles.mediaContainer}>
            {post.media_type === 'video' ? (
              <PostVideoPlayer uri={post.image_url} />
            ) : (
              <Image
                source={{ uri: post.image_url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
            {/* Corner accents */}
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>

          <View style={styles.actionsContainer}>
            <View style={styles.likeSection}>
              <IconButton
                icon={post.user_has_liked ? 'heart' : 'heart-outline'}
                iconColor={post.user_has_liked ? '#ff00ff' : '#00f3ff'}
                size={30}
                onPress={toggleLike}
                style={styles.likeButton}
              />
              <Text style={[styles.likesText, { color: post.user_has_liked ? '#ff00ff' : '#00f3ff' }]}>
                {post.likes_count || 0} {(post.likes_count || 0) === 1 ? 'UNIT' : 'UNITS'}
              </Text>
            </View>
          </View>

          <View style={styles.captionContainer}>
            <Text style={styles.captionUsername}>@{post.profiles?.username || 'USER'}:</Text>
            <Paragraph style={styles.caption}>{post.caption}</Paragraph>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.commentsSection}>
            <Title style={styles.commentsTitle}>TERMINAL_LOGS</Title>
            <View style={styles.comingSoonContainer}>
              <Text style={styles.comingSoonText}>[NO_LOGS_FOUND]</Text>
              <Text style={styles.comingSoonSubtext}>
                COMMUNICATION_MODULE_OFFLINE
              </Text>
            </View>
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a12'
  },
  scrollContent: {
    paddingBottom: 20,
  },
  contentSurface: {
    margin: 10,
    backgroundColor: 'rgba(18, 18, 26, 0.6)',
    borderWidth: 1,
    borderColor: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a12'
  },
  loadingText: {
    color: '#00f3ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  avatarBorder: {
    borderWidth: 1,
    borderColor: '#00f3ff',
    borderRadius: 20,
  },
  avatar: {
    backgroundColor: '#00f3ff',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e0e0e0',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  mediaContainer: {
    width: '100%',
    backgroundColor: '#000',
    minHeight: 300,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  fullImage: {
    width: width - 22, // Account for surface margin & border
    height: width - 22,
    backgroundColor: '#111'
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000',
  },
  fullVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000'
  },
  // Retro Monitor Corners
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 15, height: 15, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#00f3ff' },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 15, height: 15, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#00f3ff' },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 15, height: 15, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#00f3ff' },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 15, height: 15, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#00f3ff' },

  actionsContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  likeSection: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  likeButton: {
    margin: 0,
    marginRight: 5,
  },
  likesText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  captionContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  captionUsername: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
    color: '#00f3ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    color: '#ccc',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
  },
  commentsSection: {
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  commentsTitle: {
    fontSize: 18,
    marginBottom: 15,
    fontWeight: 'bold',
    color: '#e0e0e0',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  comingSoonContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'rgba(0, 243, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  comingSoonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  comingSoonSubtext: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    paddingHorizontal: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});