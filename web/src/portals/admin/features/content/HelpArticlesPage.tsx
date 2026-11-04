import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, Edit2, Trash2, Eye, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { useApiClient } from '../../../../shared/lib/api';

interface HelpArticle {
  id: string;
  slug: string;
  category: string;
  title: string;
  body: string;
  audience: string;
  isPublished: boolean;
  order: number;
  updatedAt: string;
}

export function HelpArticlesPage() {
  const client = useApiClient();

  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [audience, setAudience] = useState('ALL');
  const [body, setBody] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const res = await client.adminListHelpArticles();
      setArticles(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load help articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const openCreateModal = () => {
    setEditingArticle(null);
    setTitle('');
    setSlug('');
    setCategory('GENERAL');
    setAudience('ALL');
    setBody('');
    setIsPublished(true);
    setIsModalOpen(true);
  };

  const openEditModal = (article: HelpArticle) => {
    setEditingArticle(article);
    setTitle(article.title);
    setSlug(article.slug);
    setCategory(article.category);
    setAudience(article.audience);
    setBody(article.body);
    setIsPublished(article.isPublished);
    setIsModalOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingArticle) {
        await client.adminUpdateHelpArticle(editingArticle.id, {
          title,
          category,
          audience,
          bodyMarkdown: body,
          published: isPublished,
        });
      } else {
        await client.adminCreateHelpArticle({
          title,
          category,
          bodyMarkdown: body,
          published: isPublished,
        });
      }
      setIsModalOpen(false);
      await loadArticles();
    } catch (err: any) {
      alert(err?.message || 'Failed to save help article');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this help article?')) return;
    try {
      await client.adminDeleteHelpArticle(id);
      await loadArticles();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete help article');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Knowledge Base & Help Center CMS"
          description="Manage public and authenticated user FAQs, driver guides, and campaign onboarding walkthroughs."
        />
        <div className="flex items-center gap-2">
          <button
            onClick={loadArticles}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-surface text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Help Article</span>
          </button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border bg-surfaceAlt/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-textPrimary">Published Knowledge Base Articles</h3>
          <span className="text-xs text-textSecondary">{articles.length} articles</span>
        </div>

        <div className="divide-y divide-border">
          {loading && articles.length === 0 ? (
            <div className="p-8 text-center text-xs text-textSecondary">Loading articles...</div>
          ) : articles.length === 0 ? (
            <div className="p-8 text-center text-xs text-textSecondary">
              No help articles found. Click "New Help Article" to write one.
            </div>
          ) : (
            articles.map((art) => (
              <div
                key={art.id}
                className="p-4 hover:bg-surfaceAlt/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-textPrimary">{art.title}</span>
                    <span className="font-mono text-[11px] text-textSecondary">/{art.slug}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        art.isPublished
                          ? 'bg-success/10 text-success'
                          : 'bg-surfaceAlt text-textSecondary'
                      }`}
                    >
                      {art.isPublished ? 'PUBLISHED' : 'DRAFT'}
                    </span>
                  </div>
                  <div className="text-[11px] text-textSecondary mt-1 flex items-center gap-2">
                    <span className="font-medium text-primary uppercase">{art.category}</span>
                    <span>•</span>
                    <span>Audience: {art.audience}</span>
                    <span>•</span>
                    <span>Last updated: {new Date(art.updatedAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(art)}
                    className="p-1.5 rounded-lg border border-border text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
                    title="Edit article"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(art.id)}
                    className="p-1.5 rounded-lg border border-border text-danger hover:bg-danger/10 transition-colors"
                    title="Delete article"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Article Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveArticle}
            className="bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full p-6 text-textPrimary animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col text-xs"
          >
            <h3 className="text-base font-bold text-textPrimary mb-4">
              {editingArticle ? 'Edit Help Article' : 'Create Help Article'}
            </h3>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-textSecondary mb-1 font-semibold">Title</label>
                <input
                  type="text"
                  placeholder="e.g. How to install posters properly on your auto"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-textSecondary mb-1 font-semibold">Slug URL</label>
                  <input
                    type="text"
                    placeholder="how-to-install-posters"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-textSecondary mb-1 font-semibold">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs"
                  >
                    <option value="GENERAL">General</option>
                    <option value="DRIVERS">Drivers</option>
                    <option value="COMPANIES">Companies</option>
                    <option value="PAYMENTS">Payments & Ledger</option>
                    <option value="DISPUTES">Disputes & Penalties</option>
                  </select>
                </div>
                <div>
                  <label className="block text-textSecondary mb-1 font-semibold">Audience</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs"
                  >
                    <option value="ALL">Public / Everyone</option>
                    <option value="DRIVER">Drivers Only</option>
                    <option value="COMPANY">Companies Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-textSecondary mb-1 font-semibold">Article Content (Markdown)</label>
                <textarea
                  rows={8}
                  placeholder="## Step 1: Clean the rear auto surface..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs font-mono"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-textPrimary font-medium">Publish immediately (visible to users)</span>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surfaceAlt text-textPrimary hover:bg-border font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 font-medium disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Article'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
