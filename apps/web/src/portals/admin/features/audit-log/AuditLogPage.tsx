import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function AuditLogPage() {
  return (
    <div>
      <PageHeader title="Audit Log" description="Immutable activity records for compliance and fraud tracking" />
      <Card>
        <p className="text-textSecondary">Audit trail records</p>
      </Card>
    </div>
  );
}
