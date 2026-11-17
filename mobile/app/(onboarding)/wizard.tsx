import { useRouter } from 'expo-router';
import { KycWizardScreen } from '../../src/features/kyc';

export default function KycWizardRoute() {
  const router = useRouter();

  return (
    <KycWizardScreen
      onSuccess={() => {
        router.replace('/(onboarding)/status');
      }}
      onCancel={() => {
        router.replace('/(tabs)');
      }}
    />
  );
}
