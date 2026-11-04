import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  Building,
  Car,
  CheckSquare,
  AlertTriangle,
  CreditCard,
  Banknote,
  Loader2,
  X,
} from 'lucide-react';
import { useApiClient } from '../../../shared/lib/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const client = useApiClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any[]>>({});
  const [totalMatches, setTotalMatches] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({});
      setTotalMatches(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle or open
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({});
      setTotalMatches(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await client.adminSearch(query.trim());
        setResults(res.results || {});
        setTotalMatches(res.totalMatches || 0);
      } catch {
        setResults({});
        setTotalMatches(0);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, client]);

  if (!isOpen) return null;

  const handleSelect = (link: string) => {
    onClose();
    navigate(link);
  };

  const categoryIcons: Record<string, typeof Users> = {
    drivers: Users,
    companies: Building,
    vehicles: Car,
    campaigns: CheckSquare,
    disputes: AlertTriangle,
    payments: CreditCard,
    payouts: Banknote,
  };

  const categoryNames: Record<string, string> = {
    drivers: 'Drivers',
    companies: 'Companies',
    vehicles: 'Vehicles',
    campaigns: 'Campaigns',
    disputes: 'Disputes',
    payments: 'Payments',
    payouts: 'Payouts',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden text-textPrimary animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-textSecondary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drivers, companies, vehicles, campaigns, disputes..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-textSecondary"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-textSecondary shrink-0" />}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-surfaceAlt rounded text-textSecondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-textSecondary bg-surfaceAlt border border-border rounded">
            ESC
          </kbd>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/40">
          {query.trim().length >= 2 && totalMatches === 0 && !loading && (
            <div className="p-8 text-center text-sm text-textSecondary">
              No matching records found for "{query}".
            </div>
          )}

          {query.trim().length < 2 && (
            <div className="p-6 text-center text-xs text-textSecondary">
              Type at least 2 characters to search across platform entities.
            </div>
          )}

          {Object.entries(results).map(([catKey, items]) => {
            if (!items || items.length === 0) return null;
            const Icon = categoryIcons[catKey] || Search;
            const categoryLabel = categoryNames[catKey] || catKey;

            return (
              <div key={catKey} className="py-2 first:pt-0 last:pb-0">
                <div className="px-3 py-1 text-[11px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{categoryLabel}</span>
                  <span className="text-[10px] px-1.5 rounded-full bg-surfaceAlt">
                    {items.length}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {items.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.link)}
                      className="w-full text-start px-3 py-2 rounded-lg hover:bg-surfaceAlt flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-textPrimary truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-textSecondary truncate">{item.subtitle}</p>
                      </div>
                      {item.badge && (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Keyboard Footer */}
        <div className="px-4 py-2 border-t border-border bg-surfaceAlt/40 flex items-center justify-between text-[11px] text-textSecondary">
          <span>Navigate with click or arrow keys</span>
          <span>Press ESC to exit</span>
        </div>
      </div>
    </div>
  );
}
