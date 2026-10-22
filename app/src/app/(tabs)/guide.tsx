import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Card, Hatch, Kicker, Meta, Screen, SectionLabel, Title, TopBar } from '../../components/ui';
import { CROPS, labelsOf } from '../../lib/crops';
import { useApp } from '../../state';
import { FONTS, useColors } from '../../theme';

/** Every condition and its advice, readable with no camera and no internet. */
export default function Guide() {
  const { s, language, advice } = useApp();
  const c = useColors();
  const labels = Object.keys(advice.classes);
  return (
    <Screen>
      <TopBar />
      <Kicker>{s.guideKicker}</Kicker>
      <Title>{s.guideTitle}</Title>
      <Body muted>{s.guideSub}</Body>
      {CROPS.map((crop) => (
        <View key={crop} style={{ gap: 10 }}>
          <SectionLabel>{`${s.crops[crop]} · ${s.conditionsCount(labelsOf(crop, labels).length)}`}</SectionLabel>
          {labelsOf(crop, labels).map((label) => {
            const entry = advice.classes[label];
            const name = entry[language].name.replace(/^[^:]+:\s*/, '');
            return (
              <Card key={label} onPress={() => router.push({ pathname: '/condition/[label]', params: { label } })} accessibilityLabel={name} style={styles.row}>
                <Hatch height={52} width={52} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.name, { color: c.text }]}>{name}</Text>
                  <Meta tone={entry.healthy ? 'good' : 'accent'}>{entry.healthy ? s.healthyTag : s.needsAction}</Meta>
                </View>
                <Meta tone="accent">{s.read}</Meta>
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  name: { fontFamily: FONTS.serif, fontSize: 19, lineHeight: 25 },
});
