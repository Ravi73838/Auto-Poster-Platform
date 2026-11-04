import React, { useState } from 'react';
import { ShieldCheck, Mail, Phone, Loader2, AlertCircle } from 'lucide-react';
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
  description = 'This sensitive action requires step-up authentication. A verification code will be sent to your registered contact.',
}: StepUpModalProps) {
  const client = useApiClient();
  const [channel, setChannel] = useState<'SMS' | 'EMAIL'>('SMS');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'CHALLENGE' | 'VERIFY'>('CHALLENGE');
  const [maskedDestination, setMaskedDestination] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestOtp = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await client.adminRequestStepUp(channel);
      setMaskedDestination(res.maskedDestination);
      setStep('VERIFY');
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length < 4) {
      setError('Please enter a valid verification code');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await client.adminVerifyStepUp(code.trim());
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 text-textPrimary animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="w-6 h-6" />
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

        {step === 'CHALLENGE' ? (
          <div className="space-y-4">
            <p className="text-sm text-textSecondary">
              Select verification delivery channel:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChannel('SMS')}
                className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  channel === 'SMS'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-textSecondary hover:bg-surfaceAlt'
                }`}
              >
                <Phone className="w-4 h-4" />
                <span>Mobile SMS</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('EMAIL')}
                className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  channel === 'EMAIL'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-textSecondary hover:bg-surfaceAlt'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Email Code</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm text-textSecondary hover:bg-surfaceAlt rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={loading}
                className="px-5 py-2 text-sm font-medium bg-primary text-primaryText hover:bg-primaryHover rounded-lg flex items-center gap-2 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Send Code</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-textSecondary">
              Enter the 6-digit code sent to{' '}
              <strong className="text-textPrimary">{maskedDestination}</strong>:
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full text-center tracking-widest text-2xl font-mono px-4 py-3 bg-surfaceAlt border border-border rounded-lg focus:outline-none focus:border-primary"
            />

            <div className="flex items-center justify-between text-xs text-textSecondary">
              <span>Didn't receive code?</span>
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={loading}
                className="text-primary hover:underline font-medium"
              >
                Resend Code
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep('CHALLENGE')}
                disabled={loading}
                className="px-4 py-2 text-sm text-textSecondary hover:bg-surfaceAlt rounded-lg transition-colors"
              >
                Change Method
              </button>
              <button
                type="submit"
                disabled={loading || code.length < 4}
                className="px-5 py-2 text-sm font-medium bg-primary text-primaryText hover:bg-primaryHover rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Verify & Proceed</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
