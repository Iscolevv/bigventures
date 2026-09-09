import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#1f5f4f' }, headerTintColor: 'white' }}>
      <Stack.Screen name="index" options={{ title: 'My trips' }} />
      <Stack.Screen name="new-trip" options={{ title: 'New trip', presentation: 'modal' }} />
      <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
      <Stack.Screen name="check/[tripId]" options={{ title: 'Vehicle check' }} />
      <Stack.Screen name="drop/[id]" options={{ title: 'Delivery' }} />
      <Stack.Screen name="add-drop/[tripId]" options={{ title: 'Add drop', presentation: 'modal' }} />
      <Stack.Screen name="fuel/[tripId]" options={{ title: 'Fuel', presentation: 'modal' }} />
      <Stack.Screen name="documents" options={{ title: 'My documents' }} />
    </Stack>
  );
}
