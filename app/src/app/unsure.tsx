import { router } from 'expo-router';
import { View } from 'react-native';

import { Body, Button, Card, Heading, Screen } from '../components/ui';
import { useApp } from '../state';

export default function Unsure() {
  const { s } = useApp();
  return (
    <Screen>
      <Card tone="warn">
        <Heading>{s.unsureTitle}</Heading>
        <Body>{s.unsureBody}</Body>
      </Card>
      <View style={{ gap: 6 }}>
        {s.unsureTips.map((tip) => (
          <Body key={tip} muted>
            {`• ${tip}`}
          </Body>
        ))}
      </View>
      <Button label={s.tryAgain} icon="camera" onPress={() => router.replace('/camera')} />
      <Button label={s.goHome} icon="home" variant="secondary" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}
