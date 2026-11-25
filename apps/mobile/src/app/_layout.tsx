import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '@/ctx';
import { SplashScreenController } from '@/splash';

export default function RootLayout() {
  return (
    <SessionProvider>
      <SplashScreenController />
      <StatusBar style="dark" />
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { user, isLoading } = useSession();
  const authenticated = !isLoading && Boolean(user);

  return (
    <Stack>
      <Stack.Protected guard={authenticated}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen
          name="suggestions"
          options={{ title: 'پیشنهادها', headerBackTitle: 'بازگشت' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!isLoading && !user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
