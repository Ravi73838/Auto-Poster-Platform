import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function AdminReportsPage() {
  return (
    <div>
      <PageHeader title="Platform Analytics" description="Driver engagement, revenue metrics, and fleet density statistics" />
      <Card>
        <p className="text-textSecondary">Platform metrics reports</p>
      </Card>
    </div>
  );
}
