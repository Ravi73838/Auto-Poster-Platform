import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'Navigation' | 'Actions' | 'Review Queue' | 'General';
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['Ctrl', 'K'], description: 'Open Command Palette / Omnisearch', category: 'General' },
  { keys: ['?'], description: 'Open Keyboard Shortcuts dialog', category: 'General' },
  { keys: ['Esc'], description: 'Close modal, drawer or palette', category: 'General' },
  { keys: ['/'], description: 'Focus search input on active table', category: 'Actions' },
  { keys: ['e'], description: 'Export current table to CSV', category: 'Actions' },
  { keys: ['j'], description: 'Move focus down to next row', category: 'Actions' },
  { keys: ['k'], description: 'Move focus up to previous row', category: 'Actions' },
  { keys: ['x'], description: 'Toggle selection of focused row', category: 'Actions' },
  { keys: ['a'], description: 'Approve current review item', category: 'Review Queue' },
  { keys: ['r'], description: 'Reject current review item', category: 'Review Queue' },
  { keys: ['f'], description: 'Flag item for manual verification', category: 'Review Queue' },
  { keys: ['g', 'w'], description: 'Go to My Work', category: 'Navigation' },
  { keys: ['g', 'd'], description: 'Go to Drivers', category: 'Navigation' },
  { keys: ['g', 'c'], description: 'Go to Campaigns', category: 'Navigation' },
  { keys: ['g', 'p'], description: 'Go to Photo Review', category: 'Navigation' },
  { keys: ['g', 'f'], description: 'Go to Payments / Finance', category: 'Navigation' },
  { keys: ['g', 's'], description: 'Go to Settings', category: 'Navigation' },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = ['General', 'Actions', 'Review Queue', 'Navigation'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-2xl w-full p-6 text-textPrimary animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto py-4 space-y-6 flex-1 pr-1">
          {categories.map((cat) => {
            const items = SHORTCUTS.filter((s) => s.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary mb-3">
                  {cat}
                </h3>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-surfaceAlt transition-colors text-sm"
                    >
                      <span className="text-textPrimary">{item.description}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="px-2 py-0.5 text-xs font-mono font-semibold bg-surfaceAlt border border-border rounded shadow-sm text-textSecondary"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-textSecondary">
          <span>Press <kbd className="px-1.5 py-0.5 bg-surfaceAlt border border-border rounded font-mono">?</kbd> anywhere to toggle this cheat sheet</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surfaceAlt text-textPrimary hover:bg-border font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

