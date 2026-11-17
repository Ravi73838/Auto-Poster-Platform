import { useRouter } from 'expo-router';
import { NotificationsScreen } from '../../src/features/notifications';

export default function NotificationsTab() {
  const router = useRouter();

  return (
    <NotificationsScreen
      onBack={() => {
        router.back();
      }}
    />
  );
}
