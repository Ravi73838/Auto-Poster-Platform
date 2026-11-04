import { useRouter } from 'expo-router';
import { DriverStatusHomeScreen } from '../../src/features/auth';

export default function DriverDashboardScreen() {
  const router = useRouter();

  return (
    <DriverStatusHomeScreen
      onOpenSettings={() => router.push('/(tabs)/profile')}
    />
  );
}
