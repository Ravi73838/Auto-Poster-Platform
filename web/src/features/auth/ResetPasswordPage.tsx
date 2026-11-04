import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '@ap/shared-validation';
import { useApiClient } from '../../shared/lib/api';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { Input } from '../../shared/components/Input';
import { Lock, AlertCircle } from 'lucide-react';
import { ApiError } from '@ap/api-client';

export function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const client = useApiClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: searchParams.get('email') || '',
      code: '',
      newPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsLoading(true);
    setServerError(null);
    try {
      await client.resetPassword(data);
      navigate('/login', {
        state: { message: 'Password reset successfully. Please sign in with your new password.' },
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setServerError('Password reset failed. Please check the code.');
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
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-textPrimary">Reset Password</h2>
          <p className="text-sm text-textSecondary mt-1">
            Enter the reset OTP and choose a new secure password
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
            label="Account Email"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Reset Code (OTP)"
            type="text"
            placeholder="123456"
            className="text-center tracking-widest font-mono"
            error={errors.code?.message}
            {...register('code')}
          />

          <Input
            label="New Password"
            type="password"
            placeholder="Min. 10 chars, letters and digits"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Set New Password
          </Button>

          <div className="text-center pt-2">
            <Link to="/login" className="text-xs text-primary hover:underline">
              Cancel and return to sign in
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

