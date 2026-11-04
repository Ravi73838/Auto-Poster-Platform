import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Calendar,
  Truck,
  IndianRupee,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { CAMPAIGN_STATUS, type CampaignStatus } from '@ap/shared-constants';
import type { CampaignDto } from '@ap/shared-types';
import { useApi } from '../../../../shared/lib/api';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Spinner } from '../../../../shared/components/Spinner';
import { EmptyState } from '../../../../shared/components/EmptyState';

const STATUS_TABS: { label: string; value?: CampaignStatus }[] = [
  { label: 'All' },
  { label: 'Draft', value: CAMPAIGN_STATUS.DRAFT },
  { label: 'Under Review', value: CAMPAIGN_STATUS.UNDER_REVIEW },
  { label: 'Awaiting Payment', value: CAMPAIGN_STATUS.AWAITING_PAYMENT },
  { label: 'Active', value: CAMPAIGN_STATUS.LIVE },
  { label: 'Completed', value: CAMPAIGN_STATUS.COMPLETED },
  { label: 'Rejected', value: CAMPAIGN_STATUS.REJECTED },
];

export function CampaignsPage() {
  const { t } = useTranslation();
  const api = useApi();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<CampaignDto[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<CampaignStatus | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.listCompanyCampaigns({
        status: selectedStatus,
        search: searchQuery.trim() || undefined,
        page: 1,
        pageSize: 50,
        sortOrder: 'desc',
      });
      setCampaigns(res.items);
      setCounts(res.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, [api, selectedStatus, searchQuery]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case CAMPAIGN_STATUS.DRAFT:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surfaceAlt text-textSecondary border border-border">Draft</span>;
      case CAMPAIGN_STATUS.SUBMITTED:
      case CAMPAIGN_STATUS.UNDER_REVIEW:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" /> Under Review
          </span>
        );
      case CAMPAIGN_STATUS.APPROVED:
      case CAMPAIGN_STATUS.AWAITING_PAYMENT:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
            <AlertTriangle className="w-3 h-3" /> Awaiting Payment
          </span>
        );
      case CAMPAIGN_STATUS.LIVE:
      case CAMPAIGN_STATUS.RUNNING:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> {status === CAMPAIGN_STATUS.LIVE ? 'Live (Enrolling)' : 'Running'}
          </span>
        );
      case CAMPAIGN_STATUS.COMPLETED:
      case CAMPAIGN_STATUS.SETTLED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            Completed
          </span>
        );
      case CAMPAIGN_STATUS.REJECTED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" /> Action Required
          </span>
        );
      case CAMPAIGN_STATUS.CANCELLED:
      case CAMPAIGN_STATUS.EXPIRED:
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surfaceAlt text-textSecondary">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={t('campaigns.title', 'Campaigns')}
          description={t('campaigns.subtitle', 'Create, manage, and monitor your auto-rickshaw poster campaigns')}
        />
        <Button
          variant="primary"
          onClick={() => navigate('/company/campaigns/new')}
          className="inline-flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {t('campaigns.createButton', 'Create Campaign')}
        </Button>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const count = tab.value ? (counts[tab.value] ?? 0) : (counts.ALL ?? 0);
            const isActive = selectedStatus === tab.value;
            return (
              <button
                key={tab.label}
                onClick={() => setSelectedStatus(tab.value)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primaryText shadow-sm'
                    : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-primaryText/20 text-primaryText' : 'bg-surfaceAlt text-textSecondary'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
          <input
            type="text"
            placeholder={t('campaigns.searchPlaceholder', 'Search campaigns...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-textPrimary placeholder:text-textSecondary/60 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Spinner />
        </div>
      ) : error ? (
        <Card className="p-6 text-center text-red-500">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={loadCampaigns} className="mt-4">
            Retry
          </Button>
        </Card>
      ) : campaigns.length === 0 ? (
        <EmptyState
          title={t('campaigns.emptyTitle', 'No campaigns found')}
          description={
            selectedStatus
              ? `There are no campaigns matching status "${selectedStatus}".`
              : t('campaigns.emptyDescription', 'You haven\'t created any advertising campaigns yet. Start promoting your brand on auto-rickshaws.')
          }
          action={
            <Button variant="primary" onClick={() => navigate('/company/campaigns/new')}>
              {t('campaigns.createButton', 'Create Campaign')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => {
            const rentFormatted = (c.rentPer30DaysPaise / 100).toLocaleString('en-IN');
            const totalBudgetFormatted = (Number(BigInt(c.totalChargedPaise)) / 100).toLocaleString('en-IN');
            const isAwaitingPayment = c.status === CAMPAIGN_STATUS.AWAITING_PAYMENT;
            const isRejected = c.status === CAMPAIGN_STATUS.REJECTED;

            return (
              <Card
                key={c.id}
                className={`relative flex flex-col justify-between overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-md ${
                  isAwaitingPayment ? 'ring-2 ring-amber-500/30' : ''
                } ${isRejected ? 'ring-2 ring-red-500/30' : ''}`}
                onClick={() => navigate(`/company/campaigns/${c.id}`)}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-textPrimary text-base line-clamp-1">{c.title}</h3>
                    {getStatusBadge(c.status)}
                  </div>

                  {c.description && (
                    <p className="text-xs text-textSecondary line-clamp-2 mb-4">{c.description}</p>
                  )}

                  <div className="space-y-2 text-xs text-textSecondary mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-textSecondary shrink-0" />
                      <span>
                        {c.startDate} to {c.endDate} ({c.durationDays} days)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Truck className="w-3.5 h-3.5 text-textSecondary shrink-0" />
                      <span>{c.slots} Auto-rickshaws ({c.cityName || 'Citywide'})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <IndianRupee className="w-3.5 h-3.5 text-textSecondary shrink-0" />
                      <span>
                        ₹{rentFormatted} / 30d per auto &bull; Total: ₹{totalBudgetFormatted}
                      </span>
                    </div>
                  </div>

                  {isRejected && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 mb-3">
                      Review feedback received. Click to update & resubmit.
                    </div>
                  )}

                  {isAwaitingPayment && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 mb-3">
                      Poster approved! Ready for payment to go live.
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-textSecondary">
                  <span>Rev: #{c.revisionCount || 1}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    <Eye className="w-3.5 h-3.5" /> View Details
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
