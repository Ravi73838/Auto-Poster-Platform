import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordInput } from '@ap/shared-validation';
import { useAuthStore } from '../../shared/store/authStore';
import { useApiClient } from '../../shared/lib/api';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { Input } from '../../shared/components/Input';
import { KeyRound, AlertCircle, AlertTriangle } from 'lucide-react';
import { ApiError } from '@ap/api-client';
import { ROLES } from '@ap/shared-constants';

export function ChangePasswordPage() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const { user, setUser } = useAuthStore();
  const client = useApiClient();
  const navigate = useNavigate();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  });

  const onSubmit = async (data: ChangePasswordInput) => {
    setIsLoading(true);
    setServerError(null);
    setSuccessMessage(null);
    try {
      await client.changePassword(data);
      if (user) {
        setUser({ ...user, mustChangePassword: false });
      }
      setSuccessMessage('Password changed successfully.');
      reset();

      // If user had mustChangePassword, navigate to their respective portal
      setTimeout(() => {
        if (user?.role === ROLES.COMPANY) {
          navigate('/company/dashboard', { replace: true });
        } else {
          navigate('/admin/dashboard', { replace: true });
        }
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setServerError('Failed to change password. Please verify current password.');
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
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-textPrimary">Change Password</h2>
          <p className="text-sm text-textSecondary mt-1">
            Choose a strong new password for your account
          </p>
        </div>

        {user?.mustChangePassword ? (
          <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-2 text-warning text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              You must set a new password before accessing the platform features.
            </span>
          </div>
        ) : null}

        {serverError ? (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm">
            {successMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            placeholder="••••••••••"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />

          <Input
            label="New Password"
            type="password"
            placeholder="Min. 10 chars, letters and digits"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
}

