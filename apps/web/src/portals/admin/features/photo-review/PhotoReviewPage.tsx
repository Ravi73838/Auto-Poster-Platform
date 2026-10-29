import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function PhotoReviewPage() {
  return (
    <div>
      <PageHeader title="Daily Photo Review" description="Verify daily driver odometer, poster condition, and GPS coordinates" />
      <Card>
        <p className="text-textSecondary">Daily photo verification submissions</p>
      </Card>
    </div>
  );
}
