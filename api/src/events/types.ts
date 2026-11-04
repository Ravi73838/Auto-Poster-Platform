export interface CampaignSubmittedEvent {
  campaignId: string;
  companyId: string;
  title: string;
  submittedAt: Date;
}

export interface CampaignApprovedEvent {
  campaignId: string;
  companyId: string;
  title: string;
  approvedAt: Date;
  paymentDeadlineAt: Date;
  totalChargedPaise: bigint | string;
}

export interface CampaignRejectedEvent {
  campaignId: string;
  companyId: string;
  title: string;
  rejectedAt: Date;
  reasons: Array<{ code: string; customNote?: string }>;
  note?: string | null;
}

export interface CampaignPaidEvent {
  campaignId: string;
  companyId: string;
  paymentId?: string;
  paymentRef?: string;
  amountPaise?: string;
  paidAt?: Date;
}

export interface CampaignLiveEvent {
  campaignId: string;
  companyId: string;
  title: string;
  liveAt: Date;
}

export interface CampaignRunningEvent {
  campaignId: string;
  companyId: string;
  title: string;
  runningAt: Date;
}

export interface CampaignCompletedEvent {
  campaignId: string;
  companyId: string;
  title: string;
  completedAt: Date;
}

export interface CampaignExpiredEvent {
  campaignId: string;
  companyId: string;
  title: string;
  expiredAt: Date;
}

export interface CampaignCancelledEvent {
  campaignId: string;
  companyId: string;
  title: string;
  cancelledAt: Date;
  reason: string;
  cancelledBy: string;
}

export interface CampaignEnrolmentClosedEvent {
  campaignId: string;
  companyId: string;
  title: string;
  totalSlots: number;
  occupiedSlots: number;
  unfilledSlots: number;
  closedAt: Date;
}

export interface AssignmentReservedEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  expiresAt: Date;
}

export interface AssignmentReservationExpiredEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  vehicleId: string;
  expiredAt: Date;
}

export interface AssignmentReservationReminderEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  driverMobile: string;
  remainingHours: number;
  expiresAt: Date;
}

export interface AssignmentReleasedEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  reason: string;
}

export interface AssignmentInstallSubmittedEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  photoId: string;
  attemptNo: number;
}

export interface AssignmentInstallApprovedEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  printingAllowancePaise: number;
  windowDays: number;
}

export interface AssignmentInstallRejectedEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  reasons: Array<{ code: string; note?: string }>;
  isExhausted: boolean;
}

export interface AssignmentReviewEscalatedEvent {
  assignmentId: string;
  campaignId: string;
  escalatedAt: Date;
}

export interface AssignmentRunningEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  startedAt: Date;
}

export interface AssignmentCompletedEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  completedAt: Date;
}

export interface PhotoVerifiedEvent {
  photoId: string;
  assignmentId: string;
  driverId: string;
  date: string;
  autoVerified: boolean;
}

export interface PhotoRejectedEvent {
  photoId: string;
  assignmentId: string;
  driverId: string;
  date: string;
  reasons: Array<{ code: string; note?: string }>;
}

export interface PhotoFlaggedEvent {
  photoId: string;
  flagId: string;
  assignmentId: string;
  campaignId: string;
  flaggedById: string;
  reason: string;
}

export interface PhotoFlagResolvedEvent {
  photoId: string;
  flagId: string;
  resolvedById: string;
  status: string;
  note?: string;
}

export interface PhotoFraudSuspectedEvent {
  photoId: string;
  assignmentId: string;
  driverId: string;
  reason: string;
  details?: unknown;
}

export interface AssignmentDayMissedEvent {
  assignmentId: string;
  driverId: string;
  date: string;
  missedDaysCount: number;
}

export interface AssignmentDayExcusedEvent {
  assignmentId: string;
  driverId: string;
  date: string;
  excusedById: string;
  note: string;
}

export interface AssignmentDaysFinalizedEvent {
  assignmentId: string;
  payableDays: number;
  missedDays: number;
  excusedDays: number;
}

export interface StrikeIssuedEvent {
  strikeId: string;
  driverId: string;
  assignmentId?: string | null;
  reason: string;
  notes?: string | null;
  expiresAt: Date;
}

export interface StrikeRevokedEvent {
  strikeId: string;
  driverId: string;
  revokedById: string;
  reason: string;
}

export interface BanStartedEvent {
  banId: string;
  driverId: string;
  type: string;
  endsAt?: Date | null;
  reason: string;
}

export interface BanLiftedEvent {
  banId: string;
  driverId: string;
  liftedById: string;
  reason: string;
}

