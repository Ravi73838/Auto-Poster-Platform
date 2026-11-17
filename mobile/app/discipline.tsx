import { useRouter } from 'expo-router';
import { DriverDisciplineScreen } from '../src/features/discipline';

export default function DisciplineRoute() {
  const router = useRouter();

  return (
    <DriverDisciplineScreen
      onBack={() => {
        router.back();
      }}
    />
  );
}
