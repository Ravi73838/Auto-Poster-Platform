import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '../../shared/lib/api';
import type { SessionDto } from '@ap/shared-types';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { Laptop, Smartphone, Globe, Shield, Trash2, RefreshCw } from 'lucide-react';

export function SessionsSection() {
  const client = useApiClient();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const data = await client.listSessions();
      setSessions(data);
    } catch {
      setActionError('Failed to load active sessions.');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (id: string) => {
    try {
      await client.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setActionError('Failed to revoke session.');
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'ANDROID':
      case 'IOS':
        return <Smartphone className="w-5 h-5 text-primary" />;
      case 'WEB':
        return <Laptop className="w-5 h-5 text-primary" />;
      default:
        return <Globe className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-textPrimary flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span>Active Login Sessions</span>
          </h3>
          <p className="text-xs text-textSecondary mt-0.5">
            Manage devices currently signed into your account.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSessions}
          disabled={isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {actionError ? (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-xs">
          {actionError}
        </div>
      ) : null}

      <div className="divide-y divide-border">
        {sessions.map((sess) => (
          <div key={sess.id} className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-surfaceAlt shrink-0">
                {getPlatformIcon(sess.platform)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-textPrimary truncate">
                    {sess.platform} Browser
                  </p>
                  {sess.isCurrent ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success">
                      Current Session
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-textSecondary truncate">
                  IP: {sess.ipAddress || 'Unknown'} &bull; Last active:{' '}
                  {new Date(sess.lastUsedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {!sess.isCurrent ? (
              <Button
                variant="outline"
                size="sm"
                className="text-danger hover:bg-danger/10 border-danger/30 gap-1 shrink-0"
                onClick={() => handleRevoke(sess.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Revoke</span>
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

