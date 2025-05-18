// app/(tabs)/_layout.tsx
import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack
      initialRouteName="chat-and-graph"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="graph" />
      <Stack.Screen name="chat-and-graph" />
      <Stack.Screen name="ChatComponent" />
    </Stack>
  );
}
