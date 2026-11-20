import React, { useState } from 'react';
import { KeyRound, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useApiClient } from '../lib/api';

interface StepUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function StepUpModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Security Verification Required',
  description = 'Re-enter your password to authorize this sensitive action.',
}: StepUpModalProps) {
  const client = useApiClient();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await client.adminVerifyStepUp({ password });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Incorrect password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 text-textPrimary animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-full bg-primary/10 text-primary">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-xs text-textSecondary">{description}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handlePasswordVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1.5">
              Account Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your account password"
                className="w-full pl-3.5 pr-10 py-2.5 bg-surfaceAlt border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-textPrimary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-textSecondary hover:text-textPrimary transition-colors focus:outline-none rounded cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-textSecondary hover:bg-surfaceAlt rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="px-5 py-2 text-sm font-medium bg-primary text-primaryText hover:bg-primaryHover rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Verify & Proceed</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
