import { useRouter } from 'expo-router';
import { DriverDisputesScreen } from '../../src/features/disputes';

export default function DisputesRoute() {
  const router = useRouter();

  return (
    <DriverDisputesScreen
      onBack={() => {
        router.back();
      }}
    />
  );
}
