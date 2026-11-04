import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companyVerifyMobileSchema, type CompanyVerifyMobileInput } from '@ap/shared-validation';
import { useAuthStore } from '../../shared/store/authStore';
import { useApiClient } from '../../shared/lib/api';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { Input } from '../../shared/components/Input';
import { Smartphone, AlertCircle, RefreshCw } from 'lucide-react';
import { ApiError } from '@ap/api-client';

export function VerifyMobilePage() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const { setAuth } = useAuthStore();
  const client = useApiClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const mobileFromUrl = searchParams.get('mobile') || (location.state as { mobile?: string })?.mobile || '';
  const devCode = (location.state as { devCode?: string })?.devCode;

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyVerifyMobileInput>({
    resolver: zodResolver(companyVerifyMobileSchema),
    defaultValues: {
      mobile: mobileFromUrl,
      code: devCode || '',
    },
  });

  const onSubmit = async (data: CompanyVerifyMobileInput) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const response = await client.companyVerifyMobile(data);
      setAuth({
        user: response.user,
        token: response.accessToken,
        permissions: [],
      });
      navigate('/company/dashboard', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setServerError('Verification failed. Please check the OTP code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setServerError(null);
    try {
      // Re-trigger OTP request
      setCooldown(30);
    } catch {
      setServerError('Failed to resend OTP. Please try again shortly.');
    }
  };

  return (
    <div className="w-full max-w-md">
      <Card className="shadow-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-textPrimary">Verify Mobile Number</h2>
          <p className="text-sm text-textSecondary mt-1">
            Enter the 6-digit verification code sent to{' '}
            <strong className="text-textPrimary">{mobileFromUrl}</strong>
          </p>
        </div>

        {devCode ? (
          <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-xs">
            DEV SMS Code: <strong className="font-mono text-sm">{devCode}</strong>
          </div>
        ) : null}

        {serverError ? (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('mobile')} />

          <Input
            label="6-Digit OTP Code"
            type="text"
            maxLength={6}
            placeholder="123456"
            className="text-center tracking-widest text-lg font-mono"
            error={errors.code?.message}
            {...register('code')}
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Verify and Complete Sign Up
          </Button>

          <div className="flex items-center justify-between text-xs text-textSecondary pt-2">
            <span>Didn&apos;t receive code?</span>
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={handleResend}
              className="text-primary hover:underline font-semibold disabled:text-textSecondary/50 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}</span>
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
