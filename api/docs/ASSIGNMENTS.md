# Driver Assignment and Installation Flow (Phase 6)

## 1. Overview & Purpose

An **Assignment** represents one driver's participation in an active advertising **Campaign**.
To ensure physical verification of advertising collateral, high-quality printing, driver safety, and platform integrity, the system implements a strict multi-step lifecycle:

```
[Driver Enrolment]
  │
  ▼
RESERVED ──(48-hour deadline)──► RESERVATION_EXPIRED (slot freed)
  │
  ├──────(Voluntary Driver/Admin Release)──► RELEASED (slot freed)
  │
  ▼
INSTALLING (downloads print-ready poster artwork & print guide)
  │
  ▼
INSTALL_SUBMITTED (submits live photo of installed poster on vehicle)
  │
  ├───[Admin / Company Review: Approved]───► INSTALL_APPROVED ──(Campaign Starts)──► RUNNING
  │
  └───[Admin / Company Review: Rejected]───► INSTALL_REJECTED (allows up to 3 attempts)
                                                │
                                                └───(Attempts Exhausted)──► TERMINATED (slot freed)
```

---

## 2. Assignment Lifecycle & State Machine

### 2.1 State Definitions

| Status | Description | Slot Occupied? | Next Action for Driver |
| :--- | :--- | :--- | :--- |
| `RESERVED` | Slot reserved by driver for 48 hours; poster artwork released. | Yes | `START_INSTALLING` |
| `INSTALLING` | Driver confirmed they are proceeding to print and stick poster. | Yes | `SUBMIT_PHOTO` |
| `INSTALL_SUBMITTED` | Driver uploaded photo with GPS, accuracy, and timestamp. | Yes | `WAIT_FOR_REVIEW` |
| `INSTALL_APPROVED` | Platform or company moderator approved the installation photo. | Yes | `READY_TO_RUN` |
| `INSTALL_REJECTED` | Photo rejected with specific defect reason codes. Driver can retry. | Yes | `FIX_INSTALLATION` |
| `RUNNING` | Campaign start date arrived; driver is actively on the road. | Yes | `RUNNING_DAILY_PHOTOS` |
| `COMPLETED` | Campaign completed its full scheduled duration. | No | `NONE` |
| `PAID` | Final monthly settlement paid to driver wallet (Phase 8). | No | `NONE` |
| `RELEASED` | Driver voluntarily withdrew or admin released slot before running. | No | `NONE` |
| `RESERVATION_EXPIRED` | 48-hour reservation deadline passed without photo submission. | No | `NONE` |
| `TERMINATED` | Max install attempts exceeded or terminated for breach. | No | `NONE` |

### 2.2 Valid State Transitions

Enforced deterministically by `assignmentStateMachine` (`apps/api/src/modules/assignments/assignments.state-machine.ts`):

- `RESERVED` $\to$ `INSTALLING`, `RELEASED`, `RESERVATION_EXPIRED`, `TERMINATED`
- `INSTALLING` $\to$ `INSTALL_SUBMITTED`, `RELEASED`, `RESERVATION_EXPIRED`, `TERMINATED`
- `INSTALL_SUBMITTED` $\to$ `INSTALL_APPROVED`, `INSTALL_REJECTED`, `TERMINATED`
- `INSTALL_REJECTED` $\to$ `INSTALLING`, `INSTALL_SUBMITTED`, `RELEASED`, `TERMINATED`
- `INSTALL_APPROVED` $\to$ `RUNNING`, `TERMINATED`
- `RUNNING` $\to$ `COMPLETED`, `TERMINATED`
- `COMPLETED` $\to$ `PAID`, `TERMINATED`
- `PAID`, `TERMINATED`, `RESERVATION_EXPIRED`, `RELEASED` $\to$ Terminal states (no transitions).

---

## 3. Atomic Slot Reservation & Concurrency

1. **Active Assignment Limit**:
   - A driver may only participate in **one active assignment at a time**.
   - A vehicle (`registrationNumber`) may only have **one active assignment at a time** (enforced via database partial unique index on non-terminal statuses).
2. **Pessimistic Slot Locking**:
   - Slot counts are reserved in PostgreSQL inside a serialized transaction using `SELECT ... FOR UPDATE` via `SlotsService.lockCampaignForSlotChange`.
   - Idempotency key (`Idempotency-Key` header) ensures network retries return the existing assignment without allocating duplicate slots.
