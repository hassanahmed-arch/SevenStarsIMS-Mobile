import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
const supabaseUrl = 'https://xgfjbredcxetsjkocqpv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZmpicmVkY3hldHNqa29jcXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOTUyMjAsImV4cCI6MjA2OTk3MTIyMH0.wpN4jWjmCp51fHJ5bCuAY0omhBcbS_4uryxDJqEvp8w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});