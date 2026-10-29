import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function CompanyDashboardPage() {
  const { t } = useTranslation('common');
  return (
    <div>
      <PageHeader title={t('dashboard')} description="Overview of advertising campaigns" />
      <Card>
        <p className="text-textSecondary">{t('emptyState')}</p>
      </Card>
    </div>
  );
}
