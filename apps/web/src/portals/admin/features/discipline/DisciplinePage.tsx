import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  Search,
  Filter,
  Plus,
  RotateCcw,
  Clock,
  UserX,
  FileWarning,
} from 'lucide-react';
import {
  STRIKE_STATUS,
  STRIKE_REASONS,
  BAN_TYPES,
  type StrikeStatus,
  type StrikeReason,
} from '@ap/shared-constants';
import { useApi } from '../../../../shared/lib/api';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { Modal } from '../../../../shared/components/Modal';
import { Spinner } from '../../../../shared/components/Spinner';

export function DisciplinePage() {
  const api = useApi();

  const [activeTab, setActiveTab] = useState<'strikes' | 'bans'>('strikes');
  const [strikes, setStrikes] = useState<any[]>([]);
  const [bans, setBans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchDriverId, setSearchDriverId] = useState('');

  // Modals
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [targetDriverId, setTargetDriverId] = useState('');
  const [targetAssignmentId, setTargetAssignmentId] = useState('');
  const [strikeReason, setStrikeReason] = useState<StrikeReason>(STRIKE_REASONS.FAKE_OR_OLD_PHOTO);
  const [strikeNotes, setStrikeNotes] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);

  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [selectedStrikeId, setSelectedStrikeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const [isLiftBanModalOpen, setIsLiftBanModalOpen] = useState(false);
  const [selectedBanId, setSelectedBanId] = useState<string | null>(null);
  const [liftReason, setLiftReason] = useState('');
  const [isLifting, setIsLifting] = useState(false);

  // Driver discipline details modal
  const [inspectDriverId, setInspectDriverId] = useState<string | null>(null);
  const [driverDisciplineData, setDriverDisciplineData] = useState<any | null>(null);
  const [isInspectLoading, setIsInspectLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (activeTab === 'strikes') {
        const res = await api.adminListStrikes(
          1,
          50,
          searchDriverId ? searchDriverId.trim() : undefined,
          statusFilter ? (statusFilter as any) : undefined,
        );
        setStrikes(res.data || []);
      } else {
        const res = await api.adminListBans(
          1,
          50,
          searchDriverId ? searchDriverId.trim() : undefined,
        );
        setBans(res.data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load discipline records');
    } finally {
      setIsLoading(false);
    }
  }, [api, activeTab, statusFilter, searchDriverId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleIssueStrike = async () => {
    if (!targetDriverId.trim() || !strikeNotes.trim()) return;
    try {
      setIsIssuing(true);
      await api.adminIssueStrike({
        driverId: targetDriverId.trim(),
        assignmentId: targetAssignmentId.trim() || undefined,
        reason: strikeReason as any,
        note: strikeNotes.trim(),
      });
      setIsIssueModalOpen(false);
      setTargetDriverId('');
      setTargetAssignmentId('');
      setStrikeNotes('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to issue strike');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleRevokeStrike = async () => {
    if (!selectedStrikeId || !revokeReason.trim()) return;
    try {
      setIsRevoking(true);
      await api.adminRevokeStrike(selectedStrikeId, {
        reason: revokeReason.trim(),
      });
      setIsRevokeModalOpen(false);
      setSelectedStrikeId(null);
      setRevokeReason('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to revoke strike');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleLiftBan = async () => {
    if (!selectedBanId || !liftReason.trim()) return;
    try {
      setIsLifting(true);
      await api.adminLiftBan(selectedBanId, {
        reason: liftReason.trim(),
      });
      setIsLiftBanModalOpen(false);
      setSelectedBanId(null);
      setLiftReason('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to lift ban');
    } finally {
      setIsLifting(false);
    }
  };

  const handleInspectDriver = async (driverId: string) => {
    try {
      setInspectDriverId(driverId);
      setIsInspectLoading(true);
      const data = await api.adminGetDriverDiscipline(driverId);
      setDriverDisciplineData(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load driver discipline overview');
    } finally {
      setIsInspectLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Discipline, Strikes & Bans"
          description="Manage automated fraud strikes, 3-strike bans, temporary suspensions, and poster-fix notices"
        />
        <Button onClick={() => setIsIssueModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Issue Strike
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between">
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('strikes')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'strikes'
              ? 'border-primary text-primary'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Strikes Log
        </button>
        <button
          onClick={() => setActiveTab('bans')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'bans'
              ? 'border-primary text-primary'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Suspensions & Bans
        </button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
            <input
              type="text"
              placeholder="Search by Driver User ID..."
              value={searchDriverId}
              onChange={(e) => setSearchDriverId(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surfaceAlt border border-border rounded-lg text-sm text-textPrimary focus:outline-none focus:border-primary"
            />
          </div>

          {activeTab === 'strikes' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value={STRIKE_STATUS.ACTIVE}>Active</option>
              <option value={STRIKE_STATUS.CONSUMED}>Consumed in Ban</option>
              <option value={STRIKE_STATUS.REVOKED}>Revoked</option>
              <option value={STRIKE_STATUS.EXPIRED}>Expired</option>
            </select>
          )}

          <Button variant="outline" size="sm" onClick={loadData}>
            Refresh
          </Button>
        </div>
      </Card>

      {/* Table Content */}
      <Card>
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Spinner />
          </div>
        ) : activeTab === 'strikes' ? (
          strikes.length === 0 ? (
            <div className="p-12 text-center text-textSecondary">
              <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No strike records found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surfaceAlt/40 text-xs font-bold text-textSecondary uppercase tracking-wider">
                    <th className="p-4">Driver</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4">Source</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Issued At</th>
                    <th className="p-4">Expires At</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {strikes.map((s) => (
                    <tr key={s.id} className="hover:bg-surfaceAlt/20">
                      <td className="p-4">
                        <button
                          onClick={() => handleInspectDriver(s.driverId)}
                          className="font-medium text-primary hover:underline text-left block"
                        >
                          {s.driver?.driverProfile?.fullName || s.driver?.mobile || s.driverId.slice(0, 8)}
                        </button>
                        <span className="text-[10px] text-textSecondary">{s.driverId.slice(0, 8)}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-textPrimary">{s.reason}</span>
                        {s.notes && <p className="text-xs text-textSecondary truncate max-w-xs">{s.notes}</p>}
                      </td>
                      <td className="p-4">
                        <span className="text-xs px-2 py-0.5 rounded bg-surfaceAlt border border-border text-textSecondary">
                          {s.source}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            s.status === STRIKE_STATUS.ACTIVE
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : s.status === STRIKE_STATUS.CONSUMED
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : s.status === STRIKE_STATUS.REVOKED
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-textSecondary">
                        {new Date(s.issuedAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="p-4 text-xs text-textSecondary">
                        {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                      <td className="p-4 text-right">
                        {(s.status === STRIKE_STATUS.ACTIVE || s.status === STRIKE_STATUS.CONSUMED) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedStrikeId(s.id);
                              setIsRevokeModalOpen(true);
                            }}
                            className="text-xs"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : bans.length === 0 ? (
          <div className="p-12 text-center text-textSecondary">
            <UserX className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No driver suspensions or bans found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surfaceAlt/40 text-xs font-bold text-textSecondary uppercase tracking-wider">
                  <th className="p-4">Driver</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Starts At</th>
                  <th className="p-4">Ends At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bans.map((b) => {
                  const isActive = !b.liftedAt && (!b.endsAt || new Date(b.endsAt) > new Date());
                  return (
                    <tr key={b.id} className="hover:bg-surfaceAlt/20">
                      <td className="p-4">
                        <button
                          onClick={() => handleInspectDriver(b.driverId)}
                          className="font-medium text-primary hover:underline text-left block"
                        >
                          {b.driver?.driverProfile?.fullName || b.driver?.mobile || b.driverId.slice(0, 8)}
                        </button>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold ${
                            b.type === BAN_TYPES.PERMANENT
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {b.type}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-medium text-textPrimary max-w-xs truncate">
                        {b.reason}
                      </td>
                      <td className="p-4 text-xs text-textSecondary">
                        {new Date(b.startsAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="p-4 text-xs text-textSecondary">
                        {b.endsAt ? new Date(b.endsAt).toLocaleDateString('en-IN') : 'Permanent'}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            isActive
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}
                        >
                          {isActive ? 'Active Ban' : b.liftedAt ? 'Lifted' : 'Expired'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedBanId(b.id);
                              setIsLiftBanModalOpen(true);
                            }}
                            className="text-xs"
                          >
                            Lift Ban
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Issue Strike Modal */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title="Issue Manual Driver Strike"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Driver User ID</label>
            <input
              type="text"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={targetDriverId}
              onChange={(e) => setTargetDriverId(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Assignment ID (Optional)</label>
            <input
              type="text"
              placeholder="Optional linked assignment UUID"
              value={targetAssignmentId}
              onChange={(e) => setTargetAssignmentId(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Reason</label>
            <select
              value={strikeReason}
              onChange={(e) => setStrikeReason(e.target.value as StrikeReason)}
              className="w-full bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary"
            >
              <option value={STRIKE_REASONS.FAKE_OR_OLD_PHOTO}>Fake or Old Photo</option>
              <option value={STRIKE_REASONS.POSTER_REMOVED}>Poster Removed</option>
              <option value={STRIKE_REASONS.POSTER_DAMAGED_NOT_FIXED}>Poster Damaged (48h Notice Expired)</option>
              <option value={STRIKE_REASONS.TOO_MANY_MISSED_DAYS}>Too Many Missed Days</option>
              <option value={STRIKE_REASONS.OTHER}>Other Violation</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Audit Notes & Details</label>
            <textarea
              rows={3}
              placeholder="Detailed justification for this disciplinary action..."
              value={strikeNotes}
              onChange={(e) => setStrikeNotes(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg p-3 text-sm text-textPrimary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsIssueModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleIssueStrike}
              disabled={isIssuing || !targetDriverId.trim() || !strikeNotes.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isIssuing ? 'Issuing...' : 'Issue Strike'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Revoke Strike Modal */}
      <Modal
        isOpen={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
        title="Revoke Driver Strike"
      >
        <div className="space-y-4">
          <p className="text-xs text-textSecondary">
            Revoking an active or consumed strike will re-evaluate the driver&apos;s penalty ladder and may lift an associated temporary ban.
          </p>
          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Reason for Revocation</label>
            <textarea
              rows={3}
              placeholder="e.g. Overturned on review of original photographic proof..."
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg p-3 text-sm text-textPrimary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsRevokeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRevokeStrike}
              disabled={isRevoking || !revokeReason.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isRevoking ? 'Revoking...' : 'Confirm Revoke'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lift Ban Modal */}
      <Modal
        isOpen={isLiftBanModalOpen}
        onClose={() => setIsLiftBanModalOpen(false)}
        title="Lift Suspension / Ban"
      >
        <div className="space-y-4">
          <p className="text-xs text-textSecondary">
            Lifting this ban restores the driver&apos;s eligibility to reserve new campaign slots.
          </p>
          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Reason for Lifting</label>
            <textarea
              rows={3}
              placeholder="State rationale for early suspension lift..."
              value={liftReason}
              onChange={(e) => setLiftReason(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg p-3 text-sm text-textPrimary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsLiftBanModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLiftBan}
              disabled={isLifting || !liftReason.trim()}
              className="bg-primary hover:bg-primary/90 text-primaryText"
            >
              {isLifting ? 'Lifting...' : 'Confirm Lift Ban'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Driver Discipline Overview Drawer/Modal */}
      <Modal
        isOpen={Boolean(inspectDriverId)}
        onClose={() => {
          setInspectDriverId(null);
          setDriverDisciplineData(null);
        }}
        title="Driver Discipline Profile"
      >
        {isInspectLoading ? (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        ) : !driverDisciplineData ? (
          <p className="text-sm text-textSecondary">No data available.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-surfaceAlt text-xs">
              <div>
                <span className="text-textSecondary block">Active Strikes:</span>
                <span className="font-bold text-red-400 text-base">
                  {driverDisciplineData.activeStrikesCount} / 3
                </span>
              </div>
              <div>
                <span className="text-textSecondary block">Current Status:</span>
                <span
                  className={`font-bold ${
                    driverDisciplineData.isBanned ? 'text-red-500' : 'text-green-400'
                  }`}
                >
                  {driverDisciplineData.isBanned
                    ? `Banned until ${new Date(driverDisciplineData.bannedUntil).toLocaleDateString()}`
                    : 'Good Standing'}
                </span>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase text-textSecondary mb-2">History of Strikes</h5>
              {driverDisciplineData.strikes?.length === 0 ? (
                <p className="text-xs text-textSecondary">Clean record — no strikes.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {driverDisciplineData.strikes.map((st: any) => (
                    <div key={st.id} className="p-2 rounded border border-border text-xs flex justify-between">
                      <div>
                        <span className="font-bold text-textPrimary">{st.reason}</span>
                        <p className="text-[10px] text-textSecondary">{st.notes}</p>
                      </div>
                      <span className="font-semibold text-textSecondary">{st.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setInspectDriverId(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}