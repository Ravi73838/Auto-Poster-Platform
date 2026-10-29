import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function AdminPaymentsPage() {
  return (
    <div>
      <PageHeader title="Escrow Payments" description="Monitor escrow balance, receipts, and deposit transactions" />
      <Card>
        <p className="text-textSecondary">Escrow ledger list</p>
      </Card>
    </div>
  );
}
