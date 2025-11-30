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

// Initial state
const initialState = {
  user: null,
  posts: [],
  loading: true,
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case SET_USER:
      return { ...state, user: action.payload };
    
    case SET_POSTS:
      return { ...state, posts: action.payload };
    
    case ADD_POSTS:
      return { ...state, posts: [...state.posts, ...action.payload] };
    
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
    
    case SET_LOADING:
      return { ...state, loading: action.payload };
    
    default:
      return state;
  }
}

// Provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    // Get initial user
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      dispatch({ type: SET_USER, payload: user });
      dispatch({ type: SET_LOADING, payload: false });
    } catch (error) {
      console.error('Error getting user:', error);
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
    if (!state.user) return;

    // Optimistic update
    updatePostLike(postId, !currentlyLiked);

    try {
      if (currentlyLiked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', state.user.id);
        
        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .upsert([{ post_id: postId, user_id: state.user.id }], {
            onConflict: 'user_id,post_id',
            ignoreDuplicates: false
          });
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update on error
      updatePostLike(postId, currentlyLiked);
    }
  };

  const fetchPostWithLikes = async (postId) => {
    if (!state.user) return null;

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
      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      // Check if current user has liked
      const { data: userLike } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', state.user.id)
        .maybeSingle();

      return {
        ...postData,
        likes_count: count || 0,
        user_has_liked: !!userLike
      };
    } catch (error) {
      console.error('Error fetching post:', error);
      return null;
    }
  };

  const value = {
    user: state.user,
    posts: state.posts,
    loading: state.loading,
    setPosts,
    addPosts,
    toggleLike,
    fetchPostWithLikes,
    updatePostLike,
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
