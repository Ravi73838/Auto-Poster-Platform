import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';

export function TrackingPage() {
  return (
    <div>
      <PageHeader title="Live Tracking" />
      <Card>
        <p className="text-textSecondary">Real-time driver location and poster visibility heatmap</p>
      </Card>
    </div>
  );
}

