import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAdminSchema, type CreateAdminInput } from '@ap/shared-validation';
import { ROLES, ACCOUNT_STATUS, type Role, type AccountStatus } from '@ap/shared-constants';
import type { AdminUserDto } from '@ap/shared-types';
import { useApiClient } from '../../../../shared/lib/api';
import { useAuthStore } from '../../../../shared/store/authStore';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { Input } from '../../../../shared/components/Input';
import { Modal } from '../../../../shared/components/Modal';
import { SessionsSection } from '../../../../features/auth/SessionsSection';
import {
  UserPlus,
  Shield,
  Copy,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Key,
  Save,
} from 'lucide-react';
import { ApiError } from '@ap/api-client';
import { StepUpModal } from '../../../../shared/components/StepUpModal';

export function TeamRolesPage() {
  const client = useApiClient();
  const currentAdmin = useAuthStore((s) => s.user);

  const [admins, setAdmins] = useState<AdminUserDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Temporary password modal state
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    tempPass: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Phase 10 Tab & Permissions Matrix state
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'MATRIX'>('MEMBERS');
  const [matrixData, setMatrixData] = useState<{
    roles: string[];
    permissions: { id: string; key: string; description: string | null }[];
    matrix: Record<string, string[]>;
  } | null>(null);
  const [editedMatrix, setEditedMatrix] = useState<Record<string, Set<string>>>({});
  const [isMatrixStepUpOpen, setIsMatrixStepUpOpen] = useState(false);
  const [targetSaveRole, setTargetSaveRole] = useState<Role | null>(null);
  const [savingMatrix, setSavingMatrix] = useState(false);

  const loadMatrix = useCallback(async () => {
    try {
      const res = await client.adminGetRolesMatrix();
      setMatrixData(res);
      const sets: Record<string, Set<string>> = {};
      Object.entries(res.matrix || {}).forEach(([role, perms]: [string, any]) => {
        sets[role] = new Set(perms);
      });
      setEditedMatrix(sets);
    } catch (err) {
      console.error('Failed to load roles matrix:', err);
    }
  }, [client]);

  useEffect(() => {
    if (activeTab === 'MATRIX') {
      loadMatrix();
    }
  }, [activeTab, loadMatrix]);

  const togglePermission = (role: string, permKey: string) => {
    if (role === ROLES.SUPER_ADMIN) return;
    setEditedMatrix((prev) => {
      const next = { ...prev };
      const current = new Set(next[role] || []);
      if (current.has(permKey)) {
        current.delete(permKey);
      } else {
        current.add(permKey);
      }
      next[role] = current;
      return next;
    });
  };

  const handleSaveRolePermissions = (role: Role) => {
    setTargetSaveRole(role);
    setIsMatrixStepUpOpen(true);
  };

  const handleMatrixStepUpSuccess = async () => {
    if (!targetSaveRole) return;
    try {
      setSavingMatrix(true);
      const perms = Array.from(editedMatrix[targetSaveRole] || []);
      await client.adminUpdateRolePermissions({
        role: targetSaveRole,
        permissionKeys: perms,
      });
      alert(`Permissions for ${targetSaveRole} successfully saved!`);
      await loadMatrix();
    } catch (err: any) {
      alert(err?.message || 'Failed to update permissions');
    } finally {
      setSavingMatrix(false);
      setTargetSaveRole(null);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAdminInput>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      email: '',
      mobile: '',
      role: ROLES.MODERATOR,
    },
  });

  const loadAdmins = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await client.listAdmins();
      setAdmins(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to fetch admin team members.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const onInviteSubmit = async (data: CreateAdminInput) => {
    setIsCreating(true);
    setError(null);
    try {
      const res = await client.createAdmin(data);
      setIsInviteOpen(false);
      reset();
      setCreatedCredentials({
        email: res.admin.email,
        tempPass: res.temporaryPassword,
      });
      await loadAdmins();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to invite admin staff member.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (adminId: string, newRole: Role) => {
    try {
      const updated = await client.updateAdminRole(adminId, {
        role: newRole as typeof ROLES.SUPER_ADMIN | typeof ROLES.MODERATOR | typeof ROLES.FINANCE,
      });
      setAdmins((prev) => prev.map((a) => (a.id === adminId ? updated : a)));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  const handleStatusChange = async (adminId: string, newStatus: AccountStatus) => {
    try {
      const updated = await client.updateAdminStatus(adminId, {
        status: newStatus as typeof ACCOUNT_STATUS.APPROVED | typeof ACCOUNT_STATUS.SUSPENDED | typeof ACCOUNT_STATUS.BLOCKED,
      });
      setAdmins((prev) => prev.map((a) => (a.id === adminId ? updated : a)));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  const copyToClipboard = async () => {
    if (!createdCredentials) return;
    try {
      await navigator.clipboard.writeText(createdCredentials.tempPass);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Team Roles & Permissions"
          description="Manage platform administrators, role assignments, and security privileges."
        />
        <Button
          variant="primary"
          onClick={() => setIsInviteOpen(true)}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Admin User</span>
        </Button>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('MEMBERS')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'MEMBERS'
              ? 'border-primary text-primary'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Staff Members
        </button>
        <button
          onClick={() => setActiveTab('MATRIX')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'MATRIX'
              ? 'border-primary text-primary'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Role Permissions Matrix
        </button>
      </div>

      {error ? (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 text-danger text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {activeTab === 'MEMBERS' && (
        <Card className="overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-base text-textPrimary flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span>Staff Members ({admins.length})</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadAdmins}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surfaceAlt text-textSecondary text-xs font-semibold uppercase tracking-wider border-b border-border">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Password Status</th>
                <th className="px-6 py-3.5">Last Login</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {admins.map((adm) => {
                const isSelf = adm.id === currentAdmin?.id;
                return (
                  <tr key={adm.id} className="hover:bg-surfaceAlt/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-textPrimary flex items-center gap-2">
                        <span>{adm.email}</span>
                        {isSelf ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary font-bold">
                            You
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-textSecondary">{adm.mobile}</div>
                    </td>

                    <td className="px-6 py-4">
                      {isSelf ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surfaceAlt text-textPrimary">
                          {adm.role}
                        </span>
                      ) : (
                        <select
                          value={adm.role}
                          onChange={(e) => handleRoleChange(adm.id, e.target.value as Role)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface border border-border text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value={ROLES.SUPER_ADMIN}>SUPER_ADMIN</option>
                          <option value={ROLES.MODERATOR}>MODERATOR</option>
                          <option value={ROLES.FINANCE}>FINANCE</option>
                        </select>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {isSelf ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-success/20 text-success">
                          {adm.status}
                        </span>
                      ) : (
                        <select
                          value={adm.status}
                          onChange={(e) => handleStatusChange(adm.id, e.target.value as AccountStatus)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface border border-border text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value={ACCOUNT_STATUS.APPROVED}>APPROVED</option>
                          <option value={ACCOUNT_STATUS.SUSPENDED}>SUSPENDED</option>
                          <option value={ACCOUNT_STATUS.BLOCKED}>BLOCKED</option>
                        </select>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs">
                      {adm.mustChangePassword ? (
                        <span className="text-warning font-semibold">Change Required</span>
                      ) : (
                        <span className="text-textSecondary">Active</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-textSecondary">
                      {adm.lastLoginAt ? new Date(adm.lastLoginAt).toLocaleString() : 'Never'}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {/* Action buttons */}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* Permissions Matrix Tab */}
      {activeTab === 'MATRIX' && (
        <Card className="overflow-hidden p-0 space-y-4">
          <div className="p-4 border-b border-border bg-surfaceAlt/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-textPrimary flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <span>Administrative Privilege Matrix</span>
              </h3>
              <p className="text-xs text-textSecondary mt-0.5">
                SUPER_ADMIN privileges are immutable by design. Moderator and Finance roles can be configured and require step-up verification to apply.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveRolePermissions(ROLES.MODERATOR)}
                disabled={savingMatrix}
                className="gap-1.5 text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Moderator</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveRolePermissions(ROLES.FINANCE)}
                disabled={savingMatrix}
                className="gap-1.5 text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Finance</span>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surfaceAlt text-textSecondary border-b border-border uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">Permission Key</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3 text-center">Super Admin</th>
                  <th className="px-5 py-3 text-center">Moderator</th>
                  <th className="px-5 py-3 text-center">Finance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-textPrimary">
                {matrixData?.permissions.map((p) => (
                  <tr key={p.id} className="hover:bg-surfaceAlt/40 transition-colors">
                    <td className="px-5 py-3 font-mono font-semibold text-primary">{p.key}</td>
                    <td className="px-5 py-3 text-textSecondary">{p.description || '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled={true}
                        className="rounded border-border text-primary cursor-not-allowed opacity-60"
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={editedMatrix[ROLES.MODERATOR]?.has(p.key) || false}
                        onChange={() => togglePermission(ROLES.MODERATOR, p.key)}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={editedMatrix[ROLES.FINANCE]?.has(p.key) || false}
                        onChange={() => togglePermission(ROLES.FINANCE, p.key)}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Active Login Sessions Section */}
      <SessionsSection />

      <StepUpModal
        isOpen={isMatrixStepUpOpen}
        onClose={() => {
          setIsMatrixStepUpOpen(false);
          setTargetSaveRole(null);
        }}
        onSuccess={handleMatrixStepUpSuccess}
        title="Admin Verification Required"
        description="Modifying role permissions alters platform security privileges and requires step-up authentication."
      />

      {/* Invite Admin Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Administrative Staff"
      >
        <form onSubmit={handleSubmit(onInviteSubmit)} className="space-y-4">
          <Input
            label="Staff Email Address"
            type="email"
            placeholder="colleague@autoposter.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Indian Mobile Number (for 2FA)"
            type="tel"
            placeholder="9876543210"
            error={errors.mobile?.message}
            {...register('mobile')}
          />

          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1.5">
              Assigned Role
            </label>
            <select
              className="w-full px-3.5 py-2 text-sm bg-surface border border-border rounded-lg text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary"
              {...register('role')}
            >
              <option value={ROLES.MODERATOR}>MODERATOR (KYC & photo review, disputes)</option>
              <option value={ROLES.FINANCE}>FINANCE (Escrow & payouts approval)</option>
              <option value={ROLES.SUPER_ADMIN}>SUPER_ADMIN (Full control & settings)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isCreating}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Temporary Password Credential Dialog */}
      <Modal
        isOpen={Boolean(createdCredentials)}
        onClose={() => setCreatedCredentials(null)}
        title="Admin Account Created"
      >
        <div className="space-y-4">
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-2.5 text-warning text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Save this temporary password!</p>
              <p className="mt-0.5 text-warning/90">
                This password will <strong>not</strong> be shown again. Share it securely with the user.
                They will be required to change it on their initial sign in.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1">
              Account Email
            </label>
            <p className="text-sm font-mono text-textPrimary">{createdCredentials?.email}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1">
              Temporary Password
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={createdCredentials?.tempPass || ''}
                className="w-full px-3.5 py-2 text-sm font-mono bg-surfaceAlt border border-border rounded-lg text-textPrimary select-all"
              />
              <Button
                type="button"
                variant="outline"
                onClick={copyToClipboard}
                className="shrink-0 gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="primary"
              onClick={() => setCreatedCredentials(null)}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
