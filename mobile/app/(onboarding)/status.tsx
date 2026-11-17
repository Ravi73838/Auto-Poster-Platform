import { useRouter } from 'expo-router';
import { KycStatusScreen } from '../../src/features/kyc';

export default function KycStatusRoute() {
  const router = useRouter();

  return (
    <KycStatusScreen
      onReopenWizard={() => {
        router.push('/(onboarding)/wizard');
      }}
      onProceedToDashboard={() => {
        router.replace('/(tabs)');
      }}
    />
  );
}
