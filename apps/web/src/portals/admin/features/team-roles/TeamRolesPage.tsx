import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function TeamRolesPage() {
  return (
    <div>
      <PageHeader title="Team & Permissions" description="Manage internal administrative staff roles and access levels" />
      <Card>
        <p className="text-textSecondary">Staff list</p>
      </Card>
    </div>
  );
}