3. **48-Hour Reservation Hold**:
   - System setting `campaign.reservation_hold_hours` defaults to 48 hours.
   - `AssignmentJobsService.processReservationExpiry` runs hourly; if `expiresAt < NOW()` and status is `RESERVED`, status transitions to `RESERVATION_EXPIRED` and slot is immediately made available for other drivers.

---

## 4. Automated Photo Verification Library

Located in `apps/api/src/modules/photos/checks/`:

### 4.1 Perceptual dHash (Difference Hash) & Duplicate Detection
- Converts uploaded photo buffer to a normalized 9x8 grayscale image via Sharp (`dhash.ts`).
- Generates a 64-bit binary perceptual hash represented as a 16-character hexadecimal string.
- Computes Hamming distance against existing verified photos. If distance $\le 10$, flags `matchedPhotoId` as potential duplicate or reused image.

### 4.2 Haversine Geofencing
- Calculates great-circle distance between submission coordinates $(lat, lng)$ and campaign zone centroid $(centerLat, centerLng)$.
- Validates that the driver is within the allowed zone radius ($\le radiusMeters + accuracyMeters$).

### 4.3 Integrity & Mock Location Checks
- Verifies image dimensions (minimum 300x300, maximum 8000x8000).
- Rejects future timestamps ($> 5$ minutes ahead of server clock) or stale submissions ($> 24$ hours old).
- Rejects hardware mock location providers (`isMockLocation: true`).

---

## 5. Review Flow & SLA Escalation

### 5.1 Review Assignment
- Defined on campaign creation by `installApprover`:
  - `PLATFORM`: Platform moderator team reviews submission.
  - `COMPANY`: Brand/company manager reviews submissions for their own campaign.

### 5.2 Review Actions
- `APPROVED`: Verifies photo, marks photo `VERIFIED`, updates assignment to `INSTALL_APPROVED`.
  - Calculates driver rent window:
    $$\text{runStartDate} = \max(\text{campaign.startDate}, \text{approvalDateIST})$$
    $$\text{windowDays} = \text{diffDaysIST}(\text{runStartDate}, \text{campaign.endDate})$$
  - Emits `assignment.install_approved` event with `printingAllowancePaise` and `windowDays`.
- `REJECTED`: Records rejection reason codes (e.g., `WRONG_AUTO_OR_PLATE`, `POSTER_WRINKLED_OR_DAMAGED`, `POOR_LIGHTING_OR_BLURRY`).
  - Increments `installAttempts`.
  - If attempts $\ge 3 + \text{extraAttemptsGranted}$, transitions to `TERMINATED` and frees slot.
  - Otherwise, assignment remains in `INSTALL_REJECTED` allowing driver to fix and re-submit.
- `EXTRA_ATTEMPT_GRANTED`: Allows moderator to grant $+1$ retry without terminating.

### 5.3 SLA Escalation
- If a company review is not completed within `campaign.company_review_sla_hours` (default 24h), `AssignmentJobsService.processCompanyInstallationEscalations` automatically reassigns `reviewOwner` to `PLATFORM`, records `escalatedAt`, and surfaces the submission in the admin review queue.

### 5.4 Driver Privacy & PII Sanitization
- In company-facing APIs (`/api/v1/company/installations`), driver personal data is strictly masked:
  - Driver name replaced with pseudonymous code: `DRV-XXXX` (derived from UUID).
  - Driver phone number is never exposed (`null`).
  - Vehicle plate shows only state code and last 4 digits: `GJ01 *** 1234`.

---

## 6. Scheduled Background Processors

Managed via `AssignmentJobsService`:

1. `assignment-reservation-expiry`: Expires overdue `RESERVED` assignments every hour.
2. `assignment-reservation-reminder`: Sends reminders to drivers 12 hours before expiration.
3. `assignment-installation-escalation`: Checks unreviewed company installations every 30 minutes and escalates breached SLAs to `PLATFORM`.
4. `assignment-start`: Transitions `INSTALL_APPROVED` assignments to `RUNNING` at 00:00:00 IST on campaign start date.
5. `assignment-complete`: Transitions `RUNNING` assignments to `COMPLETED` at 23:59:59 IST on campaign end date, strictly gated by Phase 7 verification: all `AssignmentDay` records must be finalized (zero `PENDING` or `UNDER_REVIEW` days remain). See [docs/DAILY_PROOF.md](file:///d:/Ravi/Radhe/Auto-Poster-Platform/docs/DAILY_PROOF.md).

