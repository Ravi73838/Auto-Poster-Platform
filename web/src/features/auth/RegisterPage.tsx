import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companyRegisterSchema, type CompanyRegisterInput } from '@ap/shared-validation';
import { useApiClient } from '../../shared/lib/api';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { Input } from '../../shared/components/Input';
import { Building2, AlertCircle } from 'lucide-react';
import { ApiError } from '@ap/api-client';

export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const client = useApiClient();
  const navigate = useNavigate();

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyRegisterInput>({
    resolver: zodResolver(companyRegisterSchema),
    defaultValues: {
      email: '',
      mobile: '',
      password: '',
      language: 'en',
    },
  });

  const onSubmit = async (data: CompanyRegisterInput) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const res = await client.companyRegister(data);
      // Navigate to verify-mobile with mobile state
      navigate(`/verify-mobile?mobile=${encodeURIComponent(res.mobile || data.mobile)}`, {
        state: { mobile: res.mobile || data.mobile, devCode: res.devCode },
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setServerError('Registration failed. Please check your details and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <Card className="shadow-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-textPrimary">Register Company</h2>
          <p className="text-sm text-textSecondary mt-1">
            Create an account to launch auto-rickshaw poster campaigns
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
            label="Business Email"
            type="email"
            placeholder="contact@brand.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Mobile Number (India)"
            type="tel"
            placeholder="9876543210"
            error={errors.mobile?.message}
            {...register('mobile')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Min. 10 chars, letters and digits"
            error={errors.password?.message}
            {...register('password')}
          />

          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1.5">
              Preferred Language
            </label>
            <select
              className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              {...register('language')}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="gu">ગુજરાતી (Gujarati)</option>
            </select>
          </div>

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Continue to Verification
          </Button>

          <div className="text-center pt-2">
            <p className="text-xs text-textSecondary">
              Already registered?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}

