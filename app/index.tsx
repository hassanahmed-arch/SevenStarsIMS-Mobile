// app/index.tsx
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../src/lib/supabase';

export default function Index() {
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.replace('/(auth)/login' as any);
      return;
    }

    // Fetch user role and redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      switch (profile.role) {
        case 'admin':
          router.replace('/(admin)' as any);
          break;
        case 'warehouse_operator':
          router.replace('/(warehouse)' as any);
          break;
        case 'sales_agent':
        default:
          router.replace('/(sales)' as any);
          break;
      }
    } else {
      router.replace('/(auth)/login' as any);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#E74C3C" />
    </View>
  );
}