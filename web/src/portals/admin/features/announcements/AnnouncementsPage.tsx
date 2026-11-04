import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  Send,
  Users,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
} from 'lucide-react';
import {
  ANNOUNCEMENT_STATUS,
  ROLES,
  ACCOUNT_STATUS,
  LANGUAGES,
} from '@ap/shared-constants';
import { useApi } from '../../../../shared/lib/api';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { Modal } from '../../../../shared/components/Modal';
import { Spinner } from '../../../../shared/components/Spinner';

export function AnnouncementsPage() {
  const api = useApi();

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compose Modal State
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState<'en' | 'hi' | 'gu'>('en');

  // Multilingual content
  const [titles, setTitles] = useState({ en: '', hi: '', gu: '' });
  const [bodies, setBodies] = useState({ en: '', hi: '', gu: '' });

  // Targeting
  const [targetRoles, setTargetRoles] = useState<string[]>([ROLES.DRIVER, ROLES.COMPANY]);
  const [targetStatuses, setTargetStatuses] = useState<string[]>([ACCOUNT_STATUS.APPROVED]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.adminListAnnouncements(1, 50);
      setAnnouncements(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load announcements');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleCreateAndDispatch = async () => {
    if (!titles.en.trim() || !bodies.en.trim()) {
      setError('English title and body are required at minimum');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await api.adminCreateAnnouncement({
        titleByLanguage: {
          en: titles.en.trim(),
          ...(titles.hi.trim() && { hi: titles.hi.trim() }),
          ...(titles.gu.trim() && { gu: titles.gu.trim() }),
        },
        bodyByLanguage: {
          en: bodies.en.trim(),
          ...(bodies.hi.trim() && { hi: bodies.hi.trim() }),
          ...(bodies.gu.trim() && { gu: bodies.gu.trim() }),
        },
        audience: {
          roles: targetRoles as any,
          accountStatuses: targetStatuses as any,
        },
        sendNow: true,
      });

      // Dispatch immediately
      await api.adminDispatchAnnouncement(created.id);

      setIsComposeModalOpen(false);
      setTitles({ en: '', hi: '', gu: '' });
      setBodies({ en: '', hi: '', gu: '' });
      await loadAnnouncements();
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch announcement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRole = (r: string) => {
    setTargetRoles((prev) =>
      prev.includes(r) ? prev.filter((item) => item !== r) : [...prev, r],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Announcements & Broadcasts"
          description="Send targeted push and in-app announcements in English, Hindi, and Gujarati"
        />
        <Button onClick={() => setIsComposeModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Compose Broadcast
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

      {/* Announcements Table */}
      <Card>
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Spinner />
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center text-textSecondary">
            <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No broadcast announcements yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surfaceAlt/40 text-xs font-bold text-textSecondary uppercase tracking-wider">
                  <th className="p-4">Title (EN)</th>
                  <th className="p-4">Audience</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Targeted / Sent</th>
                  <th className="p-4">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {announcements.map((a) => {
                  const title = a.titleByLanguage?.en || Object.values(a.titleByLanguage || {})[0] || 'Announcement';
                  return (
                    <tr key={a.id} className="hover:bg-surfaceAlt/20">
                      <td className="p-4">
                        <span className="font-semibold text-textPrimary block">{title}</span>
                        <span className="text-xs text-textSecondary truncate max-w-sm block">
                          {a.bodyByLanguage?.en || ''}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {a.audience?.roles?.map((r: string) => (
                            <span
                              key={r}
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-surfaceAlt border border-border text-textSecondary"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            a.status === ANNOUNCEMENT_STATUS.SENT
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : a.status === ANNOUNCEMENT_STATUS.SENDING
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-medium text-textPrimary">
                        {a.sentCount} / {a.targetCount} delivered
                      </td>
                      <td className="p-4 text-xs text-textSecondary">
                        {new Date(a.createdAt).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Compose Announcement Modal */}
      <Modal
        isOpen={isComposeModalOpen}
        onClose={() => setIsComposeModalOpen(false)}
        title="Compose Multilingual Announcement"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Language Selector */}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            {[
              { id: 'en', label: 'English' },
              { id: 'hi', label: 'Hindi (हिंदी)' },
              { id: 'gu', label: 'Gujarati (ગુજરાતી)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveLangTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeLangTab === tab.id
                    ? 'bg-primary text-primaryText'
                    : 'bg-surfaceAlt text-textSecondary hover:text-textPrimary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">
              Title ({activeLangTab.toUpperCase()})
            </label>
            <input
              type="text"
              placeholder={`Enter title in ${activeLangTab}...`}
              value={titles[activeLangTab]}
              onChange={(e) => setTitles({ ...titles, [activeLangTab]: e.target.value })}
              className="w-full bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">
              Message Body ({activeLangTab.toUpperCase()})
            </label>
            <textarea
              rows={4}
              placeholder={`Enter announcement message in ${activeLangTab}...`}
              value={bodies[activeLangTab]}
              onChange={(e) => setBodies({ ...bodies, [activeLangTab]: e.target.value })}
              className="w-full bg-surfaceAlt border border-border rounded-lg p-3 text-sm text-textPrimary"
            />
          </div>

          {/* Audience Targeting */}
          <div className="pt-2 border-t border-border">
            <span className="text-xs font-bold text-textPrimary block mb-2 uppercase tracking-wider">
              Audience Targeting
            </span>

            <div className="space-y-2">
              <span className="text-xs text-textSecondary block">Target Roles:</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-textPrimary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetRoles.includes(ROLES.DRIVER)}
                    onChange={() => toggleRole(ROLES.DRIVER)}
                  />
                  <span>Drivers</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-textPrimary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetRoles.includes(ROLES.COMPANY)}
                    onChange={() => toggleRole(ROLES.COMPANY)}
                  />
                  <span>Companies</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsComposeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAndDispatch}
              disabled={isSubmitting || !titles.en.trim() || !bodies.en.trim()}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primaryText"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Sending...' : 'Broadcast Now'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}