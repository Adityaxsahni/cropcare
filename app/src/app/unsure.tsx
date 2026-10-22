import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Hatch, IconButton, Kicker, Screen, Title } from '../components/ui';
import { isCrop } from '../lib/crops';
import { useApp } from '../state';
import { FONTS, useColors } from '../theme';

/** Shown instead of a guess: either the model was not confident, or the leaf is another crop. */
export default function Unsure() {
  const { s, setLastCrop } = useApp();
  const c = useColors();
  const { reason, chosen, detected } = useLocalSearchParams<{ reason?: string; chosen?: string; detected?: string }>();
  const otherCrop = reason === 'other_crop' && isCrop(chosen) && isCrop(detected);
  const retry = () => router.replace({ pathname: '/camera', params: { crop: chosen ?? '' } });

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={
        <View style={{ flex: 1, gap: 12 }}>
          {otherCrop ? (
            <Button
              label={s.checkAs(s.cropsLower[detected])}
              onPress={() => {
                setLastCrop(detected);
                router.replace({ pathname: '/camera', params: { crop: detected } });
              }}
            />
          ) : null}
          <Button label={s.tryAgain} icon="camera-outline" variant={otherCrop ? 'secondary' : 'primary'} onPress={retry} />
        </View>
      }
    >
      <IconButton icon="chevron-back" label={s.back} onPress={() => router.dismissTo('/')} />
      <Kicker>{s.unsureTitle}</Kicker>
      {otherCrop ? (
        <>
          <Title>{s.otherCropTitle(s.cropsLower[detected])}</Title>
          <Body>{s.otherCropBody(s.cropsLower[chosen], s.cropsLower[detected])}</Body>
        </>
      ) : (
        <>
          <Title>{s.unsureBody}</Title>
          <Hatch height={120} caption={s.cameraHint} />
          {s.unsureTips.map((tip, i) => (
            <View key={tip} style={styles.tip}>
              <Text style={[styles.n, { color: c.accent }]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Body>{tip}</Body>
              </View>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tip: { flexDirection: 'row', gap: 12 },
  n: { fontFamily: FONTS.serif, fontSize: 22, minWidth: 18, lineHeight: 26 },
});
