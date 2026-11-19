import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LanguageSelectScreen, MobileInputScreen } from '../../src/features/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'language' | 'auth'>('auth');

  const handleLanguageSelected = () => {
    setStep('auth');
  };

  const handleLoginSuccess = () => {
    router.replace('/(tabs)');
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
