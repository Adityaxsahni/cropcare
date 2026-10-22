import * as Crypto from 'expo-crypto';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { Body, Button, IconButton, Loading, Notice, Screen, Title } from '../components/ui';
import { classifyPhoto, type Geometry } from '../lib/classify';
import { cropMismatch, isCrop } from '../lib/crops';
import { alternatives, decide } from '../lib/postprocess';
import { useModel } from '../model';
import { useApp } from '../state';
import { RADIUS } from '../theme';

const BOX_FRACTION = 0.8; // guide box side as a share of the preview's shorter side
const PREVIEW_TIMEOUT_MS = 8000; // camera not ready by then: say so instead of leaving a black screen
// The phone's own camera app or gallery, with Android's square crop screen so the user frames the leaf.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.9 };

export default function CameraScreen() {
  const { s, recordScan } = useApp();
  const params = useLocalSearchParams<{ crop?: string }>();
  const crop = isCrop(params.crop) ? params.crop : null;
  const model = useModel();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Errors from the camera itself; without this a failed start would only show a black screen.
  const [startError, setStartError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);

  const granted = permission?.granted === true;
  const cameraShown = granted && model.state === 'ready' && startError == null;
  useEffect(() => {
    if (!cameraShown || ready) return;
    const timer = setTimeout(() => setSlow(true), PREVIEW_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [cameraShown, ready, attempt]);

  function retryCamera() {
    setStartError(null);
    setReady(false);
    setSlow(false);
    setAttempt((n) => n + 1);
  }

  async function check(uri: string, geometry: Geometry) {
    if (model.state !== 'ready') return;
    setBusy(true); // unmounts the preview; it reports ready again when it comes back
    setReady(false);
    setError(null);
    const started = performance.now();
    try {
      const { probs, inferenceMs } = await classifyPhoto(uri, geometry, model.model, model.meta);
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

  async function capture() {
    if (!view || !ready || busy || !cameraRef.current) return;
    let uri: string;
    try {
      uri = (await cameraRef.current.takePictureAsync({ quality: 0.9, shutterSound: true })).uri;
    } catch {
      setError(s.captureError);
      return;
    }
    const boxSide = Math.min(view.w, view.h) * BOX_FRACTION;
    // The preview fills the view (cover), and the saved photo is already upright.
    await check(uri, { viewW: view.w, viewH: view.h, boxSide, mode: 'cover' });
  }

  async function pick(source: 'camera' | 'gallery') {
    if (busy || picking) return;
    setError(null);
    setPicking(true);
    try {
      if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setError(s.cameraDenied);
        return;
      }
      const result =
        source === 'camera' ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS) : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      const asset = result.canceled ? null : result.assets[0];
      if (asset) await check(asset.uri, null);
    } catch {
      setError(s.captureError);
    } finally {
      setPicking(false);
    }
  }

  const otherWays = (variant: 'secondary' | 'inverseOutline') => (
    <View style={styles.otherWays}>
      <Button label={s.usePhoneCamera} icon="phone-portrait-outline" variant={variant} onPress={() => pick('camera')} disabled={busy || picking} />
      <Button label={s.chooseFromGallery} icon="images-outline" variant={variant} onPress={() => pick('gallery')} disabled={busy || picking} />
    </View>
  );

  if (model.state === 'loading' || permission == null) return <Loading label={s.modelLoading} />;
  if (model.state === 'error') {
    return (
      <Screen>
        <IconButton icon="chevron-back" label={s.back} onPress={() => router.back()} />
        <Notice tone="danger">{s.modelError}</Notice>
        <Body muted>{model.error}</Body>
      </Screen>
    );
  }
  if (busy) return <Loading label={s.checking} />;
  if (!granted || startError) {
    return (
      <Screen>
        <IconButton icon="chevron-back" label={s.back} onPress={() => router.back()} />
        {startError ? (
          <>
            <Notice tone="danger">{s.cameraStartError}</Notice>
            <Body muted>{startError}</Body>
            <Button label={s.retry} icon="refresh" onPress={retryCamera} />
          </>
        ) : (
          <>
            <Title>{s.cameraNeededTitle}</Title>
            <Body>{permission.canAskAgain ? s.cameraNeededBody : s.cameraDenied}</Body>
            {permission.canAskAgain ? (
              <Button label={s.allowCamera} icon="camera" onPress={requestPermission} />
            ) : (
              <Button label={s.openSettings} icon="settings" onPress={() => Linking.openSettings()} />
            )}
          </>
        )}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Body muted>{s.otherWays}</Body>
        {otherWays('secondary')}
      </Screen>
    );
  }

  const boxSide = view ? Math.min(view.w, view.h) * BOX_FRACTION : 0;

  return (
    <View style={styles.fill}>
      <View style={styles.fill} onLayout={(e: LayoutChangeEvent) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <CameraView
          key={attempt}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          active={!picking}
          onCameraReady={() => setReady(true)}
          onMountError={(e) => setStartError(e.message)}
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
      <SafeAreaView edges={['bottom']} style={styles.controls}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {slow && !ready ? (
          <>
            <Text style={styles.error}>{s.cameraStartError}</Text>
            <Button label={s.retry} icon="refresh" variant="inverse" onPress={retryCamera} />
          </>
        ) : (
          <Button label={s.takePhoto} icon="camera" variant="inverse" onPress={capture} disabled={!view || !ready || picking} />
        )}
        {otherWays('inverseOutline')}
      </SafeAreaView>
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
  controls: { padding: 16, gap: 10, backgroundColor: '#000' },
  otherWays: { gap: 10 },
  error: { color: '#FFFFFF', fontSize: 17, textAlign: 'center' },
});
