import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function CompanyReportsPage() {
  return (
    <div>
      <PageHeader title="Performance Reports" />
      <Card>
        <p className="text-textSecondary">Impressions, kilometers traveled, and compliance reports</p>
      </Card>
    </div>
  );
}
