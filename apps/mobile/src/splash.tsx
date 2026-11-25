import { SplashScreen } from 'expo-router';

import { useSession } from './ctx';

void SplashScreen.preventAutoHideAsync();

export function SplashScreenController() {
  const { isLoading } = useSession();
  if (!isLoading) void SplashScreen.hideAsync();
  return null;
}
