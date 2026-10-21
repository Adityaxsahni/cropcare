import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ModelProvider } from '../model';
import { AppStateProvider, useApp } from '../state';
import { FONT, useColors } from '../theme';

function AppStack() {
  const c = useColors();
  const { s } = useApp();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerTitleStyle: { fontSize: FONT.body },
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: s.appName }} />
      <Stack.Screen name="camera" options={{ title: s.checkLeaf }} />
      <Stack.Screen name="result/[id]" options={{ title: s.appName }} />
      <Stack.Screen name="unsure" options={{ title: s.unsureTitle }} />
      <Stack.Screen name="history" options={{ title: s.history }} />
      <Stack.Screen name="about" options={{ title: s.about }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <ModelProvider>
          <StatusBar style="auto" />
          <AppStack />
        </ModelProvider>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
