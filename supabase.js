
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tmkkujamfxbfeczsjeoj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRta2t1amFtZnhiZmVjenNqZW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNTE0ODgsImV4cCI6MjA3NzcyNzQ4OH0.3z2BB-pht7DYwib3Dpv6rYUID1kgrdrTgTEFqHtRTcc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});