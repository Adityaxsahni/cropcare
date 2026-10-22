import { router } from 'expo-router';

import { Body, IconButton, Notice, Screen, Title } from '../components/ui';
import { useApp } from '../state';

/** Web preview only: the camera and the model need the Android app. */
export default function CameraWeb() {
  const { s } = useApp();
  return (
    <Screen>
      <IconButton icon="chevron-back" label={s.back} onPress={() => router.back()} />
      <Title>{s.cameraNeededTitle}</Title>
      <Notice>{s.modelError}</Notice>
      <Body muted>The camera works in the Android app. This web build is for previewing the screens.</Body>
    </Screen>
  );
}
