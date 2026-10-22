import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RADIUS, useColors } from '../theme';

const Ctx = createContext<(message: string) => void>(() => {});

/** One short confirmation at a time, read out by screen readers, gone after 2.5 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 2500);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {message ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 88 }]}>
          <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.toast, { backgroundColor: c.primary }]}>
            <Text style={{ color: c.onPrimary, fontSize: 17, fontWeight: '600' }}>{message}</Text>
          </View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  toast: { borderRadius: RADIUS, paddingHorizontal: 16, paddingVertical: 12 },
});
