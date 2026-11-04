import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companyLoginSchema, type CompanyLoginInput } from '@ap/shared-validation';
import { useAuthStore } from '../../shared/store/authStore';
import { useApiClient } from '../../shared/lib/api';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { Input } from '../../shared/components/Input';
import { Building2, Shield, AlertCircle } from 'lucide-react';
import { ApiError } from '@ap/api-client';

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const { setAuth } = useAuthStore();
  const client = useApiClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CompanyLoginInput>({
    resolver: zodResolver(companyLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: CompanyLoginInput) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const response = await client.companyLogin(data);
      setAuth({
        user: response.user,
        token: response.accessToken,
        permissions: [],
      });

      const origin = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (origin && origin.startsWith('/company')) {
        navigate(origin, { replace: true });
      } else {
        navigate('/company/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setServerError('Failed to sign in. Please check your credentials and network connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (email: string, pass: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', pass, { shouldValidate: true });
  };

  return (
    <div className="w-full max-w-md">
      <Card className="shadow-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-textPrimary">Company Sign In</h2>
          <p className="text-sm text-textSecondary mt-1">
            Access your billboard campaigns & analytics
          </p>
        </div>

        {serverError ? (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="company@autoposter.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-textSecondary">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Sign In
          </Button>

          <div className="text-center pt-2">
            <p className="text-xs text-textSecondary">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Register company
              </Link>
            </p>
          </div>

          {/* Seeded Quick-Fill (Development helper) */}
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs font-medium text-textSecondary mb-2">Dev Helper: Quick-Fill</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => handleQuickFill('company@autoposter.com', 'Company@123456')}
              >
                Seeded Company
              </Button>
            </div>
          </div>

          <div className="pt-2 text-center border-t border-border mt-3">
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 text-xs text-textSecondary hover:text-textPrimary"
            >
              <Shield className="w-3.5 h-3.5 text-warning" />
              <span>Admin & Staff Portal Login &rarr;</span>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
