import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Camera, CommonResolutions, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

import { Body, Button, IconButton, Loading, Notice, Screen, Title } from '../components/ui';
import { classifyPhoto } from '../lib/classify';
import { cropMismatch, isCrop } from '../lib/crops';
import { alternatives, decide } from '../lib/postprocess';
import { useModel } from '../model';
import { useApp } from '../state';
import { RADIUS } from '../theme';

const RESIZE_MODE = 'cover' as const;
const BOX_FRACTION = 0.8; // guide box side as a share of the preview's shorter side
const PREVIEW_TIMEOUT_MS = 8000; // no first frame by then: say so instead of leaving a black screen

export default function CameraScreen() {
  const { s, recordScan } = useApp();
  const params = useLocalSearchParams<{ crop?: string }>();
  const crop = isCrop(params.crop) ? params.crop : null;
  const model = useModel();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({ targetResolution: CommonResolutions.FHD_4_3, qualityPrioritization: 'speed' });
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Errors from the camera session itself; without this they only reach the console and the preview stays black.
  const [startError, setStartError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [previewOn, setPreviewOn] = useState(false);
  const [previewSlow, setPreviewSlow] = useState(false);
  const cameraShown = hasPermission && device != null && model.state === 'ready' && startError == null;
  useEffect(() => {
    if (!cameraShown || previewOn) return;
    const timer = setTimeout(() => setPreviewSlow(true), PREVIEW_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [cameraShown, previewOn, attempt]);

  function retryCamera() {
    setStartError(null);
    setPreviewOn(false);
    setPreviewSlow(false);
    setAttempt((n) => n + 1);
  }

  if (!hasPermission) {
    return (
      <Screen>
        <IconButton icon="chevron-back" label={s.back} onPress={() => router.back()} />
        <Title>{s.cameraNeededTitle}</Title>
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
        <IconButton icon="chevron-back" label={s.back} onPress={() => router.back()} />
        <Notice>{s.noCamera}</Notice>
      </Screen>
    );
  }
  if (model.state === 'loading') return <Loading label={s.modelLoading} />;
  if (model.state === 'error') {
    return (
      <Screen>
        <IconButton icon="chevron-back" label={s.back} onPress={() => router.back()} />
        <Notice tone="danger">{s.modelError}</Notice>
        <Body muted>{model.error}</Body>
      </Screen>
    );
  }

  if (startError) {
    return (
      <Screen>
        <IconButton icon="chevron-back" label={s.back} onPress={() => router.back()} />
        <Notice tone="danger">{s.cameraStartError}</Notice>
        <Body muted>{startError}</Body>
        <Button label={s.retry} icon="refresh" onPress={retryCamera} />
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
      const otherCrop = d.kind === 'answer' ? cropMismatch(d.label, crop) : null;
      const unsure = d.kind === 'unsure' || otherCrop !== null;
      const id = Crypto.randomUUID();
      recordScan({
        id,
        label: d.label,
        confidence: d.confidence,
        unsure,
        unsureReason: otherCrop ? 'other_crop' : d.kind === 'unsure' ? 'low_confidence' : undefined,
        chosenCrop: crop ?? undefined,
        alternatives: alternatives(probs, model.meta.labels),
        createdAt: new Date().toISOString(),
        modelVersion: model.meta.version,
        inferenceMs,
        totalMs: performance.now() - started,
        answer: null,
      });
      if (otherCrop && crop) router.replace({ pathname: '/unsure', params: { reason: 'other_crop', chosen: crop, detected: otherCrop } });
      else if (d.kind === 'unsure') router.replace({ pathname: '/unsure', params: { reason: 'low_confidence', chosen: crop ?? '' } });
      else router.replace({ pathname: '/result/[id]', params: { id } });
    } catch {
      setError(s.captureError);
      setBusy(false);
    }
  }

  return (
    <View style={styles.fill}>
      <View style={styles.fill} onLayout={(e: LayoutChangeEvent) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {/* 'compatible' (TextureView): the default SurfaceView does not support views layered on top, and the guide box,
            hint and back button sit over the preview, which can leave it black on Android. */}
        <Camera
          key={attempt}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!busy}
          outputs={[photoOutput]}
          resizeMode={RESIZE_MODE}
          implementationMode="compatible"
          onError={(e: Error) => setStartError(e.message)}
          onPreviewStarted={() => setPreviewOn(true)}
        />
        {view ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
            <View style={[styles.box, { width: boxSide, height: boxSide }]} />
            <Text style={styles.hint}>{crop ? s.cameraHintCrop(s.cropsLower[crop]) : s.cameraHint}</Text>
          </View>
        ) : null}
        <SafeAreaView edges={['top', 'left']} style={styles.back}>
          <Pressable accessibilityRole="button" accessibilityLabel={s.back} onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#FBF8F2" />
          </Pressable>
        </SafeAreaView>
      </View>
      <View style={styles.controls}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {previewSlow && !previewOn ? (
          <>
            <Text style={styles.error}>{s.cameraStartError}</Text>
            <Button label={s.retry} icon="refresh" variant="inverse" onPress={retryCamera} />
          </>
        ) : busy ? (
          <Loading label={s.checking} />
        ) : (
          <Button label={s.takePhoto} icon="camera" variant="inverse" onPress={capture} disabled={!view} />
        )}
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
    fontSize: 17,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS,
  },
  back: { position: 'absolute', top: 0, left: 0 },
  backButton: { margin: 12, width: 48, height: 48, borderRadius: RADIUS, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  controls: { padding: 16, backgroundColor: '#000', minHeight: 120, justifyContent: 'center' },
  error: { color: '#FFFFFF', fontSize: 17, marginBottom: 12, textAlign: 'center' },
});
