import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function PayoutsPage() {
  return (
    <div>
      <PageHeader title="Driver Payouts" description="Review and approve automated UPI and bank driver disbursements" />
      <Card>
        <p className="text-textSecondary">Batch payout approval queue</p>
      </Card>
    </div>
  );
}
