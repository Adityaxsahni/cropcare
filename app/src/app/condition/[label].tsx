import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConditionDetail, ListenFooter } from '../../components/condition';
import { Body, Button, IconButton, Screen } from '../../components/ui';
import { cropOf } from '../../lib/crops';
import { useApp } from '../../state';
import { useColors } from '../../theme';

/** A guide page: the same advice as a result, without a scan behind it. */
export default function Condition() {
  const { label } = useLocalSearchParams<{ label: string }>();
  const { s, advice } = useApp();
  const c = useColors();
  const entry = label ? advice.classes[label] : undefined;
  if (!label || !entry) {
    return (
      <Screen>
        <Body>{s.scanNotFound}</Body>
        <Button label={s.goHome} icon="home-outline" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  const crop = cropOf(label);
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView>
        <ConditionDetail label={label} entry={entry} caption={s.guideKicker} />
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, flexDirection: 'row' }}>
        <ListenFooter
          entry={entry}
          secondary={<IconButton icon="camera-outline" label={s.checkLeaf} onPress={() => router.push({ pathname: '/camera', params: { crop: crop ?? '' } })} />}
        />
      </View>
    </SafeAreaView>
  );
}
