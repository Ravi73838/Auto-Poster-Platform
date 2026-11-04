import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  adminLoginSchema,
  adminVerifyOtpSchema,
  type AdminLoginInput,
  type AdminVerifyOtpInput,
} from '@ap/shared-validation';
import { useAuthStore } from '../../shared/store/authStore';
import { useApiClient } from '../../shared/lib/api';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { Input } from '../../shared/components/Input';
import { Shield, AlertCircle, ArrowLeft } from 'lucide-react';
import { ApiError } from '@ap/api-client';

export function AdminLoginPage() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const { setAuth } = useAuthStore();
  const client = useApiClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<1 | 2>(1);
  const [challengeId, setChallengeId] = useState<string>('');
  const [maskedMobile, setMaskedMobile] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 Form
  const {
    register: registerStep1,
    handleSubmit: handleSubmitStep1,
    setValue: setValueStep1,
    formState: { errors: errorsStep1 },
  } = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Step 2 Form
  const {
    register: registerStep2,
    handleSubmit: handleSubmitStep2,
    formState: { errors: errorsStep2 },
  } = useForm<AdminVerifyOtpInput>({
    resolver: zodResolver(adminVerifyOtpSchema),
    defaultValues: { challengeId: '', code: '' },
  });

  const onStep1Submit = async (data: AdminLoginInput) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const challenge = await client.adminLoginStep1(data);
      setChallengeId(challenge.challengeId);
      setMaskedMobile(challenge.maskedMobile);
      setStep(2);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setServerError('Admin login failed. Please check credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onStep2Submit = async (data: AdminVerifyOtpInput) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const response = await client.adminLoginStep2({
        challengeId,
        code: data.code,
      });

      // Fetch full profile permissions
      setAuth({
        user: response.user,
        token: response.accessToken,
        permissions: [],
      });

      if (response.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }

      const origin = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (origin && origin.startsWith('/admin')) {
        navigate(origin, { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setServerError('Two-factor verification failed. Please check the code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (email: string, pass: string) => {
    setValueStep1('email', email, { shouldValidate: true });
    setValueStep1('password', pass, { shouldValidate: true });
  };

  return (
    <div className="w-full max-w-md">
      <Card className="shadow-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-warning" />
          </div>
          <h2 className="text-2xl font-bold text-textPrimary">
            {step === 1 ? 'Admin Portal Login' : 'Two-Step Verification'}
          </h2>
          <p className="text-sm text-textSecondary mt-1">
            {step === 1
              ? 'Authorized platform personnel only'
              : `Enter the 6-digit OTP code sent to your registered mobile (${maskedMobile})`}
          </p>
        </div>

        {serverError ? (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        {step === 1 ? (
          <form onSubmit={handleSubmitStep1(onStep1Submit)} className="space-y-4">
            <Input
              label="Staff Email Address"
              type="email"
              placeholder="admin@autoposter.com"
              error={errorsStep1.email?.message}
              {...registerStep1('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••"
              error={errorsStep1.password?.message}
              {...registerStep1('password')}
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
              Next: Send 2FA Code
            </Button>

            {/* Quick-Fill Helpers for Development */}
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs font-medium text-textSecondary mb-2">Dev Helper: Seeded Admin</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleQuickFill('admin@autoposter.com', 'Admin@123456')}
                >
                  Super Admin (Seeded)
                </Button>
              </div>
            </div>

            <div className="pt-2 text-center border-t border-border mt-3">
              <Link to="/login" className="text-xs text-textSecondary hover:text-textPrimary">
                &larr; Return to Company Portal
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitStep2(onStep2Submit)} className="space-y-4">
            <input type="hidden" value={challengeId} {...registerStep2('challengeId')} />

            <Input
              label="6-Digit 2FA Verification Code"
              type="text"
              maxLength={6}
              placeholder="123456"
              className="text-center tracking-widest text-lg font-mono"
              error={errorsStep2.code?.message}
              {...registerStep2('code')}
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
              Verify & Sign In
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setServerError(null);
              }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-textSecondary hover:text-textPrimary pt-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to password</span>
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
