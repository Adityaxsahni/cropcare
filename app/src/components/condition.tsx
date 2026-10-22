import * as Speech from 'expo-speech';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AdviceEntry } from '../lib/advice';
import { cropOf } from '../lib/crops';
import { useApp } from '../state';
import { FONTS, useColors } from '../theme';
import { Body, Button, Chip, ChipRow, Hatch, IconButton, Kicker, Meta, Notice, Title } from './ui';

const SPEECH_LANG = { hi: 'hi-IN', en: 'en-IN' } as const;

/** Speaks the advice in the current language, and says so when no voice for it is installed. */
export function useListen(entry: AdviceEntry | undefined) {
  const { s, language } = useApp();
  const [speaking, setSpeaking] = useState(false);
  const [voiceMissing, setVoiceMissing] = useState(false);
  useEffect(() => () => void Speech.stop(), []);

  async function toggle() {
    if (!entry) return;
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
    // Some phones list no voices at all; only warn when the list is known and has none for this language.
    const hasVoice = voices.length === 0 || voices.some((v) => v.language.toLowerCase().startsWith(language));
    setVoiceMissing(!hasVoice);
    if (!hasVoice) return;
    const text = entry[language];
    setSpeaking(true);
    Speech.speak([text.name, ...text.steps, s.kvkNote].join('. '), {
      language: SPEECH_LANG[language],
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }
  return { speaking, voiceMissing, toggle };
}

/** Header, name and steps for one condition; `facts` and `extra` are filled in by the result screen. */
export function ConditionDetail({ label, entry, caption, chips, facts, extra }: {
  label: string;
  caption: string;
  entry: AdviceEntry;
  chips?: ReactNode;
  facts?: ReactNode;
  extra?: ReactNode;
}) {
  const { s, language, advice } = useApp();
  const c = useColors();
  const crop = cropOf(label);
  const text = entry[language];
  const other = entry[language === 'hi' ? 'en' : 'hi'];
  return (
    <>
      <View>
        <Hatch height={190} caption={caption} rounded={false} />
        <SafeAreaView edges={['top']} style={styles.backWrap}>
          <IconButton icon="chevron-back" label={s.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </SafeAreaView>
      </View>
      <View style={styles.body}>
        {crop ? <Kicker>{s.crops[crop]}</Kicker> : null}
        <Title>{text.name.replace(/^[^:]+:\s*/, '')}</Title>
        <Meta>{other.name}</Meta>
        <ChipRow>
          <Chip label={entry.healthy ? s.healthyTag : s.needsAction} tone={entry.healthy ? 'good' : 'accent'} />
          <Chip label={advice.review.reviewed ? s.reviewedShort : s.draftShort} />
          {chips}
        </ChipRow>
        {facts}
        {advice.review.reviewed ? <Meta>{s.reviewedBy(advice.review.reviewer)}</Meta> : <Notice>{s.notReviewed}</Notice>}
        <Kicker tone="muted">{s.whatToDo}</Kicker>
        <View style={{ gap: 12 }}>
          {text.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={[styles.stepNumber, { color: c.accent }]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Body>{step}</Body>
              </View>
            </View>
          ))}
        </View>
        <Meta>{s.kvkNote}</Meta>
        {extra}
      </View>
    </>
  );
}

export function ListenFooter({ entry, secondary }: { entry: AdviceEntry; secondary?: ReactNode }) {
  const { s } = useApp();
  const { speaking, voiceMissing, toggle } = useListen(entry);
  return (
    <View style={{ flex: 1, gap: 8 }}>
      {voiceMissing ? <Meta tone="accent">{s.noHindiVoice}</Meta> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button label={speaking ? s.stopListening : s.listen} icon={speaking ? 'stop' : 'volume-high-outline'} onPress={toggle} style={{ flex: 1 }} />
        {secondary}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backWrap: { position: 'absolute', top: 0, left: 0, padding: 12 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 14 },
  step: { flexDirection: 'row', gap: 12 },
  stepNumber: { fontFamily: FONTS.serif, fontSize: 22, minWidth: 18, lineHeight: 26 },
});
