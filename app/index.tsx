import { StatusBar } from 'expo-status-bar';
import React from 'react';
import LoginScreen from './screens/LoginScreen';

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <LoginScreen />
    </>
  );
}