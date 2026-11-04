import { Redirect } from 'expo-router';
import { useMobileAuthStore } from '../src/store/authStore';

export default function Index() {
  const isAuthenticated = useMobileAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
