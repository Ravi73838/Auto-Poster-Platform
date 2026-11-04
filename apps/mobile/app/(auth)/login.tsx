import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  LanguageSelectScreen,
  MobileInputScreen,
  OtpVerifyScreen,
} from '../../src/features/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'language' | 'mobile' | 'otp'>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [devOtpCode, setDevOtpCode] = useState<string | undefined>();

  const handleLanguageSelected = () => {
    setStep('mobile');
  };

  const handleOtpSent = (mobile: string, devCode?: string) => {
    setMobileNumber(mobile);
    setDevOtpCode(devCode);
    setStep('otp');
  };

  const handleLoginSuccess = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      {step === 'language' ? (
        <LanguageSelectScreen onSelectLanguage={handleLanguageSelected} />
      ) : step === 'mobile' ? (
        <MobileInputScreen
          onOtpSent={handleOtpSent}
          onChangeLanguage={() => setStep('language')}
        />
      ) : (
        <OtpVerifyScreen
          mobile={mobileNumber}
          devCode={devOtpCode}
          onSuccess={handleLoginSuccess}
          onBack={() => setStep('mobile')}
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
