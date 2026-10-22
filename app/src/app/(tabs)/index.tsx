import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Hatch, Kicker, Loading, Meta, Notice, Screen, TestBuildBanner, Title, TopBar } from '../../components/ui';
import { CROPS, labelsOf, type Crop } from '../../lib/crops';
import { confidenceLevel } from '../../lib/postprocess';
import { IS_TEST_MODEL } from '../../model';
import { useApp } from '../../state';
import { FONTS, useColors } from '../../theme';

export default function Check() {
  const { ready, s, language, onboarded, lastCrop, setLastCrop, history, advice, sharingAvailable, consent, setConsent } = useApp();
  const c = useColors();
  if (!ready) return <Loading label="…" />;
  if (!onboarded) return <Redirect href="/onboarding" />;

  const labels = Object.keys(advice.classes);
  const others = CROPS.filter((crop) => crop !== lastCrop);
  const last = history.find((h) => !h.unsure);
  const start = (crop: Crop) => {
    setLastCrop(crop);
    router.push({ pathname: '/camera', params: { crop } });
  };

  return (
    <Screen>
      <TopBar />
      {IS_TEST_MODEL ? <TestBuildBanner text={s.testBuild} /> : null}
      <Kicker>{s.checkKicker}</Kicker>
      <Title>{s.checkTitle}</Title>
      <Body muted>{s.checkSub}</Body>

      <Card style={styles.featured}>
        <Hatch height={150} caption={`${s.cropsLower[lastCrop]} · ${s.conditionsCount(labelsOf(lastCrop, labels).length)}`} />
        <View style={styles.featuredRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cropName, { color: c.text }]}>{s.crops[lastCrop]}</Text>
            <Meta>{language === 'en' ? 'Hindi and English · offline' : 'हिंदी और English · ऑफ़लाइन'}</Meta>
          </View>
          <Button label={s.checkThis} icon="camera-outline" onPress={() => start(lastCrop)} style={{ paddingHorizontal: 16 }} />
        </View>
      </Card>

      <View style={styles.row}>
        {others.map((crop) => (
          <Card key={crop} onPress={() => setLastCrop(crop)} accessibilityLabel={`${s.crops[crop]}, ${s.tapToChoose}`} style={styles.small}>
            <Text style={[styles.smallName, { color: c.text }]}>{s.crops[crop]}</Text>
            <Meta>{s.conditionsCount(labelsOf(crop, labels).length)}</Meta>
            <Meta tone="accent">{s.tapToChoose}</Meta>
          </Card>
        ))}
      </View>

      {last ? (
        <Card onPress={() => router.push({ pathname: '/result/[id]', params: { id: last.id } })} accessibilityLabel={s.lastCheck}>
          <Kicker tone="muted">{s.lastCheck}</Kicker>
          <Text style={[styles.smallName, { color: c.text }]}>{advice.classes[last.label]?.[language].name ?? last.label}</Text>
          <Meta>
            {new Date(last.createdAt).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })} {'·'} {s.confidence}: {s.levels[confidenceLevel(last.confidence)]}
          </Meta>
        </Card>
      ) : null}

      {sharingAvailable && consent === null ? (
        <Card>
          <Body>{s.shareTitle}</Body>
          <Body muted>{s.shareBody}</Body>
          <View style={styles.row}>
            <Button label={s.shareYes} onPress={() => setConsent('yes')} style={{ flex: 1 }} />
            <Button label={s.shareNo} variant="secondary" onPress={() => setConsent('no')} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}

      {advice.review.reviewed ? null : <Notice>{s.notReviewed}</Notice>}
      <Meta>{s.otherCrops}</Meta>
    </Screen>
  );
}

const styles = StyleSheet.create({
  featured: { padding: 10, gap: 12 },
  featuredRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingBottom: 4 },
  cropName: { fontFamily: FONTS.serif, fontSize: 26 },
  row: { flexDirection: 'row', gap: 12 },
  small: { flex: 1, gap: 4 },
  smallName: { fontFamily: FONTS.serif, fontSize: 21 },
});
