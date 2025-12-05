// context/AppContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { supabase } from '../supabase';

const AppContext = createContext();

// Action types
const SET_USER = 'SET_USER';
const SET_POSTS = 'SET_POSTS';
const UPDATE_POST_LIKE = 'UPDATE_POST_LIKE';
const ADD_POSTS = 'ADD_POSTS';
const SET_LOADING = 'SET_LOADING';
const DELETE_POST = 'DELETE_POST';

// Initial state
const initialState = {
  user: null,
  posts: [],
  loading: true,
  loadingMore: false,
  hasMore: true,
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case SET_USER:
      return { ...state, user: action.payload };

    case SET_POSTS:
      return { ...state, posts: action.payload, hasMore: true };

    case ADD_POSTS:
      // Filter out duplicates just in case
      const newPosts = action.payload.filter(
        newPost => !state.posts.some(existingPost => existingPost.id === newPost.id)
      );
      return { ...state, posts: [...state.posts, ...newPosts] };

    case UPDATE_POST_LIKE:
      return {
        ...state,
        posts: state.posts.map(post =>
          post.id === action.payload.postId
            ? {
              ...post,
              user_has_liked: action.payload.liked,
              likes_count: action.payload.liked
                ? (post.likes_count || 0) + 1
                : Math.max(0, (post.likes_count || 1) - 1)
            }
            : post
        )
      };

    case DELETE_POST:
      return {
        ...state,
        posts: state.posts.filter(post => post.id !== action.payload)
      };

    case SET_LOADING:
      return { ...state, loading: action.payload };

    case 'SET_LOADING_MORE':
      return { ...state, loadingMore: action.payload };

    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };

    default:
      return state;
  }
}

// Provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    // Get initial user
    initializeAuth();

    // Listen for auth state changes (login, logout, signup)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        if (session?.user) {
          dispatch({ type: SET_USER, payload: session.user });
          // Clear posts when user changes to force fresh fetch
          if (event === 'SIGNED_IN') {
            dispatch({ type: SET_POSTS, payload: [] });
          }
        } else {
          dispatch({ type: SET_USER, payload: null });
          dispatch({ type: SET_POSTS, payload: [] });
        }
        dispatch({ type: SET_LOADING, payload: false });
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        dispatch({ type: SET_USER, payload: session.user });
      }
      dispatch({ type: SET_LOADING, payload: false });
    } catch (error) {
      console.error('Error getting session:', error);
      dispatch({ type: SET_LOADING, payload: false });
    }
  };

  const setPosts = (posts) => {
    dispatch({ type: SET_POSTS, payload: posts });
  };

  const addPosts = (posts) => {
    dispatch({ type: ADD_POSTS, payload: posts });
  };

  const updatePostLike = (postId, liked) => {
    dispatch({ type: UPDATE_POST_LIKE, payload: { postId, liked } });
  };

  const toggleLike = async (postId, currentlyLiked) => {
    if (!state.user) return { success: false, error: 'User not logged in' };

    try {
      if (currentlyLiked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', state.user.id);

        if (error) throw error;

        // Update local state after success
        updatePostLike(postId, false);
        return { success: true, liked: false };
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert([{ post_id: postId, user_id: state.user.id }]);

        if (error) throw error;

        // Update local state after success
        updatePostLike(postId, true);
        return { success: true, liked: true };
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      return { success: false, error: error.message };
    }
  };

  const fetchPostWithLikes = async (postId) => {
    if (!state.user) {
      console.log('fetchPostWithLikes: No user logged in');
      return null;
    }

    try {
      console.log('Fetching post:', postId);
      // Fetch post details
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (username)
        `)
        .eq('id', postId)
        .single();

      if (postError) {
        console.error('Supabase error fetching post:', postError);
        throw postError;
      }

      if (!postData) {
        console.error('No post data found for ID:', postId);
        return null;
      }

      // Get total likes count
      const { count, error: countError } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      if (countError) console.error('Error fetching likes count:', countError);

      // Check if current user has liked
      console.log(`Checking like for Post: ${postId}, User: ${state.user.id}`);
      const { data: userLike, error: likeError } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', state.user.id)
        .maybeSingle();

      if (likeError) console.error('Error fetching user like:', likeError);
      console.log('User like result:', userLike);

      return {
        ...postData,
        likes_count: count || 0,
        user_has_liked: !!userLike
      };
    } catch (error) {
      console.error('Error fetching post details:', error.message);
      return null;
    }
  };

  const fetchPosts = async (isInitial = false, currentUser = null) => {
    if (state.loading && !isInitial) return;
    if (!isInitial && !state.hasMore) return;

    try {
      if (isInitial) {
        dispatch({ type: SET_LOADING, payload: true });
      } else {
        dispatch({ type: 'SET_LOADING_MORE', payload: true });
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = currentUser?.id || user?.id;

      const PAGE_SIZE = 10;
      const from = isInitial ? 0 : state.posts.length;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (username)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch likes for each post
      const postsWithLikes = await Promise.all(data.map(async (post) => {
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
      }));

      if (isInitial) {
        dispatch({ type: SET_POSTS, payload: postsWithLikes });
        // If we got fewer than PAGE_SIZE, there are no more posts
        dispatch({ type: 'SET_HAS_MORE', payload: data.length === PAGE_SIZE });
      } else {
        dispatch({ type: ADD_POSTS, payload: postsWithLikes });
        // If we got fewer than PAGE_SIZE, there are no more posts
        dispatch({ type: 'SET_HAS_MORE', payload: data.length === PAGE_SIZE });
      }

    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      dispatch({ type: SET_LOADING, payload: false });
      dispatch({ type: 'SET_LOADING_MORE', payload: false });
    }
  };

  const deletePost = async (postId, imageUrl) => {
    if (!state.user) return { success: false, error: 'User not authenticated' };

    try {
      // First, delete the image from storage
      if (imageUrl) {
        // Extract the file path from the URL
        const urlParts = imageUrl.split('/posts/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1].split('?')[0]; // Remove query params if any
          const { error: storageError } = await supabase.storage
            .from('posts')
            .remove([filePath]);

          if (storageError) {
            console.error('Error deleting image:', storageError);
          }
        }
      }

      // Delete all likes associated with the post
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', postId);

      // Delete the post from database
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', state.user.id); // Ensure user owns the post

      if (deleteError) throw deleteError;

      // Update local state
      dispatch({ type: DELETE_POST, payload: postId });

      return { success: true };
    } catch (error) {
      console.error('Error deleting post:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user: state.user,
    posts: state.posts,
    loading: state.loading,
    loadingMore: state.loadingMore,
    hasMore: state.hasMore,
    setPosts,
    addPosts,
    toggleLike,
    fetchPostWithLikes,
    updatePostLike,
    deletePost,
    fetchPosts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Custom hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
