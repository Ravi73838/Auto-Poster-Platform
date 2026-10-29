import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { Spinner } from '../../../../shared/components/Spinner';
import { useApiClient } from '../../../../shared/lib/api';
import type { HealthResponse } from '@ap/shared-types';
import { Activity, Server, Database } from 'lucide-react';

export function SettingsPage() {
  const { t } = useTranslation('settings');
  const client = useApiClient();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    client
      .getHealth()
      .then((data) => {
        if (mounted) {
          setHealth(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to query API');
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [client]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description="System configuration and infrastructure diagnostics" />

      <Card>
        <div className="flex items-center gap-2 mb-4 text-base font-semibold text-textPrimary">
          <Activity className="w-5 h-5 text-primary" />
          <span>{t('apiHealth')}</span>
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
            {error}
          </div>
        ) : health ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-surfaceAlt rounded-lg">
              <div className="flex items-center gap-2 text-xs font-semibold text-textSecondary uppercase">
                <Server className="w-4 h-4" />
                <span>{t('systemStatus')}</span>
              </div>
              <p className="mt-2 text-lg font-bold text-success capitalize">{health.status}</p>
              <p className="text-xs text-textSecondary mt-1">Uptime: {Math.round(health.uptime)}s</p>
            </div>

            <div className="p-4 bg-surfaceAlt rounded-lg">
              <div className="flex items-center gap-2 text-xs font-semibold text-textSecondary uppercase">
                <Database className="w-4 h-4" />
                <span>Database</span>
              </div>
              <p
                className={`mt-2 text-lg font-bold capitalize ${
                  health.services.database === 'connected' ? 'text-success' : 'text-danger'
                }`}
              >
                {health.services.database}
              </p>
              <p className="text-xs text-textSecondary mt-1">PostgreSQL</p>
            </div>

            <div className="p-4 bg-surfaceAlt rounded-lg">
              <div className="flex items-center gap-2 text-xs font-semibold text-textSecondary uppercase">
                <Server className="w-4 h-4" />
                <span>Cache & Queue</span>
              </div>
              <p
                className={`mt-2 text-lg font-bold capitalize ${
                  health.services.redis === 'connected' ? 'text-success' : 'text-danger'
                }`}
              >
                {health.services.redis}
              </p>
              <p className="text-xs text-textSecondary mt-1">Redis</p>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
