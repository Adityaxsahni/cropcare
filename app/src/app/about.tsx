import { Linking, View } from 'react-native';

import { Body, Button, Card, Heading, Screen } from '../components/ui';
import { averageInferenceMs } from '../lib/history';
import { useModel } from '../model';
import { PRIVACY_URL, useApp } from '../state';

export default function About() {
  const { s, consent, sharingAvailable, setConsent, pendingUploads, history, advice } = useApp();
  const model = useModel();
  const speed = averageInferenceMs(history.filter((h) => model.state === 'ready' && h.modelVersion === model.meta.version));

  return (
    <Screen>
      <Heading>{s.appName}</Heading>
      <Body>{s.aboutBody}</Body>
      <Body muted>{s.kvkNote}</Body>

      {sharingAvailable ? (
        <Card>
          <Body>{consent === 'yes' ? s.sharingOn : s.sharingOff}</Body>
          <Body muted>{s.shareBody}</Body>
          {consent === 'yes' && pendingUploads > 0 ? <Body muted>{s.waitingToSend(pendingUploads)}</Body> : null}
          <Button
            label={consent === 'yes' ? s.turnOff : s.turnOn}
            variant="secondary"
            onPress={() => setConsent(consent === 'yes' ? 'no' : 'yes')}
          />
        </Card>
      ) : null}

      <Card>
        <View style={{ gap: 6 }}>
          <Body muted>
            {s.modelVersion}: {model.state === 'ready' ? `${model.meta.version} (${model.meta.variant})` : '-'}
          </Body>
          <Body muted>
            {s.adviceStatus}: {advice.review.reviewed ? s.reviewedBy(advice.review.reviewer) : s.adviceDraft}
          </Body>
          {speed ? <Body muted>{s.speed(speed.mean, speed.count)}</Body> : null}
        </View>
      </Card>

      {PRIVACY_URL ? <Button label={s.privacyPolicy} icon="open" variant="secondary" onPress={() => Linking.openURL(PRIVACY_URL)} /> : null}
    </Screen>
  );
}
