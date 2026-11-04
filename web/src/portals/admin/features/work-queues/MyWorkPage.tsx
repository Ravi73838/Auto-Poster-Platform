import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Megaphone,
  Truck,
  Eye,
  FileText,
  IndianRupee,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { useApiClient } from '../../../../shared/lib/api';

interface WorkItem {
  id: string;
  queue: string;
  title: string;
  subtitle: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
  status: string;
  createdAt: string;
  slaDueAt: string;
  link: string;
}

export function MyWorkPage() {
  const client = useApiClient();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Record<string, { count: number; urgentCount: number }>>({});
  const [myWorkItems, setMyWorkItems] = useState<WorkItem[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumRes, itemsRes] = await Promise.all([
        client.adminGetWorkQueuesSummary(),
        client.adminGetMyWork(),
      ]);
      const summaryMap: Record<string, { count: number; urgentCount: number }> = {};
      (sumRes?.queues || []).forEach((q: any) => {
        summaryMap[q.queue] = { count: q.count, urgentCount: q.urgentCount };
      });
      setSummary(summaryMap);
      setMyWorkItems(Array.isArray(itemsRes) ? itemsRes : []);
    } catch (err) {
      console.error('Failed to load my work:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const queueCards = [
    { key: 'kyc', title: 'KYC Reviews', icon: ShieldCheck, link: '/admin/drivers?kycStatus=SUBMITTED', color: 'text-warning' },
    { key: 'campaigns', title: 'Campaign Approvals', icon: Megaphone, link: '/admin/campaigns', color: 'text-primary' },
    { key: 'installations', title: 'Poster Installations', icon: Truck, link: '/admin/installations', color: 'text-blue-500' },
    { key: 'dailyPhotos', title: 'Daily Photo Checks', icon: Eye, link: '/admin/photo-review', color: 'text-emerald-500' },
    { key: 'disputes', title: 'Driver/Co Disputes', icon: AlertTriangle, link: '/admin/disputes', color: 'text-danger' },
    { key: 'adjustments', title: 'Manual Adjustments', icon: IndianRupee, link: '/admin/finance', color: 'text-purple-500' },
    { key: 'settings', title: 'Setting Change Requests', icon: Sliders, link: '/admin/settings', color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Operations Work Queues & My-Work"
          description="Consolidated task queues, assigned claims, and SLA tracking across all administrative modules."
        />
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-xl border border-border bg-surface text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
          title="Refresh queues"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Overview of Queues */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {queueCards.map((qc) => {
          const Icon = qc.icon;
          const stats = summary[qc.key] || { count: 0, urgentCount: 0 };
          return (
            <a
              key={qc.key}
              href={qc.link}
              className="p-4 rounded-xl border border-border bg-surface hover:bg-surfaceAlt/60 transition-colors block"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-xl bg-surfaceAlt ${qc.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {stats.urgentCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger/10 text-danger">
                    {stats.urgentCount} SLA alert
                  </span>
                )}
              </div>
              <div className="mt-3">
                <span className="text-xs text-textSecondary font-medium block">{qc.title}</span>
                <span className="text-xl font-bold text-textPrimary mt-0.5 block">{stats.count}</span>
              </div>
            </a>
          );
        })}
      </div>

      {/* My Claimed Work Items */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border bg-surfaceAlt/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-textPrimary">My Claimed Assignments ({myWorkItems.length})</h3>
          </div>
          <span className="text-xs text-textSecondary">
            Items assigned directly to your operator account
          </span>
        </div>

        <div className="divide-y divide-border">
          {loading && myWorkItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-textSecondary">
              Loading your active tasks...
            </div>
          ) : myWorkItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-textSecondary flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-success" />
              <span className="font-semibold text-textPrimary text-sm">Inbox Zero!</span>
              <span>You have no pending claimed review items. Pick tasks from the queues above.</span>
            </div>
          ) : (
            myWorkItems.map((item) => (
              <div
                key={`${item.queue}-${item.id}`}
                className="p-4 hover:bg-surfaceAlt/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-textPrimary text-sm">{item.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.priority === 'CRITICAL'
                          ? 'bg-danger/10 text-danger'
                          : item.priority === 'HIGH'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-surfaceAlt text-textSecondary'
                      }`}
                    >
                      {item.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-surfaceAlt text-textSecondary font-mono">
                      {item.status}
                    </span>
                  </div>
                  <div className="text-textSecondary mt-1 flex items-center gap-2 text-[11px]">
                    <span>{item.subtitle}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-textSecondary" />
                      SLA Due: {new Date(item.slaDueAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <a
                  href={item.link}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 font-medium transition-colors text-xs shrink-0 self-start md:self-auto"
                >
                  <span>Open Task</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
