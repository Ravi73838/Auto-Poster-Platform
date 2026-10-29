import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function DisputesPage() {
  return (
    <div>
      <PageHeader title="Disputes" description="Resolve driver photo rejections and company campaign claims" />
      <Card>
        <p className="text-textSecondary">Dispute cases queue</p>
      </Card>
    </div>
  );
}
