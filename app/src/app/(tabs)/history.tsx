import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Card, Chip, ChipRow, Hatch, Kicker, Meta, Title, TopBar } from '../../components/ui';
import { CROPS, cropOf, type Crop } from '../../lib/crops';
import { filterByCrop } from '../../lib/history';
import { confidenceLevel } from '../../lib/postprocess';
import { useApp } from '../../state';
import { FONTS, useColors } from '../../theme';

export default function History() {
  const { s, language, history, advice } = useApp();
  const c = useColors();
  const [crop, setCrop] = useState<Crop | 'all'>('all');
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  const answered = history.filter((h) => !h.unsure);
  const needAction = answered.filter((h) => advice.classes[h.label] && !advice.classes[h.label].healthy).length;
  const shown = filterByCrop(history, crop);

  const header = (
    <View style={styles.header}>
      <TopBar />
      <Kicker>{s.historyKicker}</Kicker>
      <Title>{s.historyTitle}</Title>
      <Meta>{s.historyMeta(answered.length, needAction)}</Meta>
      <ChipRow>
        <Chip label={s.all} selected={crop === 'all'} onPress={() => setCrop('all')} />
        {CROPS.map((k) => (
          <Chip key={k} label={s.crops[k]} selected={crop === k} onPress={() => setCrop(k)} />
        ))}
      </ChipRow>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 12 }}
        ListEmptyComponent={
          <View style={{ gap: 14 }}>
            <Hatch height={120} />
            <Text style={[styles.name, { color: c.text }]}>{s.historyEmptyTitle}</Text>
            <Body muted>{s.historyEmpty}</Body>
            <Button label={s.checkLeaf} icon="camera-outline" onPress={() => router.navigate('/')} />
          </View>
        }
        renderItem={({ item }) => {
          const entry = advice.classes[item.label];
          const itemCrop = cropOf(item.label);
          const when = new Date(item.createdAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
          const title = item.unsure ? s.unsureTitle : entry?.[language].name.replace(/^[^:]+:\s*/, '') ?? item.label;
          return (
            <Card
              onPress={item.unsure ? undefined : () => router.push({ pathname: '/result/[id]', params: { id: item.id } })}
              accessibilityLabel={title}
              style={styles.row}
            >
              <Hatch height={72} width={72} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.name, { color: c.text }]}>{title}</Text>
                <Meta>
                  {itemCrop ? s.crops[itemCrop] : ''} {'·'} {when}
                </Meta>
                {item.unsure ? null : (
                  <Meta tone={entry?.healthy ? 'good' : 'accent'}>
                    {entry?.healthy ? s.healthyTag : s.needsAction} {'·'} {s.levels[confidenceLevel(item.confidence)]}
                  </Meta>
                )}
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { gap: 14, paddingBottom: 6 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10 },
  name: { fontFamily: FONTS.serif, fontSize: 20, lineHeight: 26 },
});
