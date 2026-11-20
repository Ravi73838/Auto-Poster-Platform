import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LanguageSelectScreen, MobileInputScreen } from '../../src/features/auth';
import { useMobileAuthStore } from '../../src/store/authStore';
import { apiClient } from '../../src/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'language' | 'auth'>('auth');

  const handleLanguageSelected = () => {
    setStep('auth');
  };

  const handleLoginSuccess = async () => {
    try {
      const user = useMobileAuthStore.getState().user;
      if (user?.status === 'APPROVED') {
        router.replace('/(tabs)');
        return;
      }

      // Check if driver has already submitted KYC
      const kyc = await apiClient.getDriverKyc().catch(() => null);
      if (kyc?.status === 'SUBMITTED' || kyc?.status === 'UNDER_REVIEW') {
        router.replace('/(onboarding)/status');
      } else {
        router.replace('/(onboarding)/wizard');
      }
    } catch {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      {step === 'language' ? (
        <LanguageSelectScreen onSelectLanguage={handleLanguageSelected} />
      ) : (
        <MobileInputScreen
          onLoginSuccess={handleLoginSuccess}
          onChangeLanguage={() => setStep('language')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
