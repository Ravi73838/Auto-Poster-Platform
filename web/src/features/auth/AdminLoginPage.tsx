import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  adminLoginSchema,
  type AdminLoginInput,
} from '@ap/shared-validation';
import { useAuthStore } from '../../shared/store/authStore';
import { useApiClient } from '../../shared/lib/api';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { Input } from '../../shared/components/Input';
import { Shield, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';
import { ApiError } from '@ap/api-client';

const adminOtpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'Verification code must be at least 4 digits')
    .max(10, 'Verification code too long'),
});
type AdminOtpCodeInput = z.infer<typeof adminOtpCodeSchema>;

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

  // Step 2 Form (validates OTP code directly)
  const {
    register: registerStep2,
    handleSubmit: handleSubmitStep2,
    setValue: setValueStep2,
    formState: { errors: errorsStep2 },
  } = useForm<AdminOtpCodeInput>({
    resolver: zodResolver(adminOtpCodeSchema),
    defaultValues: { code: '' },
  });

  const onStep1Submit = async (data: AdminLoginInput) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const res = await client.adminLoginStep1(data);
      if ('accessToken' in res && (res as any).accessToken) {
        const loginRes = res as any;
        setAuth({
          user: loginRes.user,
          token: loginRes.accessToken,
          permissions: loginRes.user.role === 'SUPER_ADMIN' ? ['*'] : [],
        });

        if (loginRes.mustChangePassword) {
          navigate('/change-password', { replace: true });
          return;
        }

        const origin = (location.state as { from?: { pathname: string } })?.from?.pathname;
        if (origin && origin.startsWith('/admin')) {
          navigate(origin, { replace: true });
        } else {
          navigate('/admin/dashboard', { replace: true });
        }
        return;
      }
      setChallengeId(res.challengeId);
      setMaskedMobile(res.maskedMobile);
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

  const onStep2Submit = async (data: AdminOtpCodeInput) => {
    if (!challengeId) {
      setServerError('Session expired. Please restart login.');
      setStep(1);
      return;
    }
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
        permissions: response.user.role === 'SUPER_ADMIN' ? ['*'] : [],
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

  return (
    <div className="w-full max-w-md">
      <Card className="shadow-lg">
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="Auto Poster"
            className="w-16 h-16 rounded-2xl object-cover shadow-md mx-auto mb-3"
          />
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
            {/* Quick Auto-Fill Admin Credentials */}
            <div className="p-3 bg-surfaceAlt/60 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-textSecondary flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-primary" /> Demo Admin Credentials
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                  Click to Fill
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setValueStep1('email', 'admin@autoposter.com', { shouldValidate: true });
                  setValueStep1('password', 'Admin@123456', { shouldValidate: true });
                }}
                className="w-full text-left p-2.5 rounded-lg bg-surface hover:bg-surfaceAlt transition-colors border border-border/80 flex items-center justify-between text-xs cursor-pointer group"
              >
                <div>
                  <span className="font-semibold text-textPrimary group-hover:text-primary transition-colors block">
                    Super Admin
                  </span>
                  <span className="text-[11px] font-mono text-textSecondary">
                    admin@autoposter.com • Admin@123456
                  </span>
                </div>
                <span className="text-xs font-medium text-primary group-hover:underline">
                  Auto Fill &rarr;
                </span>
              </button>
            </div>

            <Input
              label="Staff Email Address"
              type="email"
              placeholder="admin@example.com"
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
              Sign In
            </Button>

            <div className="pt-2 text-center border-t border-border mt-3">
              <Link to="/login" className="text-xs text-textSecondary hover:text-textPrimary">
                &larr; Return to Company Portal
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitStep2(onStep2Submit)} className="space-y-4">
            {/* Quick Auto-Fill OTP Code */}
            <button
              type="button"
              onClick={() => {
                setValueStep2('code', '123456', { shouldValidate: true });
              }}
              className="w-full py-2 px-3 rounded-lg bg-surfaceAlt/60 hover:bg-surfaceAlt border border-border text-xs font-medium text-primary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" /> Auto-fill Dev OTP (123456)
            </button>

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
