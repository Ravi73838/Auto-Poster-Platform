import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function CompaniesPage() {
  return (
    <div>
      <PageHeader title="Companies" description="Manage advertising companies and GST profiles" />
      <Card>
        <p className="text-textSecondary">Company list</p>
      </Card>
    </div>
  );
}
