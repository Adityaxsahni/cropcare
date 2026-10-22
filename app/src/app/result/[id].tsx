import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConditionDetail, ListenFooter } from '../../components/condition';
import { useToast } from '../../components/toast';
import { Body, Button, Card, Chip, ChipRow, IconButton, InfoGrid, Kicker, Meta, Screen, TestBuildBanner } from '../../components/ui';
import { cropOf } from '../../lib/crops';
import { confidenceLevel } from '../../lib/postprocess';
import { IS_TEST_MODEL } from '../../model';
import { useApp } from '../../state';
import { useColors } from '../../theme';

export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { s, language, history, answerScan, advice } = useApp();
  const toast = useToast();
  const c = useColors();
  const scan = history.find((x) => x.id === id);
  const entry = scan ? advice.classes[scan.label] : undefined;

  if (!scan || !entry) {
    return (
      <Screen>
        <Body>{s.scanNotFound}</Body>
        <Button label={s.goHome} icon="home-outline" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  const level = confidenceLevel(scan.confidence);
  const crop = cropOf(scan.label);
  const answer = (value: 'yes' | 'no') => {
    answerScan(scan.id, value);
    toast(s.answerSaved);
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView>
        {IS_TEST_MODEL ? (
          <View style={{ padding: 16 }}>
            <TestBuildBanner text={s.testBuild} />
          </View>
        ) : null}
        <ConditionDetail
          label={scan.label}
          entry={entry}
          caption={s.photoNotKept}
          facts={
            <InfoGrid
              items={[
                { label: s.confidence, value: `${s.levels[level]} · ${Math.round(scan.confidence * 100)}%`, tone: level === 'high' ? 'good' : undefined },
                { label: s.cropLabel, value: crop ? s.crops[crop] : '-' },
                { label: s.checkedAt, value: new Date(scan.createdAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
                { label: s.modelLabel, value: scan.modelVersion },
              ]}
            />
          }
          extra={
            <>
              {scan.alternatives && scan.alternatives.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Kicker tone="muted">{s.otherPossibilities}</Kicker>
                  {scan.alternatives.map((alt) => (
                    <Meta key={alt.label}>
                      {advice.classes[alt.label]?.[language].name ?? alt.label} {'·'} {Math.round(alt.confidence * 100)}%
                    </Meta>
                  ))}
                </View>
              ) : null}
              <Card>
                <Body>{s.wasCorrect}</Body>
                {scan.answer ? (
                  <Meta tone="good">{s.thanks}</Meta>
                ) : (
                  <ChipRow>
                    <Chip label={s.yes} onPress={() => answer('yes')} />
                    <Chip label={s.no} onPress={() => answer('no')} />
                  </ChipRow>
                )}
              </Card>
            </>
          }
        />
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, flexDirection: 'row' }}>
        <ListenFooter
          entry={entry}
          secondary={<IconButton icon="camera-outline" label={s.checkAnother} onPress={() => router.replace({ pathname: '/camera', params: { crop: scan.chosenCrop ?? crop ?? '' } })} />}
        />
      </View>
    </SafeAreaView>
  );
}
