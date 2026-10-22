import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../state';
import { BUTTON_HEIGHT, FONTS, RADIUS, sizes, useColors } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function useType() {
  return sizes(useApp().language);
}

export function Screen({ children, scroll = true, footer, edges = ['top', 'left', 'right'] }: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const c = useColors();
  const body = <View style={styles.body}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
      {footer ? <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.bg }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/** The thin line at the top of each tab: product name left, language switch right. */
export function TopBar({ right }: { right?: ReactNode }) {
  const c = useColors();
  const { s, language, setLanguage } = useApp();
  return (
    <View style={styles.topBar}>
      <Text style={[styles.mono, { color: c.text, fontSize: 13, letterSpacing: 1.5 }]}>CROPCARE</Text>
      {right ?? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.switchLanguage}
          onPress={() => setLanguage(language === 'hi' ? 'en' : 'hi')}
          hitSlop={12}
          style={({ pressed }) => [styles.langSwitch, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ color: c.text, fontSize: 16 }}>{language === 'hi' ? 'English' : 'हिंदी'}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Kicker({ children, tone = 'accent' }: { children: string; tone?: 'accent' | 'muted' }) {
  const c = useColors();
  const { language } = useApp();
  const latin = language === 'en';
  return (
    <Text style={[latin ? styles.mono : null, { color: tone === 'accent' ? c.accent : c.muted, fontSize: useType().kicker, letterSpacing: latin ? 1.4 : 0 }]}>
      {latin ? children.toUpperCase() : children}
    </Text>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.serif, { color: c.text, fontSize: useType().title, lineHeight: 38 }]}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.serif, { color: c.text, fontSize: useType().heading, lineHeight: 30 }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const c = useColors();
  return <Text style={{ color: muted ? c.muted : c.text, fontSize: useType().body, lineHeight: 26 }}>{children}</Text>;
}

/** Small mono line for facts: dates, counts, versions. Hindi uses the normal face at 16 px. */
export function Meta({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'good' }) {
  const c = useColors();
  const { language } = useApp();
  const color = tone === 'accent' ? c.accent : tone === 'good' ? c.good : c.muted;
  return <Text style={[language === 'en' ? styles.mono : null, { color, fontSize: useType().meta, lineHeight: 22 }]}>{children}</Text>;
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
  variant?: 'primary' | 'secondary' | 'inverse' | 'inverseOutline';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const primary = variant === 'primary';
  // inverse and inverseOutline: paper filled and paper outlined buttons on the black camera screen, in both colour schemes
  const inverse = variant === 'inverse';
  const outline = variant === 'inverseOutline';
  const fg = inverse ? '#1E1A16' : outline ? '#FBF8F2' : primary ? c.onPrimary : c.text;
  const bg = inverse ? '#FBF8F2' : primary ? c.primary : 'transparent';
  const border = inverse || outline ? '#FBF8F2' : primary ? c.primary : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Square icon button that sits beside a primary button (6 px corners, never a circle). */
export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { borderColor: c.text, backgroundColor: c.bg, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={24} color={c.text} />
    </Pressable>
  );
}

export function Chip({ label, selected = false, onPress, tone }: { label: string; selected?: boolean; onPress?: () => void; tone?: 'accent' | 'good' }) {
  const c = useColors();
  const { language } = useApp();
  const toneColor = tone === 'accent' ? c.accent : tone === 'good' ? c.good : null;
  const bg = selected ? c.primary : 'transparent';
  const fg = selected ? c.onPrimary : toneColor ?? c.text;
  const border = selected ? c.primary : toneColor ?? c.border;
  const content = <Text style={[language === 'en' ? styles.mono : null, { color: fg, fontSize: language === 'en' ? 13 : 16 }]}>{label}</Text>;
  if (!onPress) return <View style={[styles.chip, { backgroundColor: bg, borderColor: border }]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, styles.chipTap, { backgroundColor: bg, borderColor: border, opacity: pressed ? 0.75 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Card({ children, onPress, accessibilityLabel, style }: { children: ReactNode; onPress?: () => void; accessibilityLabel?: string; style?: ViewStyle }) {
  const c = useColors();
  const box = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (!onPress) return <View style={box}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [box, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

/**
 * Diagonal hatching where a photo would go. CropCare never keeps photos, so
 * the space says what it stands for instead of showing a stock picture.
 */
export function Hatch({ height, width: fixedWidth, caption, rounded = true }: { height: number; width?: number; caption?: string; rounded?: boolean }) {
  const c = useColors();
  const { language } = useApp();
  const [measured, setMeasured] = useState(0);
  const width = fixedWidth ?? measured;
  const gap = 9;
  const lines = width ? Math.ceil((width + height) / gap) : 0;
  return (
    <View
      accessible={!!caption}
      accessibilityLabel={caption}
      onLayout={fixedWidth ? undefined : (e) => setMeasured(e.nativeEvent.layout.width)}
      style={{ height, width: fixedWidth, backgroundColor: c.sunken, overflow: 'hidden', borderRadius: rounded ? RADIUS : 0 }}
    >
      {Array.from({ length: lines }, (_, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: i * gap - height, top: -height / 2, width: 1.5, height: height * 2, backgroundColor: c.hatch, transform: [{ rotate: '45deg' }] }}
        />
      ))}
      {caption ? (
        <View style={[styles.hatchTag, { backgroundColor: c.surface }]}>
          <Text style={[language === 'en' ? styles.mono : null, { color: c.muted, fontSize: language === 'en' ? 11 : 16 }]}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Two-column facts block with hairlines, like a spec sheet. */
export function InfoGrid({ items }: { items: { label: string; value: string; tone?: 'accent' | 'good' }[] }) {
  const c = useColors();
  const { language } = useApp();
  return (
    <View style={[styles.grid, { borderColor: c.border, backgroundColor: c.surface }]}>
      {items.map((item, i) => (
        <View
          key={item.label}
          style={[styles.gridCell, { borderColor: c.border, borderRightWidth: i % 2 === 0 ? 1 : 0, borderBottomWidth: i < items.length - 2 ? 1 : 0 }]}
        >
          <Text style={[language === 'en' ? styles.mono : null, { color: c.muted, fontSize: language === 'en' ? 11 : 16, letterSpacing: language === 'en' ? 1 : 0 }]}>
            {language === 'en' ? item.label.toUpperCase() : item.label}
          </Text>
          <Text style={{ color: item.tone === 'accent' ? c.accent : item.tone === 'good' ? c.good : c.text, fontSize: 17, fontWeight: '600', marginTop: 4 }}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A small mono section label with a hairline, as in "SAVED BUT NEVER BEEN". */
export function SectionLabel({ children }: { children: string }) {
  const c = useColors();
  return (
    <View style={[styles.sectionLabel, { borderTopColor: c.border }]}>
      <Kicker tone="muted">{children}</Kicker>
    </View>
  );
}

export function Notice({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'danger' }) {
  const c = useColors();
  const color = tone === 'danger' ? c.danger : c.warn;
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: color, backgroundColor: c.surface }]}>
      <Text style={{ color, fontSize: 17, lineHeight: 25, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

export function TestBuildBanner({ text }: { text: string }) {
  return <Notice tone="danger">{text}</Notice>;
}

export function Loading({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <ActivityIndicator size="large" color={c.accent} />
      <Text style={{ color: c.text, fontSize: 17, marginTop: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 },
  footer: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, flexDirection: 'row', gap: 12 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
  langSwitch: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  serif: { fontFamily: FONTS.serif, fontWeight: '400' },
  mono: { fontFamily: FONTS.mono },
  button: { minHeight: BUTTON_HEIGHT, borderRadius: RADIUS, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  iconButton: { width: BUTTON_HEIGHT, height: BUTTON_HEIGHT, borderRadius: RADIUS, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chip: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  chipTap: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { borderRadius: RADIUS, borderWidth: 1, padding: 14, gap: 8 },
  hatchTag: { position: 'absolute', left: 8, bottom: 8, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  grid: { borderWidth: 1, borderRadius: RADIUS, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  gridCell: { width: '50%', padding: 12 },
  sectionLabel: { borderTopWidth: 1, paddingTop: 14, marginTop: 8 },
  notice: { borderWidth: 1.5, borderRadius: RADIUS, padding: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
