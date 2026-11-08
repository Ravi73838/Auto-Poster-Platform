# Phase 15 Operational Roles, Shifts & Staffing Roster

> **Document Status**: ACTIVE OPERATIONAL GUIDE  
> **Pilot Geography**: Surat & Ahmedabad  
> **Timezone**: Indian Standard Time (IST) (UTC+05:30)

---

## 1. Operational Roles & Responsibilities

| Role | Key Responsibilities | Primary Tools |
| :--- | :--- | :--- |
| **Operations Lead** | Oversees pilot guardrail caps, advertiser relationship, daily brief triage, and escalation management. | `/admin/pilot-command-center`, `/admin/launch-readiness` |
| **Driver Field Lead** | On-ground recruitment at auto stands/CNG stations, poster printing liaison, installation physical checks. | Driver App, WhatsApp Helpline, Print Shop Hub |
| **Verification & QC Officer** | Reviews driver KYC submissions, installation photos, daily proofs, and executes Second-Look QC. | `/admin/my-work`, `/admin/quality-review`, `/admin/photo-review` |
| **Finance Officer** | Reviews daily payout batches, checks Razorpay Route nodal ledger balance, investigates failed UPIs. | `/admin/payouts`, `/admin/payments`, Razorpay Dashboard |
| **On-Call Engineering Lead** | Monitors server health, database connection pool, Redis queues, and handles P1 technical bugs. | Sentry, Better Uptime, `/admin/system` |

---

## 2. Shift Coverage Schedule

To ensure prompt review of daily proof photos and rapid driver support across the active auto-rickshaw working hours (06:00 to 22:00 IST), staffing is structured across two primary shifts:

```
[06:00 AM] ------------------------ [02:30 PM] ------------------------ [11:00 PM]
  |  Morning Shift (07:00 - 15:30)     |   Evening Shift (14:30 - 23:00)    |
  |  - KYC Reviews                     |   - Evening Photo Surge Review     |
  |  - Field Hub Visits                |   - Late Submissions Follow-up     |
  |  - 08:30 Daily Brief Stand-up      |   - Daily Settlement Sign-off      |
```

### Shift 1 (Morning: 07:00 – 15:30 IST)
- **Primary Focus**: Morning photo submissions, driver morning onboarding, KYC queue triage, and daily briefing.
- **Key Milestones**:
  - `08:00`: Review `pilot-daily-brief` automated findings.
  - `08:30`: 15-minute cross-functional team stand-up.
  - `10:00`: Process morning KYC submissions & issue invite codes.
  - `13:00`: Coordinate vinyl poster printing batch with partner print shop.

### Shift 2 (Evening: 14:30 – 23:00 IST)
- **Primary Focus**: Peak daily photo submission surge (17:00 – 22:00 IST), fraud flag review, late-submission reminder follow-ups, and settlement preparation.
- **Key Milestones**:
  - `17:00`: Automated push notification trigger (`DLT_DAILY_PHOTO_REMIND`).
  - `19:00`: Review flagged photos (`PHASH_DUPLICATE`, `GPS_CLUSTER_SUSPICIOUS`).
  - `21:30`: Second-Look QC review queue cleared.
  - `22:30`: Sign-off on daily verified photos and run settlement job.

---

## 3. Daily Checklist for Shift Leads

- [ ] **Morning Verification**:
  - [ ] Check `/admin/pilot-command-center` for active cap limits.
  - [ ] Ensure KYC queue has zero submissions older than 2 hours.
  - [ ] Clear any driver support callbacks requested overnight.
- [ ] **Evening Verification**:
  - [ ] Audit at least 10 photo submissions in Second-Look queue (`/admin/quality-review`).
  - [ ] Verify 0 failed payouts in `/admin/payouts`.
  - [ ] Check Redis queue lag in `/admin/system`.

