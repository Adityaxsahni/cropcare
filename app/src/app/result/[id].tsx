import * as Speech from 'expo-speech';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Heading, Screen } from '../../components/ui';
import { confidenceLevel } from '../../lib/postprocess';
import { useApp } from '../../state';
import { FONT, useColors } from '../../theme';

const SPEECH_LANG = { hi: 'hi-IN', en: 'en-IN' } as const;

export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, language, history, answerScan, advice } = useApp();
  const c = useColors();
  const [speaking, setSpeaking] = useState(false);
  const [voiceMissing, setVoiceMissing] = useState(false);
  const scan = history.find((x) => x.id === id);
  const entry = scan ? advice.classes[scan.label] : undefined;

  useEffect(() => () => void Speech.stop(), []);

  if (!scan || !entry) {
    return (
      <Screen>
        <Body>{s.scanNotFound}</Body>
        <Button label={s.goHome} icon="home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const text = entry[language];
  const other = entry[language === 'hi' ? 'en' : 'hi'];
  const level = confidenceLevel(scan.confidence);
  const percent = Math.round(scan.confidence * 100);

  async function listen() {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    const lang = SPEECH_LANG[language];
    const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
    // Some phones report no voices at all; only warn when the list is known and has no Hindi voice.
    const hasVoice = voices.length === 0 || voices.some((v) => v.language.toLowerCase().startsWith(language));
    setVoiceMissing(!hasVoice);
    if (!hasVoice) return;
    setSpeaking(true);
    Speech.speak([text.name, ...text.steps, s.kvkNote].join('. '), {
      language: lang,
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  return (
    <Screen>
      <Card tone={entry.healthy ? 'plain' : 'danger'}>
        <Heading>{text.name}</Heading>
        <Body muted>{other.name}</Body>
        <Text style={[styles.confidence, { color: c.text }]}>
          {s.confidence}: {s.levels[level]} ({percent}%)
        </Text>
      </Card>

      {!advice.review.reviewed ? (
        <Card tone="warn">
          <Body>{s.notReviewed}</Body>
        </Card>
      ) : (
        <Body muted>{s.reviewedBy(advice.review.reviewer)}</Body>
      )}

      <Heading>{s.whatToDo}</Heading>
      <View style={{ gap: 10 }}>
        {text.steps.map((step, i) => (
          <View key={i} style={styles.step}>
            <Text style={[styles.stepNumber, { color: c.primary }]}>{i + 1}.</Text>
            <Text style={[styles.stepText, { color: c.text }]}>{step}</Text>
          </View>
        ))}
      </View>
      <Body muted>{s.kvkNote}</Body>

      <Button label={speaking ? s.stopListening : s.listen} icon={speaking ? 'stop' : 'volume-high'} variant="secondary" onPress={listen} />
      {voiceMissing ? <Body muted>{s.noHindiVoice}</Body> : null}

      <Card>
        <Body>{s.wasCorrect}</Body>
        {scan.answer ? (
          <Body muted>{s.thanks}</Body>
        ) : (
          <View style={styles.row}>
            <Button label={s.yes} icon="checkmark" onPress={() => answerScan(scan.id, 'yes')} style={styles.half} />
            <Button label={s.no} icon="close" variant="secondary" onPress={() => answerScan(scan.id, 'no')} style={styles.half} />
          </View>
        )}
      </Card>

      <Button label={s.tryAgain} icon="camera" variant="secondary" onPress={() => router.replace('/camera')} />
      <Button label={s.goHome} icon="home" variant="secondary" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  confidence: { fontSize: FONT.body, fontWeight: '600', marginTop: 4 },
  step: { flexDirection: 'row', gap: 8 },
  stepNumber: { fontSize: FONT.body, fontWeight: '700', minWidth: 24, lineHeight: 27 },
  stepText: { fontSize: FONT.body, lineHeight: 27, flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
