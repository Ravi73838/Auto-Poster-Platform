import { useRouter } from 'expo-router';
import { LanguageSelectScreen } from '../../src/features/auth';

export default function LanguageRoute() {
  const router = useRouter();

  return (
    <LanguageSelectScreen
      onSelectLanguage={() => {
        router.replace('/(auth)/login');
      }}
    />
  );
}
