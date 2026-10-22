import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useApp } from '../../state';
import { FONTS, useColors } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function TabLayout() {
  const c = useColors();
  const { s, language } = useApp();
  const icon = (name: IconName) =>
    function TabIcon({ color }: { color: ColorValue }) {
      return <Ionicons name={name} size={24} color={String(color)} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        // Hindi labels stay at 16 px (docs/DESIGN.md), so the bar is taller for them.
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.border, height: language === 'en' ? 68 : 80, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: language === 'en' ? { fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 1 } : { fontSize: 16, lineHeight: 24 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: language === 'en' ? s.tabs.check.toUpperCase() : s.tabs.check, tabBarIcon: icon('leaf-outline') }} />
      <Tabs.Screen name="history" options={{ title: language === 'en' ? s.tabs.history.toUpperCase() : s.tabs.history, tabBarIcon: icon('time-outline') }} />
      <Tabs.Screen name="guide" options={{ title: language === 'en' ? s.tabs.guide.toUpperCase() : s.tabs.guide, tabBarIcon: icon('book-outline') }} />
      <Tabs.Screen name="about" options={{ title: language === 'en' ? s.tabs.about.toUpperCase() : s.tabs.about, tabBarIcon: icon('information-circle-outline') }} />
    </Tabs>
  );
}
