import { useLocalSearchParams, useRouter } from 'expo-router';
import { DailyPhotoCaptureScreen } from '../../../src/features/daily-photo';

export default function AssignmentDailyCameraRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <DailyPhotoCaptureScreen
      assignmentId={id as string}
      onBack={() => {
        router.back();
      }}
      onSubmitSuccess={() => {
        router.replace('/(tabs)');
      }}
    />
  );
}
