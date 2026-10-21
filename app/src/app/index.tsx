import { router } from 'expo-router';
import { View } from 'react-native';

import { Body, Button, Card, Heading, Loading, Screen } from '../components/ui';
import { useApp } from '../state';

export default function Home() {
  const { ready, s, language, setLanguage, consent, sharingAvailable, setConsent } = useApp();
  if (!ready) return <Loading label="..." />;

  return (
    <Screen>
      <Heading>{s.appName}</Heading>
      <Body muted>{s.tagline}</Body>

      <Button label={s.checkLeaf} icon="camera" onPress={() => router.push('/camera')} style={{ minHeight: 88 }} />
      <Button label={s.history} icon="time" variant="secondary" onPress={() => router.push('/history')} />
      <Button
        label={s.switchLanguage}
        icon="language"
        variant="secondary"
        onPress={() => setLanguage(language === 'hi' ? 'en' : 'hi')}
      />
      <Button label={s.about} icon="information-circle" variant="secondary" onPress={() => router.push('/about')} />

      {sharingAvailable && consent === null ? (
        <Card>
          <Body>{s.shareTitle}</Body>
          <Body muted>{s.shareBody}</Body>
          <View style={{ gap: 12, marginTop: 4 }}>
            <Button label={s.shareYes} icon="checkmark" onPress={() => setConsent('yes')} />
            <Button label={s.shareNo} icon="close" variant="secondary" onPress={() => setConsent('no')} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
