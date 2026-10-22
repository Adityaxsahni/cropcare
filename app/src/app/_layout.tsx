import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '../components/toast';
import { strings } from '../i18n';
import { ModelProvider } from '../model';
import { AppStateProvider } from '../state';
import { RADIUS, useColors } from '../theme';

function AppStack() {
  const c = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="camera" />
      <Stack.Screen name="result/[id]" />
      <Stack.Screen name="unsure" />
      <Stack.Screen name="condition/[label]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <ModelProvider>
          <ToastProvider>
            <StatusBar style="auto" />
            <AppStack />
          </ToastProvider>
        </ModelProvider>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

/**
 * Shown instead of a blank screen if a screen crashes. It cannot rely on app
 * state (that may be what failed), so it shows both languages.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: c.text, fontSize: 26 }}>{strings.hi.errorTitle}</Text>
      <Text style={{ color: c.text, fontSize: 17 }}>{strings.hi.errorBody}</Text>
      <Text style={{ color: c.muted, fontSize: 17 }}>{strings.en.errorTitle}. {strings.en.errorBody}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>{error.message}</Text>
      <Text
        accessibilityRole="button"
        onPress={retry}
        style={{ marginTop: 8, color: c.onPrimary, backgroundColor: c.primary, fontSize: 17, fontWeight: '600', textAlign: 'center', paddingVertical: 16, borderRadius: RADIUS, overflow: 'hidden' }}
      >
        {strings.hi.retry} / {strings.en.retry}
      </Text>
    </View>
  );
}
