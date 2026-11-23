// cspell:words presign Paise
import {
  ERROR_CODES,
  DEFAULT_LANGUAGE,
  type ErrorCode,
  type Language,
} from '@ap/shared-constants';
import type {
  ApiResponse,
  HealthResponse,
  LoginResponse,
  AdminLoginChallengeResponse,
  AuthTokens,
  AuthMeResponse,
  SessionDto,
  AdminUserDto,
  CreateAdminResponse,
  CampaignDto,
  CampaignPricePreviewDto,
  CampaignReviewDto,
  CampaignDetailDto,
  DriverCampaignDto,
  CampaignRulesDto,
  DriverAvailabilityDto,
  AssignmentDto,
  AssignmentDetailDto,
  InstallationPhotoDto,
  InstallationReviewQueueItemDto,
  CompanyInstallationItemDto,
  DailyPhotoSubmissionDto,
  TodayStatusDto,
  AssignmentDaysSummaryDto,
  DailyPhotoQueueItemDto,
  DailyPhotoDetailDto,
  DriverDailyPhotoItemDto,
  CompanyCampaignProgressDto,
  CompanyDailyPhotoDto,
  FraudOverviewDto,
  CampaignPaymentDto,
  PaymentOrderResultDto,
  RefundDto,
  AssignmentSettlementDto,
  TaxDocumentDto,
  AdjustmentDto,
  PayoutDto,
  DriverWalletDto,
  WalletStatementEntryDto,
  FinanceDashboardDto,
  LedgerAccountDto,
  LedgerTransactionDto,
  TrialBalanceDto,
  StrikeDto,
  DriverBanDto,
  DriverDisciplineDto,
  DisputeDto,
  DisputeDetailDto,
  DisputeMessageDto,
  DisputeEvidenceDto,
  DisputeDecisionPreviewDto,
  NotificationDto,
  NotificationPreferenceDto,
  UserNotificationSettingsDto,
  DeviceTokenDto,
  AnnouncementDto,
  NotificationStatsDto,
  DriverHomeResponseDto,
  DriverCaptureRulesDto,
  PublicAppConfigDto,
  DriverOnboardingDto,
  UpdateDriverProfileInput,
  UpdateDriverVehicleInput,
  AddDriverDocumentInput,
  UpdateDriverPayoutDetailsInput,
  SubmitDriverConsentsInput,
  GeneratedReportDto,
  PublicReportVerifyDto,
  LocalAdvertiserDto,
  LocalAdDto,
  ServedLocalAdDto,
  AdPlacementHealthDto,
  AdRevenueEntryDto,
  InviteCodeDto,
  CreateInviteCodeInput,
  BatchCreateInviteCodesInput,
  WaitlistEntryDto,
  WaitlistSubmitInput,
  AnomalyFindingDto,
  ReviewSecondLookDto,
  FeedbackDto,
  CreateFeedbackInput,
  SupportRequestDto,
  CreateSupportRequestInput,
  PrintShopDto,
  CreatePrintShopInput,
  UpdatePrintShopInput,
  PilotCountersDto,
  PilotCommandCenterDto,
  LaunchReadinessResponse,
  LaunchReadiness,
  LaunchSignOffAttestationInput,
  ClockStateDto,
  ClockState,
  AdvanceClockInput,
  PilotReportNoteDto,
  SavePilotReportNoteInput,
  PilotCommandCenter,
  AdminUserResetPasswordResponse,
} from '@ap/shared-types';
import type {
  DriverOtpRequestInput,
  DriverOtpVerifyInput,
  DriverPasswordRegisterInput,
  DriverPasswordLoginInput,
  AdminUserResetPasswordInput,
  StepUpVerifyInput,
  CompanyRegisterInput,
  CompanyVerifyMobileInput,
  CompanyLoginInput,
  AdminLoginInput,
  AdminVerifyOtpInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdatePreferencesInput,
  CreateAdminInput,
  UpdateAdminRoleInput,
  UpdateAdminStatusInput,
  CreateCampaignDraftInput,
  UpdateCampaignDraftInput,
  CampaignPricePreviewInput,
  AdminCampaignDecisionInput,
  ListCompanyCampaignsQuery,
  ListAdminCampaignsQuery,
  ListDriverCampaignsQuery,
  DriverAvailabilityQuery,
  CampaignSelectInput,
  WithdrawAssignmentInput,
  SubmitInstallationPhotoInput,
  ReviewInstallationInput,
  ListAssignmentsQuery,
  SubmitDailyPhotoInput,
  ReviewDailyPhotoInput,
  ExcuseDayInput,
  FlagPhotoInput,
  ListDailyPhotoQueueQuery,
  CreatePaymentOrderInput,
  VerifyPaymentSignatureInput,
  RefundRequestInput,
  RefundReviewInput,
  SettlementApprovalInput,
  DriverWithdrawalInput,
  AdjustmentRequestInput,
  AdjustmentReviewInput,
  FinancePauseInput,
  IssueStrikeInput,
  RevokeStrikeInput,
  LiftBanInput,
  TerminateAssignmentInput,
  ReinstateAssignmentInput,
  CreateDriverDisputeInput,
  CreateCompanyDisputeInput,
  AddDisputeMessageInput,
  AddDisputeEvidenceInput,
  SetEvidenceVisibilityInput,
  DisputeDecisionInput,
  DisputeRequestInfoInput,
  DisputeReopenRequestInput,
  UpdateNotificationPreferencesInput,
  UpdateNotificationSettingsInput,
  RegisterDeviceTokenInput,
  CreateAnnouncementInput,
  ListNotificationsQuery,
} from '@ap/shared-validation';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  setAuthToken?: (token: string | null) => void | Promise<void>;
  getRefreshToken?: () => string | null | Promise<string | null>;
  getLanguage?: () => Language;
  onAuthLost?: () => void;
  credentials?: 'omit' | 'same-origin' | 'include';
}

interface InternalRequestOptions extends RequestInit {
  _isRetry?: boolean;
}

