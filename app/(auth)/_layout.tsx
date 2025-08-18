
//this file is the layout of the entire app in the sense that it sets up the
//navigation structure. So it is responsible for defining the screens and their
//navigation options

// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}