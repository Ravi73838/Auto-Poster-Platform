import React, { useState, useEffect } from 'react';
import { FileText, Plus, CheckCircle2, Clock, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { useApiClient } from '../../../../shared/lib/api';
import { StepUpModal } from '../../../../shared/components/StepUpModal';

interface LegalDoc {
  id: string;
  type: string;
  version: string;
  status: 'DRAFT' | 'PUBLISHED';
  title: string;
  content: string;
  effectiveAt: string;
  publishedAt: string | null;
  requiresReConsent: boolean;
  createdAt: string;
}

export function LegalDocsPage() {
  const client = useApiClient();

  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('TERMS');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [content, setContent] = useState('');
  const [requiresReConsent, setRequiresReConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Publish step-up state
  const [isStepUpOpen, setIsStepUpOpen] = useState(false);
  const [publishTargetId, setPublishTargetId] = useState<string | null>(null);

  const loadDocs = async () => {
    try {
      setLoading(true);
      const res = await client.adminListLegalDocuments();
      setDocs(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load legal documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !version || !content) {
      alert('Please fill all required fields');
      return;
    }
    try {
      setSubmitting(true);
      await client.adminCreateLegalDocument({
        type: selectedType,
        title: title.trim(),
        bodyMarkdown: content.trim(),
      });
      setIsDraftModalOpen(false);
      setTitle('');
      setVersion('');
      setContent('');
      await loadDocs();
    } catch (err: any) {
      alert(err?.message || 'Failed to create draft document');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishClick = (id: string) => {
    setPublishTargetId(id);
    setIsStepUpOpen(true);
  };

  const handleStepUpSuccess = async () => {
    if (!publishTargetId) return;
    try {
      await client.adminPublishLegalDocument(publishTargetId);
      alert('Legal document version successfully published!');
      setPublishTargetId(null);
      await loadDocs();
    } catch (err: any) {
      alert(err?.message || 'Failed to publish document');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Legal Agreements & Policy CMS"
          description="Manage Terms of Service, Privacy Policies, Driver Poster Rules, and user re-consent mandates."
        />
        <div className="flex items-center gap-2">
          <button
            onClick={loadDocs}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-surface text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsDraftModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Version Draft</span>
          </button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border bg-surfaceAlt/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-textPrimary">Legal Document Versions</h3>
          <span className="text-xs text-textSecondary">{docs.length} documents</span>
        </div>

        <div className="divide-y divide-border">
          {loading && docs.length === 0 ? (
            <div className="p-8 text-center text-xs text-textSecondary">Loading policies...</div>
          ) : docs.length === 0 ? (
            <div className="p-8 text-center text-xs text-textSecondary">
              No legal policies defined yet. Click "New Version Draft" to create one.
            </div>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 hover:bg-surfaceAlt/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-textPrimary">{doc.title}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-surfaceAlt border border-border">
                      v{doc.version}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        doc.status === 'PUBLISHED'
                          ? 'bg-success/10 text-success'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {doc.status}
                    </span>
                    {doc.requiresReConsent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-danger/10 text-danger">
                        REQUIRES RE-CONSENT
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-textSecondary mt-1 flex items-center gap-2">
                    <span>Type: {doc.type}</span>
                    <span>•</span>
                    <span>
                      Effective:{' '}
                      {doc.publishedAt
                        ? new Date(doc.publishedAt).toLocaleDateString('en-IN')
                        : 'Unpublished'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {doc.status === 'DRAFT' && (
                    <button
                      onClick={() => handlePublishClick(doc.id)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 font-medium text-xs transition-colors"
                    >
                      Publish Version
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* New Draft Modal */}
      {isDraftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateDraft}
            className="bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full p-6 text-textPrimary animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col text-xs"
          >
            <h3 className="text-base font-bold text-textPrimary mb-4">Create Policy Version Draft</h3>
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-textSecondary mb-1 font-semibold">Document Type</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs"
                  >
                    <option value="TERMS">Terms of Service</option>
                    <option value="PRIVACY">Privacy Policy</option>
                    <option value="LOCATION">Background Location Consent</option>
                    <option value="CAMERA">Live Camera Consent</option>
                    <option value="POSTER_POLICY">Poster Installation & Care Policy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-textSecondary mb-1 font-semibold">Version Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 1.2"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-textSecondary mb-1 font-semibold">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Auto Poster Master Terms of Service 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-textSecondary mb-1 font-semibold">Markdown Content</label>
                <textarea
                  rows={8}
                  placeholder="# Terms of Service&#10;&#10;Enter policy clauses..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs font-mono"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={requiresReConsent}
                  onChange={(e) => setRequiresReConsent(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-textPrimary font-medium">
                  Require all active platform users to re-consent before continuing app usage
                </span>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsDraftModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surfaceAlt text-textPrimary hover:bg-border font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 font-medium disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Draft'}
              </button>
            </div>
          </form>
        </div>
      )}

      <StepUpModal
        isOpen={isStepUpOpen}
        onClose={() => {
          setIsStepUpOpen(false);
          setPublishTargetId(null);
        }}
        onSuccess={handleStepUpSuccess}
        title="Admin Verification Required"
        description="Publishing a new legal document version impacts legal agreements and user consent obligations."
      />
    </div>
  );
}