export class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => string | null | Promise<string | null>;
  private setAuthToken?: (token: string | null) => void | Promise<void>;
  private getRefreshToken?: () => string | null | Promise<string | null>;
  private getLanguage: () => Language;
  private onAuthLost?: () => void;
  private credentials?: 'omit' | 'same-origin' | 'include';

  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.getAuthToken = config.getAuthToken;
    this.setAuthToken = config.setAuthToken;
    this.getRefreshToken = config.getRefreshToken;
    this.getLanguage = config.getLanguage ?? (() => DEFAULT_LANGUAGE);
    this.onAuthLost = config.onAuthLost;
    this.credentials = config.credentials ?? 'include';
  }

  async request<T>(path: string, options: InternalRequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    const headers = new Headers(options.headers);

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    const language = this.getLanguage();
    if (language && !headers.has('Accept-Language')) {
      headers.set('Accept-Language', language);
    }

    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'no-cache');
    }

    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        credentials: this.credentials,
        ...options,
        headers,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network request failed';
      throw new ApiError(ERROR_CODES.INTERNAL_ERROR, msg, 0);
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!isJson) {
      if (!response.ok) {
        throw new ApiError(
          ERROR_CODES.INTERNAL_ERROR,
          `HTTP Error ${response.status}`,
          response.status,
        );
      }
      return (await response.text()) as unknown as T;
    }

    let data: ApiResponse<T>;
    try {
      data = (await response.json()) as ApiResponse<T>;
    } catch (err: unknown) {
      throw new ApiError(
        ERROR_CODES.INTERNAL_ERROR,
        'Invalid JSON response from server',
        response.status,
        err,
      );
    }

    if (!data.success) {
      // Check if access token expired and we can attempt single-flight refresh
      if (
        data.error.code === ERROR_CODES.TOKEN_EXPIRED &&
        !options._isRetry &&
        !path.includes('auth/refresh') &&
        !path.includes('auth/driver/otp') &&
        !path.includes('auth/company/login') &&
        !path.includes('auth/admin/login')
      ) {
        try {
          await this.executeRefreshToken();
          // Retry the original request
          return await this.request<T>(path, { ...options, _isRetry: true });
        } catch {
          // If refresh failed, fall through to throwing the original or new error
          throw new ApiError(
            data.error.code,
            data.error.message,
            response.status,
            data.error.details,
          );
        }
      }

      throw new ApiError(
        data.error.code,
        data.error.message,
        response.status,
        data.error.details,
      );
    }

    return data.data;
  }

  private async executeRefreshToken(): Promise<AuthTokens> {
    const refreshToken = this.getRefreshToken ? await this.getRefreshToken() : undefined;
    return this.refreshTokens(refreshToken ? { refreshToken } : undefined);
  }

  // -------------------------------------------------------------
  // Health
  // -------------------------------------------------------------
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('health', { method: 'GET' });
  }

  // -------------------------------------------------------------
  // Auth: Driver
  // -------------------------------------------------------------
  async driverOtpRequest(
    data: DriverOtpRequestInput,
  ): Promise<{ message: string; cooldownSeconds: number; devCode?: string }> {
    return this.request('auth/driver/otp/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async driverOtpVerify(data: DriverOtpVerifyInput): Promise<LoginResponse> {
    return this.request('auth/driver/otp/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async driverPasswordRegister(data: DriverPasswordRegisterInput): Promise<LoginResponse> {
    return this.request('auth/driver/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async driverPasswordLogin(data: DriverPasswordLoginInput): Promise<LoginResponse> {
    return this.request('auth/driver/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // -------------------------------------------------------------
  // Auth: Company
  // -------------------------------------------------------------
  async companyRegister(
    data: CompanyRegisterInput,
  ): Promise<{ message: string; mobile: string; cooldownSeconds: number; devCode?: string }> {
    return this.request('auth/company/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async companyVerifyMobile(data: CompanyVerifyMobileInput): Promise<LoginResponse> {
    return this.request('auth/company/verify-mobile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async companyLogin(data: CompanyLoginInput): Promise<LoginResponse> {
    return this.request('auth/company/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // -------------------------------------------------------------
  // Auth: Admin
  // -------------------------------------------------------------
  async adminLoginStep1(data: AdminLoginInput): Promise<AdminLoginChallengeResponse> {
    return this.request('auth/admin/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminLoginStep2(data: AdminVerifyOtpInput): Promise<LoginResponse> {
    return this.request('auth/admin/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // -------------------------------------------------------------
  // Auth: Refresh, Password & Session
  // -------------------------------------------------------------
  async refreshTokens(data?: RefreshTokenInput): Promise<AuthTokens> {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          const tokens = await this.request<AuthTokens>('auth/refresh', {
            method: 'POST',
            body: JSON.stringify(data ?? {}),
          });
          if (this.setAuthToken) {
            await this.setAuthToken(tokens.accessToken);
          }
          return tokens;
        } catch (err) {
          if (this.setAuthToken) {
            await this.setAuthToken(null);
          }
          this.onAuthLost?.();
          throw err;
        } finally {
          this.refreshPromise = null;
        }
      })();
    }
    return this.refreshPromise;
  }

  async forgotPassword(data: ForgotPasswordInput): Promise<{ message: string }> {
    return this.request('auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resetPassword(data: ResetPasswordInput): Promise<{ message: string }> {
    return this.request('auth/password/reset', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: ChangePasswordInput): Promise<{ message: string }> {
    return this.request('auth/password/change', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<{ message: string }> {
    return this.request('auth/logout', {
      method: 'POST',
    });
  }

  async logoutAll(): Promise<{ message: string }> {
    return this.request('auth/logout-all', {
      method: 'POST',
    });
  }

  async getMe(): Promise<AuthMeResponse> {
    return this.request('auth/me', {
      method: 'GET',
    });
  }

  async updatePreferences(data: UpdatePreferencesInput): Promise<AuthMeResponse> {
    return this.request('auth/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async listSessions(): Promise<SessionDto[]> {
    return this.request('auth/sessions', {
      method: 'GET',
    });
  }

  async revokeSession(id: string): Promise<{ message: string }> {
    return this.request(`auth/sessions/${id}`, {
      method: 'DELETE',
    });
  }

  // -------------------------------------------------------------
  // Admin: Team Management
  // -------------------------------------------------------------
  async createAdmin(data: CreateAdminInput): Promise<CreateAdminResponse> {
    return this.request('admin/team', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listAdmins(): Promise<AdminUserDto[]> {
    return this.request('admin/team', {
      method: 'GET',
    });
  }

  async updateAdminRole(id: string, data: UpdateAdminRoleInput): Promise<AdminUserDto> {
    return this.request(`admin/team/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateAdminStatus(id: string, data: UpdateAdminStatusInput): Promise<AdminUserDto> {
    return this.request(`admin/team/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // -------------------------------------------------------------
  // Company Campaigns
  // -------------------------------------------------------------
  async getCampaignRules(): Promise<CampaignRulesDto> {
    return this.request('company/campaigns/rules', { method: 'GET' });
  }

  async getDriverAvailability(query: DriverAvailabilityQuery): Promise<DriverAvailabilityDto> {
    const params = new URLSearchParams({ cityId: query.cityId });
    if (query.vehicleType) params.append('vehicleType', query.vehicleType);
    if (query.zoneIds) {
      const zoneIdList = Array.isArray(query.zoneIds) ? query.zoneIds : [query.zoneIds];
      zoneIdList.forEach((z) => params.append('zoneIds', z));
    }
    return this.request(`company/campaigns/availability?${params.toString()}`, { method: 'GET' });
  }

  async previewCampaignPrice(data: CampaignPricePreviewInput): Promise<CampaignPricePreviewDto> {
    return this.request('company/campaigns/price-preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createCampaignDraft(data: CreateCampaignDraftInput): Promise<CampaignDto> {
    return this.request('company/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCampaignDraft(id: string, data: UpdateCampaignDraftInput): Promise<CampaignDto> {
    return this.request(`company/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCampaignDraft(id: string): Promise<{ success: boolean }> {
    return this.request(`company/campaigns/${id}`, { method: 'DELETE' });
  }

  async cloneCampaign(id: string): Promise<CampaignDto> {
    return this.request(`company/campaigns/${id}/clone`, { method: 'POST' });
  }

  async listCompanyCampaigns(query?: ListCompanyCampaignsQuery): Promise<{
    items: CampaignDto[];
    counts: Record<string, number>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (query?.status) params.append('status', query.status);
    if (query?.search) params.append('search', query.search);
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const qs = params.toString();
    return this.request(`company/campaigns${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async getCompanyCampaignDetail(id: string): Promise<CampaignDetailDto> {
    return this.request(`company/campaigns/${id}`, { method: 'GET' });
  }

  async submitCampaign(id: string): Promise<CampaignDto> {
    return this.request(`company/campaigns/${id}/submit`, { method: 'POST' });
  }

  async cancelCampaign(id: string, reason?: string): Promise<CampaignDto> {
    return this.request(`company/campaigns/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async reopenCampaign(id: string): Promise<CampaignDto> {
    return this.request(`company/campaigns/${id}/reopen`, { method: 'POST' });
  }

  async getCampaignPaymentSummary(id: string): Promise<Record<string, unknown>> {
    return this.request(`company/campaigns/${id}/payment-summary`, { method: 'GET' });
  }

  // -------------------------------------------------------------
  // Admin Campaigns & Review
  // -------------------------------------------------------------
  async listAdminCampaigns(query?: ListAdminCampaignsQuery): Promise<{
    items: (CampaignDto & { companyName: string; assignedToName: string | null })[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (query?.status) params.append('status', query.status);
    if (query?.search) params.append('search', query.search);
    if (query?.cityId) params.append('cityId', query.cityId);
    if (query?.companyId) params.append('companyId', query.companyId);
    if (query?.startDateFrom) params.append('startDateFrom', query.startDateFrom);
    if (query?.startDateTo) params.append('startDateTo', query.startDateTo);
    if (query?.assignedToMe) params.append('assignedToMe', 'true');
    if (query?.unassigned) params.append('unassigned', 'true');
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const qs = params.toString();
    return this.request(`admin/campaigns${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async getCampaignReviewQueue(): Promise<CampaignReviewDto[]> {
    return this.request('admin/campaigns/review/queue', { method: 'GET' });
  }

  async claimNextCampaign(): Promise<CampaignDto | null> {
    return this.request('admin/campaigns/review/claim-next', { method: 'POST' });
  }

  async claimCampaign(id: string): Promise<CampaignDto> {
    return this.request(`admin/campaigns/${id}/claim`, { method: 'POST' });
  }

  async releaseCampaign(id: string): Promise<CampaignDto> {
    return this.request(`admin/campaigns/${id}/release`, { method: 'POST' });
  }

  async getAdminCampaignDetail(id: string): Promise<CampaignDetailDto> {
    return this.request(`admin/campaigns/${id}`, { method: 'GET' });
  }

  async decideCampaign(id: string, data: AdminCampaignDecisionInput): Promise<CampaignDto> {
    return this.request(`admin/campaigns/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelAdminCampaign(id: string, reason?: string): Promise<CampaignDto> {
    return this.request(`admin/campaigns/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // -------------------------------------------------------------
  // Driver Campaigns Discovery
  // -------------------------------------------------------------
  async listDriverCampaigns(query?: ListDriverCampaignsQuery): Promise<{
    items: DriverCampaignDto[];
    isBanned?: boolean;
  }> {
    const params = new URLSearchParams();
    if (query?.zoneId) params.append('zoneId', query.zoneId);
    if (query?.minRent) params.append('minRent', String(query.minRent));
    if (query?.minDuration) params.append('minDuration', String(query.minDuration));
    if (query?.startDateFrom) params.append('startDateFrom', query.startDateFrom);
    if (query?.startDateTo) params.append('startDateTo', query.startDateTo);
    if (query?.sort) params.append('sort', query.sort);
    if (query?.limit) params.append('limit', String(query.limit));
    if (query?.cursor) params.append('cursor', query.cursor);
    const qs = params.toString();
    const res = await this.request<any>(`driver/campaigns${qs ? `?${qs}` : ''}`, { method: 'GET' });
    if (Array.isArray(res)) {
      return { items: res, isBanned: false };
    }
    if (res && Array.isArray(res.items)) {
      return { items: res.items, isBanned: Boolean(res.isBanned) };
    }
    return { items: [], isBanned: false };
  }

  async getDriverCampaignDetail(id: string): Promise<DriverCampaignDto> {
    return this.request(`driver/campaigns/${id}`, { method: 'GET' });
  }

  // -------------------------------------------------------------
  // Dev Payment Simulation (Dev only)
  // -------------------------------------------------------------
  async simulateCampaignPayment(id: string): Promise<{ campaign: CampaignDto; simulated: boolean }> {
    return this.request(`dev/campaigns/${id}/simulate-payment`, { method: 'POST' });
  }

  // -------------------------------------------------------------
  // Locations
  // -------------------------------------------------------------
  async listCities(): Promise<{ id: string; name: string; state: string }[]> {
    return this.request('locations/cities', { method: 'GET' });
  }

  async listZones(cityId: string): Promise<{ id: string; name: string; cityId: string }[]> {
    return this.request(`locations/cities/${cityId}/zones`, { method: 'GET' });
  }

  // -------------------------------------------------------------
  // Uploads
  // -------------------------------------------------------------
  async presignUpload(data: {
    fileType?: string;
    purpose?: string;
    mimeType: string;
    fileSize?: number;
    sizeBytes?: number;
    fileName?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    fileId: string;
    uploadUrl: string;
    fileKey: string;
    objectKey?: string;
    headers?: Record<string, string>;
  }> {
    const payload = {
      purpose: data.purpose ?? data.fileType,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes ?? data.fileSize,
      fileName: data.fileName,
      metadata: data.metadata,
    };
    return this.request('uploads/presign', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async confirmUpload(fileIdOrKey: { fileId?: string; fileKey?: string } | string): Promise<{
    fileId: string;
    status: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }> {
    const payload = typeof fileIdOrKey === 'string'
      ? { fileId: fileIdOrKey }
      : fileIdOrKey;
    return this.request('uploads/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getFileUrl(fileId: string, variant: 'original' | 'preview' | 'thumbnail' = 'original'): Promise<{
    url: string;
    expiresIn: number;
    variant: string;
  }> {
    return this.request(`uploads/${fileId}/url?variant=${variant}`, { method: 'GET' });
  }

  async uploadFile(
    file: File | Blob,
    options: {
      fileType?: string;
      purpose?: string;
      fileName: string;
      mimeType: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ fileId: string; status: string; originalName: string }> {
    const presign = await this.presignUpload({
      purpose: options.purpose ?? options.fileType,
      fileName: options.fileName,
      mimeType: options.mimeType,
      sizeBytes: file.size,
      metadata: options.metadata,
    });

    const headers: Record<string, string> = {
      'Content-Type': options.mimeType,
      ...(presign.headers ?? {}),
    };

    const uploadRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers,
      body: file,
    });

    if (!uploadRes.ok) {
      throw new ApiError(
        ERROR_CODES.INTERNAL_ERROR,
        `File upload to storage failed with status ${uploadRes.status}`,
        uploadRes.status,
      );
    }

    const confirmed: any = await this.confirmUpload({ fileId: presign.fileId, fileKey: presign.fileKey });
    const resolvedId = confirmed?.id ?? confirmed?.fileId ?? presign.fileId;
    return {
      ...confirmed,
      id: resolvedId,
      fileId: resolvedId,
    };
  }

  // ---------------------------------------------------------------------------
  // Assignments & Installations (Phase 6)
  // ---------------------------------------------------------------------------

  // Driver Assignment Endpoints
  async selectCampaign(campaignId: string, input?: CampaignSelectInput): Promise<AssignmentDto> {
    const headers: Record<string, string> = {};
    if (input?.idempotencyKey) {
      headers['Idempotency-Key'] = input.idempotencyKey;
    }
    return this.request(`driver/campaigns/${campaignId}/select`, {
      method: 'POST',
      headers,
    });
  }

  async listDriverAssignments(query?: ListAssignmentsQuery): Promise<{ items: AssignmentDto[] }> {
    const params = new URLSearchParams();
    if (query?.status) params.append('status', query.status);
    const qs = params.toString();
    const res = await this.request<any>(`driver/assignments${qs ? `?${qs}` : ''}`, { method: 'GET' });
    if (Array.isArray(res)) {
      return { items: res };
    }
    if (res && Array.isArray(res.items)) {
      return { items: res.items };
    }
    return { items: [] };
  }

  async getDriverAssignment(assignmentId: string): Promise<AssignmentDetailDto> {
    return this.request(`driver/assignments/${assignmentId}`, { method: 'GET' });
  }

  async startInstalling(assignmentId: string): Promise<AssignmentDto> {
    return this.request(`driver/assignments/${assignmentId}/start-installing`, { method: 'POST' });
  }

  async withdrawAssignment(assignmentId: string, input?: WithdrawAssignmentInput): Promise<AssignmentDto> {
    return this.request(`driver/assignments/${assignmentId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    });
  }

  async getPosterDownloadUrl(assignmentId: string): Promise<{ downloadUrl: string; expiresIn: number }> {
    return this.request(`driver/assignments/${assignmentId}/poster-download`, { method: 'GET' });
  }

  async getPrintGuide(assignmentId: string): Promise<{
    assignmentId: string;
    campaignTitle: string;
    material: string;
    size: string;
    printingAllowancePaise: number;
    checklist: string[];
    tips: string[];
  }> {
    return this.request(`driver/assignments/${assignmentId}/print-guide`, { method: 'GET' });
  }

  async submitInstallationPhoto(
    assignmentId: string,
    input: SubmitInstallationPhotoInput,
  ): Promise<{ assignment: AssignmentDto; photo: InstallationPhotoDto }> {
    return this.request(`driver/assignments/${assignmentId}/installation`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Company Installation Endpoints
  async listCompanyInstallations(campaignId?: string): Promise<{ items: CompanyInstallationItemDto[] }> {
    const qs = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
    return this.request(`company/installations${qs}`, { method: 'GET' });
  }

  async getCompanyInstallation(assignmentId: string): Promise<CompanyInstallationItemDto> {
    return this.request(`company/installations/${assignmentId}`, { method: 'GET' });
  }

  async reviewCompanyInstallation(
    assignmentId: string,
    input: ReviewInstallationInput,
  ): Promise<AssignmentDto> {
    return this.request(`company/installations/${assignmentId}/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Admin Installation Endpoints
  async getAdminInstallationQueue(): Promise<{ items: InstallationReviewQueueItemDto[] }> {
    return this.request('admin/installations/queue', { method: 'GET' });
  }

  async claimAdminInstallation(assignmentId: string): Promise<AssignmentDto> {
    return this.request(`admin/installations/${assignmentId}/claim`, { method: 'POST' });
  }

  async releaseAdminInstallation(assignmentId: string): Promise<AssignmentDto> {
    return this.request(`admin/installations/${assignmentId}/release`, { method: 'POST' });
  }

  async reviewAdminInstallation(
    assignmentId: string,
    input: ReviewInstallationInput,
  ): Promise<AssignmentDto> {
    return this.request(`admin/installations/${assignmentId}/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // ---------------------------------------------------------------------------
  // Daily Proof & Fraud Checks (Phase 7)
  // ---------------------------------------------------------------------------

  // Driver Daily Photo Endpoints
  async submitDailyPhoto(
    assignmentId: string,
    input: SubmitDailyPhotoInput,
  ): Promise<DailyPhotoSubmissionDto> {
    return this.request(`driver/assignments/${assignmentId}/daily-photos`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getTodayStatus(assignmentId: string): Promise<TodayStatusDto> {
    return this.request(`driver/assignments/${assignmentId}/today`, { method: 'GET' });
  }

  async getAssignmentDaysSummary(assignmentId: string): Promise<AssignmentDaysSummaryDto> {
    return this.request(`driver/assignments/${assignmentId}/days`, { method: 'GET' });
  }

  async listDriverDailyPhotos(
    assignmentId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: DriverDailyPhotoItemDto[]; total: number }> {
    return this.request(
      `driver/assignments/${assignmentId}/daily-photos?page=${page}&limit=${limit}`,
      { method: 'GET' },
    );
  }

  // Admin Daily Photo & Fraud Endpoints
  async getDailyPhotoQueue(
    query?: ListDailyPhotoQueueQuery,
  ): Promise<{ items: DailyPhotoQueueItemDto[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    if (query?.source) params.append('source', query.source);
    if (query?.campaignId) params.append('campaignId', query.campaignId);
    if (query?.cityId) params.append('cityId', query.cityId);
    if (query?.unassigned !== undefined) params.append('unassigned', String(query.unassigned));
    if (query?.assignedToMe !== undefined) params.append('assignedToMe', String(query.assignedToMe));
    if (query?.minRiskScore !== undefined) params.append('minRiskScore', String(query.minRiskScore));
    if (query?.limit) params.append('limit', String(query.limit));
    if (query?.cursor) params.append('cursor', query.cursor);
    const qs = params.toString();
    return this.request(`admin/daily-photos/queue${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async claimNextDailyPhoto(): Promise<DailyPhotoDetailDto | null> {
    return this.request('admin/daily-photos/claim-next', { method: 'POST' });
  }

  async claimDailyPhoto(photoId: string): Promise<void> {
    return this.request(`admin/daily-photos/${photoId}/claim`, { method: 'POST' });
  }

  async releaseDailyPhoto(photoId: string): Promise<void> {
    return this.request(`admin/daily-photos/${photoId}/release`, { method: 'POST' });
  }

  async getDailyPhotoDetail(photoId: string): Promise<DailyPhotoDetailDto> {
    return this.request(`admin/daily-photos/${photoId}`, { method: 'GET' });
  }

  async reviewDailyPhoto(
    photoId: string,
    input: ReviewDailyPhotoInput,
  ): Promise<{ status: string; dayStatus: string }> {
    return this.request(`admin/daily-photos/${photoId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async excuseAssignmentDay(
    assignmentId: string,
    date: string,
    input: ExcuseDayInput,
  ): Promise<void> {
    return this.request(`admin/assignments/${assignmentId}/days/${date}/excuse`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getFraudOverview(): Promise<FraudOverviewDto> {
    return this.request('admin/fraud/overview', { method: 'GET' });
  }

  async getDriverTrust(driverId: string): Promise<Record<string, unknown>> {
    return this.request(`admin/drivers/${driverId}/trust`, { method: 'GET' });
  }

  // Company Daily Proof & Progress Endpoints
  async getCampaignProgress(campaignId: string): Promise<CompanyCampaignProgressDto> {
    return this.request(`company/campaigns/${campaignId}/progress`, { method: 'GET' });
  }

  async listCompanyDailyPhotos(
    campaignId: string,
    page: number = 1,
    limit: number = 20,
    date?: string,
  ): Promise<{ items: CompanyDailyPhotoDto[]; total: number }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (date) params.append('date', date);
    return this.request(`company/campaigns/${campaignId}/photos?${params.toString()}`, {
      method: 'GET',
    });
  }

  async getCompanyMapPoints(
    campaignId: string,
    date?: string,
  ): Promise<
    Array<{
      id: string;
      approxLat: number;
      approxLng: number;
      driverCode: string;
      thumbnailUrl: string;
      capturedAt: string;
      status: string;
    }>
  > {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`company/campaigns/${campaignId}/map${qs}`, { method: 'GET' });
  }

  async flagCompanyPhoto(
    campaignId: string,
    photoId: string,
    input: FlagPhotoInput,
  ): Promise<{ flagId: string; status: string }> {
    return this.request(`company/campaigns/${campaignId}/photos/${photoId}/flag`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async downloadCampaignReportCsv(campaignId: string): Promise<string> {
    const token = this.getAuthToken ? await this.getAuthToken() : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${this.baseUrl}company/campaigns/${campaignId}/report.csv`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to download CSV: ${res.statusText}`);
    }
    return res.text();
  }

  // ---------------------------------------------------------
  // Phase 8: Company Payments & Tax Invoices
  // ---------------------------------------------------------

  async createPaymentOrder(
    campaignId: string,
    input?: CreatePaymentOrderInput,
  ): Promise<PaymentOrderResultDto> {
    return this.request(`company/campaigns/${campaignId}/payment/order`, {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    });
  }

  async verifyPayment(
    campaignId: string,
    input: VerifyPaymentSignatureInput,
  ): Promise<{ payment: CampaignPaymentDto; taxDocument: TaxDocumentDto }> {
    return this.request(`company/campaigns/${campaignId}/payment/verify`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listCompanyPayments(): Promise<{ items: CampaignPaymentDto[] }> {
    return this.request('company/payments', { method: 'GET' });
  }

  async listAdminPayouts(): Promise<{ items: PayoutDto[] }> {
    const list = await this.listFinancePayouts();
    return { items: list };
  }

  async exportPayoutsCsv(): Promise<{ batch: { batchNumber: string; totalCount: number; totalAmountPaise: string }; csv: string }> {
    const csv = await this.exportFinancePayoutsCsv();
    return {
      batch: {
        batchNumber: `BATCH_${Date.now()}`,
        totalCount: Math.max(0, csv.split('\n').filter(Boolean).length - 1),
        totalAmountPaise: '0',
      },
      csv,
    };
  }

  async importPayoutsCsv(input: { csvContent: string }): Promise<{ processed: number; succeeded: number; failed: number }> {
    return this.importFinancePayoutsCsv(input.csvContent);
  }

  async listCampaignPayments(campaignId: string): Promise<CampaignPaymentDto[]> {
    return this.request(`company/campaigns/${campaignId}/payments`, { method: 'GET' });
  }

  async listCampaignInvoices(campaignId: string): Promise<TaxDocumentDto[]> {
    return this.request(`company/campaigns/${campaignId}/invoices`, { method: 'GET' });
  }

  // ---------------------------------------------------------
  // Phase 8: Driver Wallet & Payouts
  // ---------------------------------------------------------

  async getDriverWallet(): Promise<DriverWalletDto> {
    return this.request('driver/wallet', { method: 'GET' });
  }

  async getDriverWalletBalance(): Promise<DriverWalletDto> {
    return this.getDriverWallet();
  }

  async downloadTaxDocumentPdf(taxDocId: string): Promise<Blob> {
    const token = this.getAuthToken ? await this.getAuthToken() : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const cleanBase = this.baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/company/tax-documents/${taxDocId}/pdf`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to download invoice PDF: ${res.statusText}`);
    }
    return res.blob();
  }

  async getDriverWalletStatement(
    page = 1,
    pageSize = 20,
  ): Promise<{ data: WalletStatementEntryDto[]; meta: unknown }> {
    return this.request(`driver/wallet/statement?page=${page}&pageSize=${pageSize}`, {
      method: 'GET',
    });
  }

  async requestDriverWithdrawal(input: DriverWithdrawalInput): Promise<PayoutDto> {
    return this.request('driver/withdrawals', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listDriverPayouts(): Promise<PayoutDto[]> {
    return this.request('driver/payouts', { method: 'GET' });
  }

  async getDriverAssignmentSettlement(assignmentId: string): Promise<AssignmentSettlementDto> {
    return this.request(`driver/assignments/${assignmentId}/settlement`, { method: 'GET' });
  }

  // ---------------------------------------------------------
  // Phase 8: Admin Finance Portal
  // ---------------------------------------------------------

  async getFinanceDashboard(): Promise<FinanceDashboardDto> {
    return this.request('admin/finance/dashboard', { method: 'GET' });
  }

  async toggleFinancePause(
    input: FinancePauseInput,
  ): Promise<{ paymentsEnabled: boolean; payoutsEnabled: boolean }> {
    return this.request('admin/finance/pause', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listFinancePayments(query?: {
    campaignId?: string;
    status?: string;
    page?: number;
  }): Promise<{ data: CampaignPaymentDto[]; meta: unknown }> {
    const params = new URLSearchParams();
    if (query?.campaignId) params.append('campaignId', query.campaignId);
    if (query?.status) params.append('status', query.status);
    if (query?.page) params.append('page', query.page.toString());
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`admin/finance/payments${qs}`, { method: 'GET' });
  }

  async listFinanceRefunds(
    page = 1,
    pageSize = 20,
  ): Promise<{ data: RefundDto[]; meta: unknown }> {
    return this.request(`admin/finance/refunds?page=${page}&pageSize=${pageSize}`, {
      method: 'GET',
    });
  }

  async requestFinanceRefund(input: RefundRequestInput): Promise<RefundDto> {
    return this.request('admin/finance/refunds', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async reviewFinanceRefund(refundId: string, input: RefundReviewInput): Promise<RefundDto> {
    return this.request(`admin/finance/refunds/${refundId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listFinanceSettlements(): Promise<AssignmentSettlementDto[]> {
    return this.request('admin/finance/settlements', { method: 'GET' });
  }

  async reviewFinanceSettlement(
    settlementId: string,
    input: SettlementApprovalInput,
  ): Promise<AssignmentSettlementDto> {
    return this.request(`admin/finance/settlements/${settlementId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async closeoutCampaign(
    campaignId: string,
  ): Promise<{ campaign: unknown; sweptAmountPaise: string }> {
    return this.request(`admin/finance/campaigns/${campaignId}/closeout`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async listFinancePayouts(): Promise<PayoutDto[]> {
    return this.request('admin/finance/payouts', { method: 'GET' });
  }

  async exportFinancePayoutsCsv(): Promise<string> {
    const token = this.getAuthToken ? await this.getAuthToken() : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${this.baseUrl}admin/finance/payouts/export-csv`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to export CSV: ${res.statusText}`);
    }
    return res.text();
  }

  async importFinancePayoutsCsv(
    csv: string,
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    return this.request('admin/finance/payouts/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    });
  }

  async listLedgerAccounts(): Promise<LedgerAccountDto[]> {
    return this.request('admin/finance/ledger/accounts', { method: 'GET' });
  }

  async listLedgerTransactions(
    page = 1,
    pageSize = 20,
  ): Promise<{ data: LedgerTransactionDto[]; meta: unknown }> {
    return this.request(`admin/finance/ledger/transactions?page=${page}&pageSize=${pageSize}`, {
      method: 'GET',
    });
  }

  async getTrialBalance(): Promise<TrialBalanceDto> {
    return this.request('admin/finance/ledger/trial-balance', { method: 'GET' });
  }

  async listFinanceAdjustments(): Promise<AdjustmentDto[]> {
    return this.request('admin/finance/adjustments', { method: 'GET' });
  }

  async requestFinanceAdjustment(input: AdjustmentRequestInput): Promise<AdjustmentDto> {
    return this.request('admin/finance/adjustments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async reviewFinanceAdjustment(
    adjustmentId: string,
    input: AdjustmentReviewInput,
  ): Promise<AdjustmentDto> {
    return this.request(`admin/finance/adjustments/${adjustmentId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // --- Phase 9: Discipline ---

  async adminListStrikes(
    page = 1,
    limit = 20,
    driverId?: string,
    status?: string,
  ): Promise<{ data: StrikeDto[]; meta: { pagination: unknown } }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (driverId) params.append('driverId', driverId);
    if (status) params.append('status', status);
    return this.request(`admin/strikes?${params.toString()}`, { method: 'GET' });
  }

  async adminIssueStrike(input: IssueStrikeInput): Promise<StrikeDto> {
    return this.request('admin/strikes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminRevokeStrike(strikeId: string, input: RevokeStrikeInput): Promise<StrikeDto> {
    return this.request(`admin/strikes/${strikeId}/revoke`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminListBans(
    page = 1,
    limit = 20,
    driverId?: string,
  ): Promise<{ data: DriverBanDto[]; meta: { pagination: unknown } }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (driverId) params.append('driverId', driverId);
    return this.request(`admin/bans?${params.toString()}`, { method: 'GET' });
  }

  async adminLiftBan(banId: string, input: LiftBanInput): Promise<DriverBanDto> {
    return this.request(`admin/bans/${banId}/lift`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminGetDriverDiscipline(driverId: string): Promise<DriverDisciplineDto> {
    return this.request(`admin/drivers/${driverId}/discipline`, { method: 'GET' });
  }

  async adminTerminateAssignment(
    assignmentId: string,
    input: TerminateAssignmentInput,
  ): Promise<AssignmentDto> {
    return this.request(`admin/assignments/${assignmentId}/terminate`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminReinstateAssignment(
    assignmentId: string,
    input: ReinstateAssignmentInput,
  ): Promise<AssignmentDto> {
    return this.request(`admin/assignments/${assignmentId}/reinstate`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async driverGetDisciplineMe(): Promise<DriverDisciplineDto> {
    return this.request('driver/discipline', { method: 'GET' });
  }

  async driverGetDisciplineRules(): Promise<{
    strikeLimit: number;
    strikeValidityDays: number;
    banDurationDays: number;
    graceDays: number;
    posterFixHours: number;
    appealPeriodDays: number;
    rules: Array<{ code: string; title: string; description: string }>;
  }> {
    return this.request('driver/discipline/rules', { method: 'GET' });
  }

  // --- Phase 9: Disputes ---

  async driverCreateDispute(input: CreateDriverDisputeInput): Promise<DisputeDto> {
    return this.request('driver/disputes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async companyCreateDispute(input: CreateCompanyDisputeInput): Promise<DisputeDto> {
    return this.request('company/disputes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listDisputes(
    role: 'admin' | 'driver' | 'company' = 'admin',
    page = 1,
    limit = 20,
    status?: string,
    queue?: string,
  ): Promise<{ data: DisputeDto[]; meta: { pagination: unknown } }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.append('status', status);
    if (queue) params.append('queue', queue);

    const prefix = role === 'admin' ? 'admin/disputes' : `${role}/disputes`;
    return this.request(`${prefix}?${params.toString()}`, { method: 'GET' });
  }

  async getDisputeDetail(
    disputeId: string,
    role: 'admin' | 'driver' | 'company' = 'admin',
  ): Promise<DisputeDetailDto> {
    const prefix = role === 'admin' ? 'admin/disputes' : `${role}/disputes`;
    return this.request(`${prefix}/${disputeId}`, { method: 'GET' });
  }

  async addDisputeMessage(
    disputeId: string,
    input: AddDisputeMessageInput,
    role: 'admin' | 'driver' | 'company' = 'admin',
  ): Promise<DisputeMessageDto> {
    const prefix = role === 'admin' ? 'admin/disputes' : `${role}/disputes`;
    return this.request(`${prefix}/${disputeId}/messages`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async addDisputeEvidence(
    disputeId: string,
    input: AddDisputeEvidenceInput,
    role: 'admin' | 'driver' | 'company' = 'admin',
  ): Promise<DisputeEvidenceDto> {
    const prefix = role === 'admin' ? 'admin/disputes' : `${role}/disputes`;
    return this.request(`${prefix}/${disputeId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async requestDisputeReopen(
    disputeId: string,
    input: DisputeReopenRequestInput,
    role: 'driver' | 'company' = 'driver',
  ): Promise<DisputeDto> {
    return this.request(`${role}/disputes/${disputeId}/reopen-request`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminClaimNextDispute(queue?: string): Promise<DisputeDto | null> {
    const params = queue ? `?queue=${encodeURIComponent(queue)}` : '';
    return this.request(`admin/disputes/claim-next${params}`, { method: 'POST' });
  }

  async adminClaimDispute(disputeId: string): Promise<DisputeDto> {
    return this.request(`admin/disputes/${disputeId}/claim`, { method: 'POST' });
  }

  async adminReleaseDispute(disputeId: string): Promise<DisputeDto> {
    return this.request(`admin/disputes/${disputeId}/release`, { method: 'POST' });
  }

  async adminRequestDisputeInfo(
    disputeId: string,
    input: DisputeRequestInfoInput,
  ): Promise<DisputeMessageDto> {
    return this.request(`admin/disputes/${disputeId}/request-info`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminSetEvidenceVisibility(
    disputeId: string,
    evidenceId: string,
    input: SetEvidenceVisibilityInput,
  ): Promise<DisputeEvidenceDto> {
    return this.request(`admin/disputes/${disputeId}/evidence/${evidenceId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async adminPreviewDisputeDecision(
    disputeId: string,
    input: DisputeDecisionInput,
  ): Promise<DisputeDecisionPreviewDto> {
    return this.request(`admin/disputes/${disputeId}/decision/preview`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminExecuteDisputeDecision(
    disputeId: string,
    input: DisputeDecisionInput,
  ): Promise<unknown> {
    return this.request(`admin/disputes/${disputeId}/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminAcceptDisputeReopen(disputeId: string): Promise<DisputeDto> {
    return this.request(`admin/disputes/${disputeId}/accept-reopen`, {
      method: 'POST',
    });
  }

  // --- Phase 9: Notifications & Preferences ---

  async listNotifications(
    query?: ListNotificationsQuery,
  ): Promise<{ data: NotificationDto[]; meta: { pagination: unknown } }> {
    const params = new URLSearchParams();
    if (query?.page) params.append('page', String(query.page));
    if (query?.pageSize) params.append('pageSize', String(query.pageSize));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`notifications${qs}`, { method: 'GET' });
  }

  async getUnreadNotificationsCount(): Promise<number> {
    return this.request('notifications/unread-count', { method: 'GET' });
  }

  async markNotificationRead(id: string): Promise<unknown> {
    return this.request(`notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead(): Promise<unknown> {
    return this.request('notifications/read-all', { method: 'POST' });
  }

  async getNotificationPreferences(): Promise<NotificationPreferenceDto[]> {
    return this.request('me/notification-preferences', { method: 'GET' });
  }

  async updateNotificationPreferences(
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferenceDto[]> {
    return this.request('me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async getNotificationSettings(): Promise<UserNotificationSettingsDto> {
    return this.request('me/notification-settings', { method: 'GET' });
  }

  async updateNotificationSettings(
    input: UpdateNotificationSettingsInput,
  ): Promise<UserNotificationSettingsDto> {
    return this.request('me/notification-settings', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async registerDeviceToken(input: RegisterDeviceTokenInput): Promise<DeviceTokenDto> {
    return this.request('devices', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async unregisterDeviceToken(token: string): Promise<unknown> {
    return this.request(`devices/${encodeURIComponent(token)}`, {
      method: 'DELETE',
    });
  }

  async getNotificationStats(): Promise<NotificationStatsDto> {
    return this.request('notifications/stats', { method: 'GET' });
  }

  // --- Phase 9: Announcements ---

  async adminCreateAnnouncement(input: CreateAnnouncementInput): Promise<AnnouncementDto> {
    return this.request('admin/announcements', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminListAnnouncements(
    page = 1,
    limit = 20,
  ): Promise<{ data: AnnouncementDto[]; meta: { pagination: unknown } }> {
    return this.request(`admin/announcements?page=${page}&limit=${limit}`, { method: 'GET' });
  }

  async adminGetAnnouncement(id: string): Promise<AnnouncementDto> {
    return this.request(`admin/announcements/${id}`, { method: 'GET' });
  }

  async adminDispatchAnnouncement(id: string): Promise<unknown> {
    return this.request(`admin/announcements/${id}/dispatch`, { method: 'POST' });
  }

  // =============================================================
  // Phase 10: Admin Portal Completion
  // =============================================================

  // Step-Up Authentication & PII Reveal
  async adminRequestStepUp(channel: 'SMS' | 'EMAIL' = 'SMS'): Promise<{ channel: string; maskedDestination: string; expiresAt: string }> {
    return this.request('admin/step-up/request', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
  }

  async adminVerifyStepUp(
    input: string | StepUpVerifyInput,
  ): Promise<{ stepUpVerified: boolean; verifiedAt: string; validUntil: string; ttlMinutes: number }> {
    const body = typeof input === 'string' ? { code: input } : input;
    return this.request('admin/step-up/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async adminResetUserPassword(
    userId: string,
    data?: AdminUserResetPasswordInput,
  ): Promise<AdminUserResetPasswordResponse> {
    return this.request(`admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    });
  }

  async adminGetStepUpStatus(): Promise<{ stepUpVerified: boolean; verifiedAt: string | null; validUntil: string | null; ttlMinutes: number }> {
    return this.request('admin/step-up/status', { method: 'GET' });
  }

  async adminRevealPii(input: { entityType: string; entityId: string; field: string }): Promise<{ entityType: string; entityId: string; field: string; value: string }> {
    return this.request('admin/reveal', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Work Queues & My Work
  async adminGetWorkQueuesSummary(): Promise<{ queues: any[]; totalPending: number }> {
    return this.request('admin/work-queues/summary', { method: 'GET' });
  }

  async adminGetMyWork(): Promise<any[]> {
    return this.request('admin/my-work', { method: 'GET' });
  }

  async adminAssignQueueItem(input: { queue: string; itemId: string; targetAdminId: string | null }): Promise<any> {
    return this.request('admin/queues/assign', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminGetTeamWorkload(): Promise<any[]> {
    return this.request('admin/team/workload', { method: 'GET' });
  }

  // Omnisearch
  async adminSearch(q: string): Promise<{ query: string; totalMatches: number; results: Record<string, any[]> }> {
    return this.request(`admin/search?q=${encodeURIComponent(q)}`, { method: 'GET' });
  }

  // Analytics & Rollups
  async adminGetAnalyticsOverview(params?: { from?: string; to?: string; cityId?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.cityId) q.set('cityId', params.cityId);
    return this.request(`admin/analytics/overview?${q.toString()}`, { method: 'GET' });
  }

  async adminTriggerRollup(date?: string): Promise<{ message: string }> {
    return this.request('admin/analytics/rollup', {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }

  // Reports Registry
  async adminRequestExport(input: { reportKey: string; filters?: Record<string, unknown> }): Promise<{ exportId: string; status: string }> {
    return this.request('admin/reports/export', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminListExports(): Promise<any[]> {
    return this.request('admin/reports/exports', { method: 'GET' });
  }

  // Entity 360 & Audit Logs
  async adminListDrivers(params?: Record<string, any>): Promise<{ drivers: any[]; total: number }> {
    const q = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      }
    }
    return this.request(`admin/drivers?${q.toString()}`, { method: 'GET' });
  }

  async adminListCompanies(params?: Record<string, any>): Promise<{ companies: any[]; total: number }> {
    const q = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      }
    }
    return this.request(`admin/companies?${q.toString()}`, { method: 'GET' });
  }

  async adminGetDriverOverview(id: string): Promise<any> {
    return this.request(`admin/drivers/${id}/overview`, { method: 'GET' });
  }

  async adminGetCompanyOverview(id: string): Promise<any> {
    return this.request(`admin/companies/${id}/overview`, { method: 'GET' });
  }

  async adminUpdateCompanyStatus(id: string, data: { status?: string; isVerified?: boolean }): Promise<any> {
    return this.request(`admin/companies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminVerifyCompany(id: string): Promise<any> {
    return this.request(`admin/companies/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
  }

  async adminUpdateDriverStatus(id: string, data: { status?: string }): Promise<any> {
    return this.request(`admin/drivers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminVerifyDriver(id: string): Promise<any> {
    return this.request(`admin/drivers/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
  }

  async adminListAuditLogs(params?: Record<string, any>): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const q = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      }
    }
    return this.request(`admin/audit-logs?${q.toString()}`, { method: 'GET' });
  }

  // Saved Views
  async adminListSavedViews(pageKey: string): Promise<any[]> {
    return this.request(`admin/saved-views?pageKey=${encodeURIComponent(pageKey)}`, { method: 'GET' });
  }

  async adminCreateSavedView(input: { pageKey: string; name: string; filters: Record<string, unknown>; isDefault?: boolean }): Promise<any> {
    return this.request('admin/saved-views', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminUpdateSavedView(id: string, input: { name?: string; filters?: Record<string, unknown>; isDefault?: boolean }): Promise<any> {
    return this.request(`admin/saved-views/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async adminDeleteSavedView(id: string): Promise<{ message: string }> {
    return this.request(`admin/saved-views/${id}`, { method: 'DELETE' });
  }

  // Settings & Maker-Checker
  async adminListGroupedSettings(): Promise<Record<string, any[]>> {
    return this.request('admin/settings', { method: 'GET' });
  }

  async adminRequestSettingChange(input: { key: string; value: unknown; reason: string }): Promise<any> {
    return this.request('admin/settings/request-change', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminListSettingChangeRequests(): Promise<any[]> {
    return this.request('admin/settings/change-requests', { method: 'GET' });
  }

  async adminReviewSettingChange(id: string, decision: 'APPROVE' | 'REJECT'): Promise<{ message: string }> {
    return this.request(`admin/settings/change-requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
  }

  // Roles Matrix
  async adminGetRolesMatrix(): Promise<any> {
    return this.request('admin/roles/matrix', { method: 'GET' });
  }

  async adminUpdateRolePermissions(input: { role: string; permissionKeys: string[] }): Promise<{ message: string }> {
    return this.request('admin/roles/matrix', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  // Content: Legal & Help
  async adminListLegalDocuments(type?: string): Promise<any[]> {
    const q = type ? `?type=${encodeURIComponent(type)}` : '';
    return this.request(`admin/legal${q}`, { method: 'GET' });
  }

  async adminCreateLegalDocument(input: { type: string; title: string; bodyMarkdown: string; language?: string }): Promise<any> {
    return this.request('admin/legal', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminPublishLegalDocument(id: string): Promise<{ message: string }> {
    return this.request(`admin/legal/${id}/publish`, { method: 'POST' });
  }

  async adminListHelpArticles(params?: { category?: string; language?: string; publishedOnly?: boolean }): Promise<any[]> {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.language) q.set('language', params.language);
    if (params?.publishedOnly) q.set('publishedOnly', 'true');
    return this.request(`admin/help?${q.toString()}`, { method: 'GET' });
  }

  async adminGetHelpArticle(id: string): Promise<any> {
    return this.request(`admin/help/${id}`, { method: 'GET' });
  }

  async adminCreateHelpArticle(input: { category: string; title: string; bodyMarkdown: string; sortOrder?: number; published?: boolean }): Promise<any> {
    return this.request('admin/help', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async adminUpdateHelpArticle(id: string, input: Record<string, unknown>): Promise<any> {
    return this.request(`admin/help/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async adminDeleteHelpArticle(id: string): Promise<{ message: string }> {
    return this.request(`admin/help/${id}`, { method: 'DELETE' });
  }

  // System Health & Background Jobs
  async adminGetSystemHealth(): Promise<any> {
    return this.request('admin/system/health', { method: 'GET' });
  }

  async adminListJobRuns(params?: { jobName?: string; status?: string; page?: number; limit?: number }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.jobName) q.set('jobName', params.jobName);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return this.request(`admin/system/jobs?${q.toString()}`, { method: 'GET' });
  }

  async adminRetryJob(id: string): Promise<any> {
    return this.request(`admin/system/jobs/${id}/retry`, { method: 'POST' });
  }

  // -------------------------------------------------------------
  // Phase 12: Driver Home, Onboarding, Capture Rules & App Config
  // -------------------------------------------------------------

  async getDriverHome(): Promise<DriverHomeResponseDto> {
    return this.request('driver/home', { method: 'GET' });
  }

  async getDriverCaptureRules(): Promise<DriverCaptureRulesDto> {
    return this.request('driver/capture-rules', { method: 'GET' });
  }

  async getPublicAppConfig(): Promise<PublicAppConfigDto> {
    return this.request('public/app-config', { method: 'GET' });
  }

  async getDriverOnboarding(): Promise<DriverOnboardingDto> {
    return this.request('driver/onboarding', { method: 'GET' });
  }

  async updateDriverProfile(input: UpdateDriverProfileInput): Promise<any> {
    return this.request('driver/profile', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async updateDriverVehicle(input: UpdateDriverVehicleInput): Promise<any> {
    const isOwner = input.isVehicleOwner ?? input.isOwner ?? true;
    return this.request('driver/vehicle', {
      method: 'PUT',
      body: JSON.stringify({
        ...input,
        isVehicleOwner: isOwner,
        isOwner,
      }),
    });
  }

  async addDriverDocument(input: AddDriverDocumentInput): Promise<any> {
    return this.request('driver/documents', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async deleteDriverDocument(id: string): Promise<any> {
    return this.request(`driver/documents/${id}`, { method: 'DELETE' });
  }

  async updateDriverPayoutDetails(input: UpdateDriverPayoutDetailsInput): Promise<any> {
    const isUpi = input.method === 'UPI' || input.type === 'UPI';
    const payload = isUpi
      ? {
          method: 'UPI',
          type: 'UPI',
          upiId: input.upiId,
          otpCode: input.otpCode,
        }
      : {
          method: 'BANK_ACCOUNT',
          type: 'BANK',
          bankAccountHolder: input.bankAccountHolder ?? input.accountHolderName,
          accountHolderName: input.bankAccountHolder ?? input.accountHolderName,
          bankAccountNumber: input.bankAccountNumber ?? input.accountNumber,
          accountNumber: input.bankAccountNumber ?? input.accountNumber,
          bankIfsc: input.bankIfsc ?? input.ifscCode,
          ifscCode: input.bankIfsc ?? input.ifscCode,
          otpCode: input.otpCode,
        };

    return this.request('driver/payout-details', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async submitDriverConsents(input: SubmitDriverConsentsInput): Promise<any> {
    return this.request('driver/consents', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async submitDriverKyc(): Promise<any> {
    return this.request('driver/kyc/submit', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getDriverKyc(): Promise<any> {
    return this.request('driver/kyc', { method: 'GET' });
  }

  async getLegalDocument(type: string): Promise<any> {
    return this.request(`legal/${type}`, { method: 'GET' });
  }

  async listHelpArticles(params?: { category?: string; query?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.query) q.set('query', params.query);
    const qs = q.toString();
    return this.request(`help${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async getHelpArticle(id: string): Promise<any> {
    return this.request(`help/${id}`, { method: 'GET' });
  }

  // ============================================================================
  // Phase 13: Reports & Ads Methods
  // ============================================================================

  // Company Reports
  async createCampaignReport(campaignId: string, input: { type?: string; language?: string }): Promise<GeneratedReportDto> {
    return this.request(`company/campaigns/${campaignId}/reports`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listCampaignReports(campaignId: string): Promise<GeneratedReportDto[]> {
    return this.request(`company/campaigns/${campaignId}/reports`, { method: 'GET' });
  }

  async getReportDownloadUrl(reportId: string): Promise<{ url: string; expiresAt: string }> {
    return this.request(`reports/${reportId}/download`, { method: 'GET' });
  }

  // Driver Reports
  async createDriverEarningsReport(input: { from?: string; to?: string; assignmentId?: string }): Promise<GeneratedReportDto> {
    return this.request('driver/reports/earnings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listDriverReports(): Promise<GeneratedReportDto[]> {
    return this.request('driver/reports', { method: 'GET' });
  }

  // Finance Monthly Pack
  async createFinanceMonthlyPack(input: { month: string }): Promise<GeneratedReportDto> {
    return this.request('admin/reports/finance-monthly', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Admin Reports Management
  async adminListGeneratedReports(params?: Record<string, any>): Promise<{ reports: GeneratedReportDto[]; total: number }> {
    const q = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      }
    }
    return this.request(`admin/reports?${q.toString()}`, { method: 'GET' });
  }

  async adminRegenerateReport(reportId: string, reason?: string): Promise<GeneratedReportDto> {
    return this.request(`admin/reports/${reportId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Public Report Verification
  async verifyReport(publicId: string, hash: string): Promise<PublicReportVerifyDto> {
    return this.request(`public/reports/verify/${publicId}?hash=${encodeURIComponent(hash)}`, { method: 'GET' });
  }

  // Admin Local Ads & Advertisers
  async adminListLocalAdvertisers(params?: Record<string, any>): Promise<{ advertisers: LocalAdvertiserDto[]; total: number }> {
    const q = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      }
    }
    return this.request(`admin/ads/advertisers?${q.toString()}`, { method: 'GET' });
  }

  async adminCreateLocalAdvertiser(data: any): Promise<LocalAdvertiserDto> {
    return this.request('admin/ads/advertisers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateLocalAdvertiser(id: string, data: any): Promise<LocalAdvertiserDto> {
    return this.request(`admin/ads/advertisers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminListLocalAds(params?: Record<string, any>): Promise<{ ads: LocalAdDto[]; total: number }> {
    const q = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      }
    }
    return this.request(`admin/ads?${q.toString()}`, { method: 'GET' });
  }

  async adminCreateLocalAd(data: any): Promise<LocalAdDto> {
    return this.request('admin/ads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateLocalAd(id: string, data: any): Promise<LocalAdDto> {
    return this.request(`admin/ads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminReviewLocalAd(id: string, data: { decision: string; reasons?: string[]; note?: string }): Promise<LocalAdDto> {
    return this.request(`admin/ads/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminGetLocalAdStats(id: string, params?: { from?: string; to?: string }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    return this.request(`admin/ads/${id}/stats?${q.toString()}`, { method: 'GET' });
  }

  async adminTriggerLocalAdPerformanceReport(advertiserId: string, params: { from: string; to: string; language?: string }): Promise<GeneratedReportDto> {
    return this.request(`admin/ads/advertisers/${advertiserId}/performance-report`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Admin Ads Health & Revenue
  async adminListAdPlacementHealth(params?: { from?: string; to?: string }): Promise<AdPlacementHealthDto[]> {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    return this.request(`admin/ads/health?${q.toString()}`, { method: 'GET' });
  }

  async adminListAdRevenueEntries(params?: { month?: string }): Promise<AdRevenueEntryDto[]> {
    const q = new URLSearchParams();
    if (params?.month) q.set('month', params.month);
    return this.request(`admin/ads/revenue?${q.toString()}`, { method: 'GET' });
  }

  async adminCreateAdRevenueEntry(data: any): Promise<AdRevenueEntryDto> {
    return this.request('admin/ads/revenue', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Driver Ads Serving & Telemetry
  async driverGetLocalAds(params: { placement: string; limit?: number }): Promise<{ ads: ServedLocalAdDto[] }> {
    const q = new URLSearchParams();
    q.set('placement', params.placement);
    if (params.limit) q.set('limit', String(params.limit));
    return this.request(`driver/local-ads?${q.toString()}`, { method: 'GET' });
  }

  async driverRecordLocalAdEvent(adId: string, data: { eventType: 'IMPRESSION' | 'CLICK'; viewId?: string }): Promise<{ recorded: boolean }> {
    return this.request(`driver/local-ads/${adId}/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async driverRecordAdBatchEvents(data: { events: Array<{ date: string; placement: string; source: string; type: string }> }): Promise<{ recorded: boolean; count: number }> {
    return this.request('driver/ad-events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // Phase 15: Pilot Launch, Guardrails, Rehearsal and Operations
  // ============================================================================

  // Invite Codes
  async validateInviteCode(code: string): Promise<{ valid: boolean; role?: string; cityName?: string; message?: string }> {
    return this.request(`public/invite-codes/${encodeURIComponent(code)}/validate`, { method: 'GET' });
  }

  async adminListInviteCodes(params?: { page?: number; limit?: number; status?: string; role?: string }): Promise<{ items: InviteCodeDto[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    if (params?.role) q.set('role', params.role);
    return this.request(`admin/invite-codes?${q.toString()}`, { method: 'GET' });
  }

  async adminCreateInviteCode(data: CreateInviteCodeInput): Promise<InviteCodeDto> {
    return this.request('admin/invite-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminBatchCreateInviteCodes(data: BatchCreateInviteCodesInput): Promise<{ count: number; codes: InviteCodeDto[] }> {
    return this.request('admin/invite-codes/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateInviteCodeStatus(id: string, status: string): Promise<InviteCodeDto> {
    return this.request(`admin/invite-codes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async adminDownloadInviteQrSheet(id: string): Promise<Blob | ArrayBuffer | string> {
    return this.request(`admin/invite-codes/${id}/qr-sheet`, { method: 'GET' });
  }

  // Waitlist
  async submitWaitlist(data: WaitlistSubmitInput): Promise<{ message: string }> {
    return this.request('public/waitlist', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminListWaitlist(params?: { page?: number; limit?: number; status?: string; role?: string }): Promise<{ items: WaitlistEntryDto[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    if (params?.role) q.set('role', params.role);
    return this.request(`admin/waitlist?${q.toString()}`, { method: 'GET' });
  }

  async adminInviteWaitlistEntry(id: string): Promise<{ message: string; inviteCode: string }> {
    return this.request(`admin/waitlist/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Pilot Counters & Command Center
  async getPilotCounters(): Promise<PilotCountersDto> {
    return this.request('admin/pilot/counters', { method: 'GET' });
  }

  async adminGetPilotCommandCenter(): Promise<PilotCommandCenter> {
    return this.request('admin/pilot/command-center', { method: 'GET' });
  }

  // Anomalies
  async adminListAnomalies(params?: { page?: number; limit?: number; status?: string; severity?: string }): Promise<{ items: AnomalyFindingDto[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    if (params?.severity) q.set('severity', params.severity);
    return this.request(`admin/pilot/anomalies?${q.toString()}`, { method: 'GET' });
  }

  async adminUpdateAnomalyStatus(id: string, data: { status: string; notes?: string }): Promise<AnomalyFindingDto> {
    return this.request(`admin/pilot/anomalies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Second-Look Quality Control
  async adminListSecondLooks(params?: { page?: number; limit?: number; status?: string }): Promise<{ items: ReviewSecondLookDto[]; total: number; agreementPercent: number }> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    return this.request(`admin/quality/second-looks?${q.toString()}`, { method: 'GET' });
  }

  async adminDecideSecondLook(id: string, data: { decision: string; note?: string }): Promise<ReviewSecondLookDto> {
    return this.request(`admin/quality/second-looks/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Feedback & NPS
  async submitFeedback(data: CreateFeedbackInput): Promise<{ message: string; id: string }> {
    return this.request('me/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminListFeedback(params?: { page?: number; limit?: number; category?: string; status?: string }): Promise<{ items: FeedbackDto[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.category) q.set('category', params.category);
    if (params?.status) q.set('status', params.status);
    return this.request(`admin/feedback?${q.toString()}`, { method: 'GET' });
  }

  async adminUpdateFeedbackStatus(id: string, data: { status: string; handledNotes?: string; tags?: string[] }): Promise<FeedbackDto> {
    return this.request(`admin/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Support Requests & Callbacks
  async submitSupportRequest(data: CreateSupportRequestInput): Promise<{ message: string; id: string; slaDueAt: string }> {
    return this.request('me/support-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminListSupportRequests(params?: { page?: number; limit?: number; type?: string; status?: string }): Promise<{ items: SupportRequestDto[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.type) q.set('type', params.type);
    if (params?.status) q.set('status', params.status);
    return this.request(`admin/support-requests?${q.toString()}`, { method: 'GET' });
  }

  async adminUpdateSupportRequest(id: string, data: { status?: string; assignedToId?: string; notes?: string }): Promise<SupportRequestDto> {
    return this.request(`admin/support-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Partner Print Shops
  async listPrintShops(params?: { cityId?: string; zoneId?: string }): Promise<{ items: PrintShopDto[] }> {
    const q = new URLSearchParams();
    if (params?.cityId) q.set('cityId', params.cityId);
    if (params?.zoneId) q.set('zoneId', params.zoneId);
    return this.request(`driver/print-shops?${q.toString()}`, { method: 'GET' });
  }

  async adminListPrintShops(params?: { page?: number; limit?: number; cityId?: string; status?: string }): Promise<{ items: PrintShopDto[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.cityId) q.set('cityId', params.cityId);
    if (params?.status) q.set('status', params.status);
    return this.request(`admin/print-shops?${q.toString()}`, { method: 'GET' });
  }

  async adminCreatePrintShop(data: CreatePrintShopInput): Promise<PrintShopDto> {
    return this.request('admin/print-shops', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdatePrintShop(id: string, data: UpdatePrintShopInput): Promise<PrintShopDto> {
    return this.request(`admin/print-shops/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminDeletePrintShop(id: string): Promise<{ success: boolean }> {
    return this.request(`admin/print-shops/${id}`, { method: 'DELETE' });
  }

  // Launch Readiness & Sign-off Gate
  async adminGetLaunchReadiness(): Promise<LaunchReadiness> {
    return this.request('admin/launch/readiness', { method: 'GET' });
  }

  async adminAttestLaunchSignOff(data: { key: string; notes?: string } | LaunchSignOffAttestationInput): Promise<any> {
    return this.request('admin/launch/sign-offs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminWithdrawLaunchSignOff(signOffKey: string): Promise<any> {
    return this.request(`admin/launch/sign-offs/${signOffKey}`, { method: 'DELETE' });
  }

  async adminRevokeLaunchSignOff(signOffKey: string): Promise<any> {
    return this.adminWithdrawLaunchSignOff(signOffKey);
  }

  // Clock Control (Rehearsals)
  async devGetClockState(): Promise<ClockState> {
    return this.request('dev/clock', { method: 'GET' });
  }

  async devGetClock(): Promise<ClockState> {
    return this.devGetClockState();
  }

  async devAdvanceClock(data: AdvanceClockInput): Promise<ClockState> {
    return this.request('dev/clock/advance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async devResetClock(): Promise<ClockState> {
    return this.request('dev/clock/reset', { method: 'POST' });
  }

  async devRunDueJobsNow(): Promise<{ message: string; jobsTriggered: string[] }> {
    return this.request('dev/clock/run-due-jobs', { method: 'POST' });
  }

  // Weekly Pilot Report Notes
  async adminGetPilotReportNote(weekIdentifier: string): Promise<PilotReportNoteDto | null> {
    return this.request(`admin/pilot/report-notes/${weekIdentifier}`, { method: 'GET' });
  }

  async adminSavePilotReportNote(data: SavePilotReportNoteInput): Promise<PilotReportNoteDto> {
    return this.request('admin/pilot/report-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

