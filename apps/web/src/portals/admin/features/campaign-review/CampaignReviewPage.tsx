import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Search,
  Filter,
  Eye,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { CAMPAIGN_STATUS, type CampaignStatus } from '@ap/shared-constants';
import { useApi } from '../../../../shared/lib/api';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { Spinner } from '../../../../shared/components/Spinner';
import { CampaignReviewModal } from './CampaignReviewModal';

export function CampaignReviewPage() {
  const { t } = useTranslation();
  const api = useApi();

  const [activeTab, setActiveTab] = useState<'queue' | 'all'>('queue');
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Modal State
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [isClaimNextLoading, setIsClaimNextLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [slaBreachedOnly, setSlaBreachedOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);

  // Load cities
  useEffect(() => {
    async function loadCities() {
      try {
        const res = await api.listCities();
        setCities(res);
      } catch {
        setCities([]);
      }
    }
    loadCities();
  }, [api]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'queue') {
        const queue = await api.getCampaignReviewQueue();
        setQueueItems(queue);
      } else {
        const res = await api.listAdminCampaigns({
          search: searchQuery.trim() || undefined,
          cityId: selectedCityId || undefined,
          assignedToMe: assignedToMeOnly || undefined,
          unassigned: unassignedOnly || undefined,
          page: 1,
          pageSize: 50,
          sortOrder: 'desc',
        });
        setAllItems(res.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, [api, activeTab, searchQuery, selectedCityId, assignedToMeOnly, unassignedOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClaimNext = async () => {
    setIsClaimNextLoading(true);
    setError(null);
    try {
      const res = await api.claimNextCampaign();
      if (res) {
        setActiveReviewId(res.id);
        loadData();
      } else {
        setError('No unassigned campaigns available to claim');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No unassigned campaigns available to claim');
    } finally {
      setIsClaimNextLoading(false);
    }
  };

  const filteredQueueItems = queueItems.filter((item) => {
    if (selectedCityId && item.cityId !== selectedCityId) return false;
    if (slaBreachedOnly && !item.isSlaBreached) return false;
    if (unassignedOnly && item.assignedToId) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(query);
      const matchCompany = item.companyName?.toLowerCase().includes(query);
      if (!matchTitle && !matchCompany) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Campaign Artwork Review"
          description="Review poster compliance, safety, print specs, and approve campaigns for payment"
        />

        <Button
          variant="primary"
          onClick={handleClaimNext}
          isLoading={isClaimNextLoading}
          className="inline-flex items-center gap-2 self-start sm:self-auto shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>Claim Next Available</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'queue'
              ? 'bg-primary text-primaryText shadow-sm'
              : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Review Queue</span>
          <span className="text-xs px-1.5 py-0.2 rounded-full bg-primaryText/20 text-primaryText">
            {queueItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-primary text-primaryText shadow-sm'
              : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt'
          }`}
        >
          <span>All Platform Campaigns</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* City Filter */}
          <select
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="">All Cities</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>

          {activeTab === 'queue' && (
            <label className="flex items-center gap-1.5 text-xs text-textSecondary cursor-pointer hover:text-textPrimary">
              <input
                type="checkbox"
                checked={slaBreachedOnly}
                onChange={(e) => setSlaBreachedOnly(e.target.checked)}
                className="rounded border-border text-red-500 focus:ring-red-500"
              />
              <span className="text-red-500 font-medium">SLA Breached Only</span>
            </label>
          )}

          <label className="flex items-center gap-1.5 text-xs text-textSecondary cursor-pointer hover:text-textPrimary">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span>Unassigned Only</span>
          </label>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
          <input
            type="text"
            placeholder="Search campaigns or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Content */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Spinner />
          </div>
        ) : activeTab === 'queue' ? (
          filteredQueueItems.length === 0 ? (
            <div className="py-16 text-center text-textSecondary text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-textPrimary text-sm">Review Queue Clear</p>
              <p className="mt-1">No pending campaigns waiting for artwork review.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surfaceAlt/60 text-textSecondary border-b border-border uppercase font-medium text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Campaign / Advertiser</th>
                    <th className="px-4 py-3">City & Slots</th>
                    <th className="px-4 py-3">Monthly Rate</th>
                    <th className="px-4 py-3">Waiting Time</th>
                    <th className="px-4 py-3">Review SLA</th>
                    <th className="px-4 py-3">Reviewer</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredQueueItems.map((item) => {
                    const hours = Math.floor(item.waitingTimeMinutes / 60);
                    const mins = item.waitingTimeMinutes % 60;
                    const waitFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                    return (
                      <tr key={item.id} className="hover:bg-surfaceAlt/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-textPrimary text-sm block line-clamp-1">{item.title}</span>
                          <span className="text-textSecondary text-[11px]">{item.companyName}</span>
                        </td>
                        <td className="px-4 py-3.5 text-textSecondary">
                          <span className="text-textPrimary font-medium block">{item.cityName || 'Citywide'}</span>
                          <span>{item.slots} Auto-rickshaws</span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-textPrimary">
                          ₹{(item.rentPer30DaysPaise / 100).toLocaleString('en-IN')} / 30d
                        </td>
                        <td className="px-4 py-3.5 text-textSecondary font-mono text-[11px]">
                          {waitFormatted}
                        </td>
                        <td className="px-4 py-3.5">
                          {item.isSlaBreached ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse">
                              <AlertTriangle className="w-3 h-3" /> SLA BREACHED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              Within SLA
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-textSecondary text-[11px]">
                          {item.assignedToName ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <Lock className="w-3 h-3" /> {item.assignedToName}
                            </span>
                          ) : (
                            <span className="text-textSecondary/60 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setActiveReviewId(item.id)}
                            className="text-xs py-1 px-3"
                          >
                            Review Poster
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* All Campaigns Tab */
          allItems.length === 0 ? (
            <div className="py-16 text-center text-textSecondary text-xs">
              <p>No campaigns matching search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surfaceAlt/60 text-textSecondary border-b border-border uppercase font-medium text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Slots</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allItems.map((item) => (
                    <tr key={item.id} className="hover:bg-surfaceAlt/40 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-textPrimary">{item.title}</td>
                      <td className="px-4 py-3.5 text-textSecondary">{item.companyName}</td>
                      <td className="px-4 py-3.5 text-textSecondary">{item.cityName || 'Citywide'}</td>
                      <td className="px-4 py-3.5 text-textSecondary">{item.startDate} to {item.endDate}</td>
                      <td className="px-4 py-3.5 text-textSecondary">{item.targetAutoCount}</td>
                      <td className="px-4 py-3.5 font-medium">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-surfaceAlt border border-border">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveReviewId(item.id)}
                          className="text-xs py-1 px-2.5"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>

      {/* Review Modal */}
      {activeReviewId && (
        <CampaignReviewModal
          campaignId={activeReviewId}
          onClose={() => setActiveReviewId(null)}
          onDecisionComplete={() => {
            setActiveReviewId(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
