import { useLocalSearchParams, useRouter } from 'expo-router';
import { InstallationUploadScreen } from '../../../src/features/installation';

export default function AssignmentInstallRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <InstallationUploadScreen
      assignmentId={id as string}
      onBack={() => {
        router.back();
      }}
      onSubmitSuccess={() => {
        router.push(`/assignments/${id}/daily-camera`);
      }}
    />
  );
}
