import { Redirect } from 'expo-router';
import { useMobileAuthStore } from '../src/store/authStore';

export default function Index() {
  const isAuthenticated = useMobileAuthStore((s) => s.isAuthenticated);
  const isInitialized = useMobileAuthStore((s) => s.isInitialized);

  // Wait until auth state is restored from secure storage
  if (!isInitialized) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}

