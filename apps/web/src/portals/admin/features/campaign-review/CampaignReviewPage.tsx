import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function CampaignReviewPage() {
  return (
    <div>
      <PageHeader title="Campaign Review" description="Review poster creative, copy, and targeting guidelines" />
      <Card>
        <p className="text-textSecondary">Pending campaign review queue</p>
      </Card>
    </div>
  );
}
