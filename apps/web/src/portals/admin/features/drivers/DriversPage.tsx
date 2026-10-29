import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function DriversPage() {
  return (
    <div>
      <PageHeader title="Drivers" description="Manage driver KYC, vehicles, and account approvals" />
      <Card>
        <p className="text-textSecondary">Driver verification list</p>
      </Card>
    </div>
  );
}
