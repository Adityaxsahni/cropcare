import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Hatch, Kicker, Meta, Screen, Title } from '../components/ui';
import { useApp } from '../state';
import { FONTS, RADIUS, useColors } from '../theme';

type Step = 'language' | 'tips' | 'sharing';

/** First run: language, photo tips, then the sharing question when a server exists. Nothing else is asked. */
export default function Onboarding() {
  const { s, language, setLanguage, sharingAvailable, consent, setConsent, completeOnboarding } = useApp();
  const c = useColors();
  const [step, setStep] = useState<Step>('language');

  const finish = () => {
    completeOnboarding();
    router.replace('/');
  };
  const afterTips = () => (sharingAvailable && consent === null ? setStep('sharing') : finish());

  if (step === 'language') {
    return (
      <Screen>
        <View style={{ height: 24 }} />
        <Kicker>CropCare</Kicker>
        <Title>अपनी भाषा चुनें</Title>
        <Title>Choose your language</Title>
        {(['hi', 'en'] as const).map((lang) => (
          <Pressable
            key={lang}
            accessibilityRole="button"
            accessibilityState={{ selected: language === lang }}
            onPress={() => {
              setLanguage(lang);
              setStep('tips');
            }}
            style={({ pressed }) => [styles.langCard, { borderColor: language === lang ? c.text : c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.langName, { color: c.text }]}>{lang === 'hi' ? 'हिंदी' : 'English'}</Text>
            <Text style={{ color: c.muted, fontSize: 16 }}>{lang === 'hi' ? 'सलाह हिंदी में, बोलकर भी' : 'Advice in English, read aloud too'}</Text>
          </Pressable>
        ))}
      </Screen>
    );
  }

  if (step === 'tips') {
    return (
      <Screen footer={<Button label={sharingAvailable && consent === null ? s.obNext : s.obStart} onPress={afterTips} style={{ flex: 1 }} />}>
        <View style={{ height: 24 }} />
        <Kicker>{s.obTipsKicker}</Kicker>
        <Title>{s.obTipsTitle}</Title>
        <Hatch height={140} caption={s.cameraHint} />
        {s.obTips.map((tip, i) => (
          <View key={tip} style={styles.tip}>
            <Text style={[styles.tipNumber, { color: c.accent }]}>{i + 1}</Text>
            <Body>{tip}</Body>
          </View>
        ))}
        <Meta>{s.obPrivacy}</Meta>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ height: 24 }} />
      <Kicker>{s.obSharingKicker}</Kicker>
      <Title>{s.shareTitle}</Title>
      <Card>
        <Body>{s.shareBody}</Body>
      </Card>
      <Button
        label={s.shareYes}
        onPress={() => {
          setConsent('yes');
          finish();
        }}
      />
      <Button
        label={s.shareNo}
        variant="secondary"
        onPress={() => {
          setConsent('no');
          finish();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  langCard: { borderWidth: 1.5, borderRadius: RADIUS, padding: 18, gap: 4, minHeight: 88, justifyContent: 'center' },
  langName: { fontFamily: FONTS.serif, fontSize: 28 },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipNumber: { fontFamily: FONTS.serif, fontSize: 24, minWidth: 18, lineHeight: 28 },
});
