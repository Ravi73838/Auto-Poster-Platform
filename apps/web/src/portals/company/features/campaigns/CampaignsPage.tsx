import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function CampaignsPage() {
  return (
    <div>
      <PageHeader title="Campaigns" />
      <Card>
        <p className="text-textSecondary">Manage poster campaigns and artwork</p>
      </Card>
    </div>
  );
}
