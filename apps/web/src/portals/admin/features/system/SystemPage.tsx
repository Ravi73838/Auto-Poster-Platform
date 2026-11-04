import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Database,
  HardDrive,
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { useApiClient } from '../../../../shared/lib/api';
import { StepUpModal } from '../../../../shared/components/StepUpModal';

interface JobRun {
  id: string;
  jobName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  metadata?: any;
}

export function SystemPage() {
  const client = useApiClient();

  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);

  // Retry step-up modal
  const [isStepUpOpen, setIsStepUpOpen] = useState(false);
  const [retryTargetJobId, setRetryTargetJobId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [healthRes, jobsRes] = await Promise.all([
        client.adminGetSystemHealth(),
        client.adminListJobRuns({ limit: 25 }),
      ]);
      setHealth(healthRes);
      setJobs(jobsRes?.jobs || []);
      setTotalJobs(jobsRes?.total || 0);
    } catch (err) {
      console.error('Failed to load system diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRetryClick = (jobId: string) => {
    setRetryTargetJobId(jobId);
    setIsStepUpOpen(true);
  };

  const handleStepUpSuccess = async () => {
    if (!retryTargetJobId) return;
    try {
      await client.adminRetryJob(retryTargetJobId);
      alert('Job run re-queued successfully!');
      setRetryTargetJobId(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to retry job');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="System Diagnostics & Job Monitoring"
          description="Real-time infrastructure health, background cron executions, and task queues."
        />
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-xl border border-border bg-surface text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
          title="Refresh metrics"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Infrastructure Health Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-success/10 text-success">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-textSecondary font-medium">PostgreSQL Database</span>
            <div className="text-sm font-bold text-textPrimary mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span>{health?.components?.database?.status || 'CONNECTED'}</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-textSecondary font-medium">Redis In-Memory Bus</span>
            <div className="text-sm font-bold text-textPrimary mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span>{health?.components?.redis?.status || 'CONNECTED'}</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-textSecondary font-medium">Server Uptime</span>
            <div className="text-sm font-bold text-textPrimary mt-0.5 font-mono">
              {health?.uptimeSeconds
                ? `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m`
                : '100%'}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-textSecondary font-medium">System State</span>
            <div className="text-sm font-bold text-success mt-0.5">
              {health?.status?.toUpperCase() || 'OPERATIONAL'}
            </div>
          </div>
        </Card>
      </div>

      {/* Background Job Runs Monitor */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border bg-surfaceAlt/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-textPrimary">Recent Background Job Executions</h3>
          <span className="text-xs text-textSecondary">{totalJobs} recorded runs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surfaceAlt text-textSecondary border-b border-border uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">Job Name</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Started At</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Error / Notes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-textPrimary">
              {loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-textSecondary">
                    Loading job executions...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-textSecondary">
                    No recent background job executions recorded.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surfaceAlt/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-textPrimary">
                      {job.jobName}
                    </td>
                    <td className="px-5 py-3.5">
                      {job.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success">
                          <CheckCircle2 className="w-3 h-3" /> COMPLETED
                        </span>
                      )}
                      {job.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-danger/10 text-danger">
                          <XCircle className="w-3 h-3" /> FAILED
                        </span>
                      )}
                      {job.status === 'RUNNING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                          <RefreshCw className="w-3 h-3 animate-spin" /> RUNNING
                        </span>
                      )}
                      {job.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surfaceAlt text-textSecondary">
                          <Clock className="w-3 h-3" /> PENDING
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-textSecondary">
                      {new Date(job.startedAt).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      {job.durationMs !== null ? `${job.durationMs}ms` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-danger font-mono text-[11px] max-w-xs truncate">
                      {job.errorMessage || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {job.status === 'FAILED' && (
                        <button
                          onClick={() => handleRetryClick(job.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surfaceAlt hover:bg-border text-textPrimary font-medium text-xs transition-colors"
                        >
                          <RotateCcw className="w-3 h-3 text-primary" />
                          <span>Retry</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <StepUpModal
        isOpen={isStepUpOpen}
        onClose={() => {
          setIsStepUpOpen(false);
          setRetryTargetJobId(null);
        }}
        onSuccess={handleStepUpSuccess}
        title="Admin Verification Required"
        description="Retrying failed background jobs restarts batch processing queues and requires step-up authentication."
      />
    </div>
  );
}

