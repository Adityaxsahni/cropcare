import { Linking, View } from 'react-native';

import { Body, Button, Card, InfoGrid, Kicker, Meta, Screen, Title, TopBar } from '../../components/ui';
import { averageInferenceMs } from '../../lib/history';
import { useModel } from '../../model';
import { PRIVACY_URL, useApp } from '../../state';

export default function About() {
  const { s, consent, sharingAvailable, setConsent, pendingUploads, history, advice } = useApp();
  const model = useModel();
  const speed = averageInferenceMs(history.filter((h) => model.state === 'ready' && h.modelVersion === model.meta.version));

  return (
    <Screen>
      <TopBar />
      <Kicker>{s.about}</Kicker>
      <Title>{s.appName}</Title>
      <Body>{s.aboutBody}</Body>
      <Meta>{s.kvkNote}</Meta>

      <InfoGrid
        items={[
          { label: s.modelLabel, value: model.state === 'ready' ? model.meta.version : '-' },
          { label: s.adviceLabel, value: advice.review.reviewed ? s.reviewedShort : s.draftShort, tone: advice.review.reviewed ? 'good' : 'accent' },
          { label: s.tabs.history, value: String(history.length) },
          { label: s.speedLabel, value: speed ? `${Math.round(speed.mean)} (${speed.count})` : '-' },
        ]}
      />

      {sharingAvailable ? (
        <Card>
          <Kicker tone="muted">{consent === 'yes' ? s.sharingOn : s.sharingOff}</Kicker>
          <Body muted>{s.shareBody}</Body>
          {consent === 'yes' && pendingUploads > 0 ? <Meta>{s.waitingToSend(pendingUploads)}</Meta> : null}
          <View>
            <Button label={consent === 'yes' ? s.turnOff : s.turnOn} variant="secondary" onPress={() => setConsent(consent === 'yes' ? 'no' : 'yes')} />
          </View>
        </Card>
      ) : null}

      {PRIVACY_URL ? <Button label={s.privacyPolicy} icon="open-outline" variant="secondary" onPress={() => Linking.openURL(PRIVACY_URL)} /> : null}
    </Screen>
  );
}
