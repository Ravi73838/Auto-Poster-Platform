import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Save,
  Check,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { useApiClient } from '../../../../shared/lib/api';
import { StepUpModal } from '../../../../shared/components/StepUpModal';

interface SettingItem {
  id: string;
  key: string;
  value: any;
  dataType: string;
  category: string;
  description: string | null;
  isSensitive: boolean;
  requiresStepUp: boolean;
  updatedAt: string;
}

interface ChangeRequest {
  id: string;
  key: string;
  currentValue: any;
  proposedValue: any;
  reason: string;
  requestedBy: { mobile: string; role: string };
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export function SettingsPage() {
  const client = useApiClient();

  const [loading, setLoading] = useState(true);
  const [groupedSettings, setGroupedSettings] = useState<Record<string, SettingItem[]>>({});
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('PLATFORM');
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  // Review & Step-up modal state
  const [isStepUpOpen, setIsStepUpOpen] = useState(false);
  const [pendingReviewAction, setPendingReviewAction] = useState<{
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
  } | null>(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settingsRes, crRes] = await Promise.all([
        client.adminListGroupedSettings(),
        client.adminListSettingChangeRequests(),
      ]);
      setGroupedSettings(settingsRes || {});
      setChangeRequests(crRes || []);
      // Initialize edited values
      const initial: Record<string, any> = {};
      Object.values(settingsRes || {}).forEach((list: any) => {
        list.forEach((s: SettingItem) => {
          initial[s.key] = s.value;
        });
      });
      setEditedValues(initial);
      const categories = Object.keys(settingsRes || {});
      if (categories.length > 0 && categories[0] && !categories.includes(activeCategory)) {
        setActiveCategory(categories[0]);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSetting = async (setting: SettingItem) => {
    const val = editedValues[setting.key];
    const reason = reasons[setting.key] || 'Administrative update';

    try {
      const res = await client.adminRequestSettingChange({
        key: setting.key,
        value: val,
        reason,
      });

      if (res.action === 'REQUEST_CREATED') {
        alert(
          'Maker-Checker Rule: This sensitive setting change request has been submitted for secondary approval!'
        );
      } else {
        alert('Setting updated successfully!');
      }
      await loadSettings();
    } catch (err: any) {
      alert(err?.message || 'Failed to update setting');
    }
  };

  const handleReviewClick = (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setPendingReviewAction({ requestId, decision });
    setIsStepUpOpen(true);
  };

  const handleStepUpSuccess = async () => {
    if (!pendingReviewAction) return;
    try {
      await client.adminReviewSettingChange(
        pendingReviewAction.requestId,
        pendingReviewAction.decision === 'APPROVED' ? 'APPROVE' : 'REJECT'
      );
      alert(`Setting change request ${pendingReviewAction.decision.toLowerCase()} successfully!`);
      setPendingReviewAction(null);
      await loadSettings();
    } catch (err: any) {
      alert(err?.message || 'Failed to process setting approval');
    }
  };

  const categories = Object.keys(groupedSettings);
  const pendingRequests = changeRequests.filter((cr) => cr.status === 'REQUESTED');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Platform Configuration & Parameters"
          description="Manage operational thresholds, financial ratios, fraud tolerance, and maker-checker rules."
        />
        <button
          onClick={loadSettings}
          disabled={loading}
          className="p-2 rounded-xl border border-border bg-surface text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
          title="Reload parameters"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Maker-Checker Pending Change Requests Banner */}
      {pendingRequests.length > 0 && (
        <Card className="p-4 border-l-4 border-l-warning bg-warning/5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="text-sm font-bold text-textPrimary">
              Pending Maker-Checker Setting Approvals ({pendingRequests.length})
            </h3>
          </div>
          <p className="text-xs text-textSecondary">
            Sensitive parameter updates require independent verification from a second administrator before taking effect.
          </p>

          <div className="space-y-2 mt-2">
            {pendingRequests.map((cr) => (
              <div
                key={cr.id}
                className="p-3 bg-surface border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-textPrimary">{cr.key}</span>
                    <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded font-bold">
                      AWAITING CHECKER
                    </span>
                  </div>
                  <div className="text-textSecondary mt-1">
                    <span>Proposed: </span>
                    <span className="font-mono font-bold text-success">
                      {JSON.stringify(cr.proposedValue)}
                    </span>
                    <span className="mx-2">•</span>
                    <span>Current: </span>
                    <span className="font-mono line-through text-textSecondary">
                      {JSON.stringify(cr.currentValue)}
                    </span>
                  </div>
                  <div className="text-[11px] text-textSecondary mt-1">
                    <span>Reason: {cr.reason}</span>
                    <span className="mx-2">•</span>
                    <span>Requested by {cr.requestedBy?.mobile || 'Admin'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleReviewClick(cr.id, 'APPROVED')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success text-white hover:bg-success/90 font-medium transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleReviewClick(cr.id, 'REJECTED')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 font-medium transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-primary text-white shadow-sm'
                : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Settings List for Selected Category */}
      <div className="space-y-4">
        {groupedSettings[activeCategory]?.map((setting) => (
          <Card key={setting.key} className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-textPrimary">
                    {setting.key}
                  </span>
                  {setting.isSensitive && (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-danger/10 text-danger flex items-center gap-1"
                      title="Requires secondary maker-checker approval"
                    >
                      <ShieldAlert className="w-3 h-3" /> SENSITIVE
                    </span>
                  )}
                </div>
                {setting.description && (
                  <p className="text-xs text-textSecondary mt-0.5">{setting.description}</p>
                )}
              </div>

              <span className="text-[11px] font-mono text-textSecondary">
                Last modified: {new Date(setting.updatedAt).toLocaleDateString('en-IN')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="sm:col-span-2 space-y-2">
                <label className="text-[11px] font-semibold text-textSecondary uppercase block">
                  Configured Value ({setting.dataType})
                </label>
                {typeof setting.value === 'boolean' ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setEditedValues((prev) => ({ ...prev, [setting.key]: true }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        editedValues[setting.key] === true
                          ? 'border-success bg-success/10 text-success'
                          : 'border-border text-textSecondary'
                      }`}
                    >
                      ENABLED (true)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditedValues((prev) => ({ ...prev, [setting.key]: false }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        editedValues[setting.key] === false
                          ? 'border-danger bg-danger/10 text-danger'
                          : 'border-border text-textSecondary'
                      }`}
                    >
                      DISABLED (false)
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={
                      typeof editedValues[setting.key] === 'object'
                        ? JSON.stringify(editedValues[setting.key])
                        : editedValues[setting.key] ?? ''
                    }
                    onChange={(e) => {
                      let parsed: any = e.target.value;
                      if (setting.dataType === 'NUMBER') {
                        parsed = Number(e.target.value);
                      }
                      setEditedValues((prev) => ({ ...prev, [setting.key]: parsed }));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary text-xs font-mono outline-none focus:border-primary"
                  />
                )}
                {setting.isSensitive && (
                  <input
                    type="text"
                    placeholder="Provide justification reason for change request..."
                    value={reasons[setting.key] || ''}
                    onChange={(e) =>
                      setReasons((prev) => ({ ...prev, [setting.key]: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-surfaceAlt/50 text-textPrimary text-xs outline-none focus:border-primary placeholder:text-textSecondary"
                  />
                )}
              </div>

              <div className="flex sm:flex-col justify-end items-end gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveSetting(setting)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{setting.isSensitive ? 'Submit Request' : 'Save Parameter'}</span>
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <StepUpModal
        isOpen={isStepUpOpen}
        onClose={() => {
          setIsStepUpOpen(false);
          setPendingReviewAction(null);
        }}
        onSuccess={handleStepUpSuccess}
        title="Admin Verification Required"
        description="Approving or rejecting a sensitive platform parameter requires step-up authentication."
      />
    </div>
  );
}
