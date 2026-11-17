import { useRouter } from 'expo-router';
import { DriverAssignmentsScreen } from '../../src/features/assignments';

export default function AssignmentsListRoute() {
  const router = useRouter();

  return (
    <DriverAssignmentsScreen
      onOpenAssignment={(id) => {
        router.push(`/assignments/${id}/install`);
      }}
      onExploreCampaigns={() => {
        router.push('/(tabs)/campaigns');
      }}
    />
  );
}
