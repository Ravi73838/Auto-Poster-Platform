import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function BusinessProfilePage() {
  return (
    <div>
      <PageHeader title="Business Profile" />
      <Card>
        <p className="text-textSecondary">Company profile details and KYC verification</p>
      </Card>
    </div>
  );
}