export interface AssignmentTerminatedEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  reason: string;
  terminatedById?: string | null;
  terminationDate: string;
  note?: string | null;
}

export interface AssignmentReinstatedEvent {
  assignmentId: string;
  campaignId: string;
  driverId: string;
  reinstatedById: string;
  note?: string | null;
}

export interface PosterFixOpenedEvent {
  noticeId: string;
  assignmentId: string;
  driverId: string;
  deadlineAt: Date;
  sourcePhotoId?: string | null;
}

export interface PosterFixResolvedEvent {
  noticeId: string;
  assignmentId: string;
  driverId: string;
  resolvedPhotoId?: string | null;
}

export interface PosterFixExpiredEvent {
  noticeId: string;
  assignmentId: string;
  driverId: string;
}

export interface DisputeOpenedEvent {
  disputeId: string;
  assignmentId?: string | null;
  campaignId?: string | null;
  raisedByUserId: string;
  raisedByRole: string;
  reason: string;
  queue: string;
  heldAmountPaise: string;
  slaDueAt?: Date | null;
}

export interface DisputeClaimedEvent {
  disputeId: string;
  assignedToId: string;
}

export interface DisputeMessageEvent {
  disputeId: string;
  messageId: string;
  authorId: string;
  authorRole: string;
  visibleTo: string;
}

export interface DisputeResolvedEvent {
  disputeId: string;
  resolvedByUserId: string;
  resolutionType: string;
  resolutionText: string;
  effects: string[];
}

export interface DisputeReopenRequestedEvent {
  disputeId: string;
  requestedByUserId: string;
  reason: string;
}

export interface DisputeEscalatedEvent {
  disputeId: string;
  slaDueAt: Date;
  assignedToId?: string | null;
}

export interface AnnouncementSentEvent {
  announcementId: string;
  createdById: string;
  targetCount: number;
  sentCount: number;
}

export interface AppEvents {
  'campaign.submitted': CampaignSubmittedEvent;
  'campaign.approved': CampaignApprovedEvent;
  'campaign.rejected': CampaignRejectedEvent;
  'campaign.paid': CampaignPaidEvent;
  'campaign.live': CampaignLiveEvent;
  'campaign.running': CampaignRunningEvent;
  'campaign.completed': CampaignCompletedEvent;
  'campaign.expired': CampaignExpiredEvent;
  'campaign.cancelled': CampaignCancelledEvent;
  'campaign.enrolment_closed': CampaignEnrolmentClosedEvent;
  'assignment.reserved': AssignmentReservedEvent;
  'assignment.reservation_expired': AssignmentReservationExpiredEvent;
  'assignment.reservation_reminder': AssignmentReservationReminderEvent;
  'assignment.released': AssignmentReleasedEvent;
  'assignment.install_submitted': AssignmentInstallSubmittedEvent;
  'assignment.install_approved': AssignmentInstallApprovedEvent;
  'assignment.install_rejected': AssignmentInstallRejectedEvent;
  'assignment.review_escalated': AssignmentReviewEscalatedEvent;
  'assignment.running': AssignmentRunningEvent;
  'assignment.completed': AssignmentCompletedEvent;
  'photo.verified': PhotoVerifiedEvent;
  'photo.rejected': PhotoRejectedEvent;
  'photo.flagged': PhotoFlaggedEvent;
  'photo.flag_resolved': PhotoFlagResolvedEvent;
  'photo.fraud_suspected': PhotoFraudSuspectedEvent;
  'assignment.day_missed': AssignmentDayMissedEvent;
  'assignment.day_excused': AssignmentDayExcusedEvent;
  'assignment.days_finalized': AssignmentDaysFinalizedEvent;
  'strike.issued': StrikeIssuedEvent;
  'strike.revoked': StrikeRevokedEvent;
  'ban.started': BanStartedEvent;
  'ban.lifted': BanLiftedEvent;
  'assignment.terminated': AssignmentTerminatedEvent;
  'assignment.reinstated': AssignmentReinstatedEvent;
  'poster_fix.opened': PosterFixOpenedEvent;
  'poster_fix.resolved': PosterFixResolvedEvent;
  'poster_fix.expired': PosterFixExpiredEvent;
  'dispute.opened': DisputeOpenedEvent;
  'dispute.claimed': DisputeClaimedEvent;
  'dispute.message': DisputeMessageEvent;
  'dispute.resolved': DisputeResolvedEvent;
  'dispute.reopen_requested': DisputeReopenRequestedEvent;
  'dispute.escalated': DisputeEscalatedEvent;
  'announcement.sent': AnnouncementSentEvent;
}
