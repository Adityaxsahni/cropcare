import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Camera, CommonResolutions, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

import { Body, Button, Card, Heading, Loading, Screen } from '../components/ui';
import { classifyPhoto } from '../lib/classify';
import { decide } from '../lib/postprocess';
import { useModel } from '../model';
import { useApp } from '../state';
import { FONT, RADIUS } from '../theme';

const RESIZE_MODE = 'cover' as const;
const BOX_FRACTION = 0.8; // guide box side as a share of the preview's shorter side

export default function CameraScreen() {
  const { s, recordScan } = useApp();
  const model = useModel();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({ targetResolution: CommonResolutions.FHD_4_3, qualityPrioritization: 'speed' });
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasPermission) {
    return (
      <Screen>
        <Heading>{s.cameraNeededTitle}</Heading>
        <Body>{canRequestPermission ? s.cameraNeededBody : s.cameraDenied}</Body>
        {canRequestPermission ? (
          <Button label={s.allowCamera} icon="camera" onPress={requestPermission} />
        ) : (
          <Button label={s.openSettings} icon="settings" onPress={() => Linking.openSettings()} />
        )}
      </Screen>
    );
  }
  if (device == null) {
    return (
      <Screen>
        <Body>{s.noCamera}</Body>
      </Screen>
    );
  }
  if (model.state === 'loading') return <Loading label={s.modelLoading} />;
  if (model.state === 'error') {
    return (
      <Screen>
        <Card tone="danger">
          <Body>{s.modelError}</Body>
          <Body muted>{model.error}</Body>
        </Card>
      </Screen>
    );
  }

  const boxSide = view ? Math.min(view.w, view.h) * BOX_FRACTION : 0;

  async function capture() {
    if (!view || busy || model.state !== 'ready') return;
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const photo = await photoOutput.capturePhoto({ flashMode: 'off', enableShutterSound: true }, {});
      const { probs, inferenceMs } = await classifyPhoto(
        photo,
        { viewW: view.w, viewH: view.h, boxSide, mode: RESIZE_MODE },
        model.model,
        model.meta,
      );
      const d = decide(probs, model.meta.labels, model.meta.threshold);
      const id = Crypto.randomUUID();
      recordScan({
        id,
        label: d.label,
        confidence: d.confidence,
        unsure: d.kind === 'unsure',
        createdAt: new Date().toISOString(),
        modelVersion: model.meta.version,
        inferenceMs,
        totalMs: performance.now() - started,
        answer: null,
      });
      if (d.kind === 'unsure') router.replace('/unsure');
      else router.replace({ pathname: '/result/[id]', params: { id } });
    } catch {
      setError(s.captureError);
      setBusy(false);
    }
  }

  return (
    <View style={styles.fill}>
      <View style={styles.fill} onLayout={(e: LayoutChangeEvent) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={!busy} outputs={[photoOutput]} resizeMode={RESIZE_MODE} />
        {view ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
            <View style={[styles.box, { width: boxSide, height: boxSide }]} />
            <Text style={styles.hint}>{s.cameraHint}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.controls}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {busy ? <Loading label={s.checking} /> : <Button label={s.takePhoto} icon="camera" onPress={capture} disabled={!view} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 3, borderColor: '#FFFFFF', borderRadius: RADIUS },
  hint: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: FONT.body,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS,
  },
  controls: { padding: 16, backgroundColor: '#000', minHeight: 120, justifyContent: 'center' },
  error: { color: '#FFFFFF', fontSize: FONT.body, marginBottom: 12, textAlign: 'center' },
});
