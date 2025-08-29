// app/_layout.tsx - Fixed Root Layout without infinite loop
import { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CartProvider } from '../../src/contexts/CartContext';
import { OrderFlowProvider } from '../../src/contexts/OrderFlowContext';
import { supabase } from '../../src/lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      setIsInitialized(true);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inSalesGroup = segments[0] === '(sales)';

    // Only redirect if we're not already in the correct place
    if (!session && !inAuthGroup) {
      // Redirect to login if not authenticated and not already in auth
      router.replace('/(auth)/login');
    } else if (session && !inSalesGroup && inAuthGroup) {
      // Only redirect from auth to sales if logged in and currently in auth
      router.replace('/(sales)');
    }
  }, [session, isInitialized]); // Removed segments from dependencies to prevent loops

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#E74C3C" />
      </View>
    );
  }

  return (
    <CartProvider>
      <OrderFlowProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(sales)" options={{ headerShown: false }} />
        </Stack>
      </OrderFlowProvider>
    </CartProvider>
  );
}