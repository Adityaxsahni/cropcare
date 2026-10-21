import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Screen } from '../components/ui';
import { confidenceLevel } from '../lib/postprocess';
import { useApp } from '../state';
import { FONT, RADIUS, useColors } from '../theme';

export default function History() {
  const { s, language, history, advice } = useApp();
  const c = useColors();

  if (history.length === 0) {
    return (
      <Screen>
        <Body muted>{s.historyEmpty}</Body>
      </Screen>
    );
  }

  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={history}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const name = item.unsure ? s.unsureTitle : advice.classes[item.label]?.[language].name ?? item.label;
        const when = new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
        const detail = item.unsure ? when : `${when}  |  ${s.confidence}: ${s.levels[confidenceLevel(item.confidence)]}`;
        return (
          <Pressable
            accessibilityRole="button"
            disabled={item.unsure}
            onPress={() => router.push({ pathname: '/result/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: c.text }]}>{name}</Text>
              <Text style={[styles.detail, { color: c.muted }]}>{detail}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: RADIUS, padding: 14, flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: FONT.body, fontWeight: '600' },
  detail: { fontSize: FONT.small, marginTop: 4 },
});
