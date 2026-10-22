import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BUTTON_HEIGHT, FONT, RADIUS, useColors } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const body = <View style={styles.body}>{children}</View>;
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function Button({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const primary = variant === 'primary';
  const fg = primary ? c.onPrimary : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? c.primary : c.surface, borderColor: c.primary, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={24} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>{children}</Text>;
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const c = useColors();
  return <Text style={[styles.text, { color: muted ? c.muted : c.text }]}>{children}</Text>;
}

export function Card({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'warn' | 'danger' }) {
  const c = useColors();
  const borderColor = tone === 'warn' ? c.warn : tone === 'danger' ? c.danger : c.border;
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor, borderLeftWidth: tone === 'plain' ? 1 : 5 }]}>{children}</View>;
}

export function TestBuildBanner({ text }: { text: string }) {
  const c = useColors();
  return (
    <View accessibilityRole="alert" style={[styles.card, { backgroundColor: c.surface, borderColor: c.danger, borderLeftWidth: 5 }]}>
      <Text style={[styles.text, { color: c.danger, fontWeight: '700' }]}>{text}</Text>
    </View>
  );
}

export function Loading({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={[styles.text, { color: c.text, marginTop: 12 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  body: { flex: 1, padding: 16, gap: 16 },
  button: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: RADIUS,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  buttonText: { fontSize: FONT.body, fontWeight: '600' },
  heading: { fontSize: FONT.heading, fontWeight: '700', lineHeight: 34 },
  text: { fontSize: FONT.body, lineHeight: 27 },
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 16, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
