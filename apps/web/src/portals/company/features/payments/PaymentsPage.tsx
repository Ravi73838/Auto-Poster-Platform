import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function CompanyPaymentsPage() {
  return (
    <div>
      <PageHeader title="Escrow Payments" />
      <Card>
        <p className="text-textSecondary">Deposit funds and view escrow status</p>
      </Card>
    </div>
  );
}
