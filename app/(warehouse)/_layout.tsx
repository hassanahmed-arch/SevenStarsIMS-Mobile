// app/(warehouse)/_layout.tsx
import { Stack } from 'expo-router';

export default function WarehouseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}