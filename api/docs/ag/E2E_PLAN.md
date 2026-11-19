# AG-6 Execution Plan: Full End-to-End Business Flow, Visible Data & Walkthrough

**Author:** Senior QA Lead & Full-Stack Engineer  
**Date:** 2026-11-18  
**Status:** In Execution (AG-6 In Progress)  

---

## 1. Executive Overview & Scope Boundaries

Milestone **AG-6** exercises and verifies the complete Auto Poster Advertising Platform business lifecycle end-to-end across all platform personas (Company, Driver, Admin) and all financial, compliance, and verification channels.

### Strict Schema Isolation & Safety Boundaries
1. **Part A (Full Automated Business Chain with Time Compression)**:
   - Runs **ONLY** against the isolated Supabase `test` schema (`DATABASE_URL_TEST`).
   - Prepared via `cd api && npm run db:test:prepare`.
   - Uses virtual clock control (`TimeService.setClock`) and test-only helper endpoints.
   - Proves every single lifecycle state, ledger posting, dispute, strike, settlement, payout, and report.
2. **Parts B & C (Real Walkthrough on `public` Development Schema)**:
   - **ADDITIVE ONLY**: No deletes, no truncations, no migrations, no test helpers, no clock control.
   - **Zero Alteration of Pre-Existing Data**: All entities created use the prefix `UAT`, domain `@demo.autoposter.test`, and reserved fake mobile numbers (`+919000000001` - `+919000000099`).
   - Every created ID is recorded in `api/.local/walkthrough/state.json` for idempotency and resumeability.
   - **Settings Compression**: Applied via the real Admin Settings UI using the two-person maker-checker flow (`admin@autoposter.in` proposes, `admin@autoposter.com` approves). Original values backed up to `api/.local/walkthrough/settings-backup.json` and restored via `npm run walkthrough:restore-settings`.
   - **Gate**: Before the FIRST write to `public`, the exact plan and cast are presented to the user and requires explicit approval ("yes, proceed").
3. **Part D (Data Verification & Proof)**:
   - Read-only queries to prove ledger trial balance is zero, escrow matches commitments, and no pre-existing records were modified.
4. **Part E (Documentation & Credentials)**:
   - Output `api/docs/ag/WALKTHROUGH_DATA.md`, `api/.local/walkthrough/credentials.md`, and the full credentials table in the final reply.

---

## 2. Walkthrough Cast & Personas (`public` Schema)

All walkthrough accounts use deterministic test passwords following platform complexity rules: `UatPass2026!`.

### 2.1 Companies & Team Members

| Code | Entity Name | Member Role | Email / Login | Password | Preferred Language | Target Initial State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **C1** | UAT Fresh Mart | OWNER | `c1.owner@demo.autoposter.test` | `UatPass2026!` | English (`en`) | Approved KYC, Campaigns A1 & A2 Paid, A3 Cancelled, Photo Flagged, Dispute Filed |
| **C1-M** | UAT Fresh Mart | MANAGER | `c1.manager@demo.autoposter.test` | `UatPass2026!` | English (`en`) | Accepted Invitation, Can Manage Campaigns & View Gallery |
| **C1-F** | UAT Fresh Mart | FINANCE | `c1.finance@demo.autoposter.test` | `UatPass2026!` | English (`en`) | Accepted Invitation, Paid Invoices via Dev Checkout, Views Escrow & Tax Docs |
| **C1-V** | UAT Fresh Mart | VIEWER | `c1.viewer@demo.autoposter.test` | `UatPass2026!` | English (`en`) | Accepted Invitation, Read-Only Gallery & Metrics View |
| **C2** | UAT Tasty Bites | OWNER | `c2.owner@demo.autoposter.test` | `UatPass2026!` | Hindi (`hi`) | Approved KYC (after 1 Need-More-Info round), Campaign B1 Approved Awaiting Payment, B2 Draft |
| **C3** | UAT Quick Clinic| OWNER | `c3.owner@demo.autoposter.test` | `UatPass2026!` | Gujarati (`gu`) | KYC Submitted, Rejected with Admin Reason Codes (Left Rejected) |
| **C4** | UAT New Co | OWNER | `c4.owner@demo.autoposter.test` | `UatPass2026!` | English (`en`) | Registered Only (Onboarding Not Started) |

### 2.2 Auto-Rickshaw Drivers

| Code | Display Name | Mobile Number | Password | Vehicle Plate | Language | Target Initial State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **D1** | UAT Driver 01 | `+919000000001` | `UatPass2026!` | `GJ-01-UA-1001` | Hindi (`hi`) | Approved KYC, Enrolled in Campaign A2, Installation Approved, Today Photo VERIFIED |
| **D2** | UAT Driver 02 | `+919000000002` | `UatPass2026!` | `GJ-01-UA-1002` | Gujarati (`gu`) | Approved KYC, Enrolled in Campaign A2, Install Retried & Approved, Today Photo Approved via Admin Review |
| **D3** | UAT Driver 03 | `+919000000003` | `UatPass2026!` | `GJ-01-UA-1003` | English (`en`) | Approved KYC, Enrolled in Campaign A1, Installation Photo Submitted (Awaiting Review) |
| **D4** | UAT Driver 04 | `+919000000004` | `UatPass2026!` | `GJ-01-UA-1004` | English (`en`) | Approved KYC, Enrolled in Campaign A1, Running & Verified (Target for Day 2 Settlement & Payout) |
| **D5** | UAT Driver 05 | `+919000000005` | `UatPass2026!` | `GJ-01-UA-1005` | Hindi (`hi`) | KYC Submitted, Need-More-Info Requested by Admin (Left in this state) |
| **D6** | UAT Driver 06 | `+919000000006` | `UatPass2026!` | `GJ-01-UA-1006` | Gujarati (`gu`) | KYC Submitted (Pending Initial Verification) |
| **D7** | UAT Driver 07 | `+919000000007` | `UatPass2026!` | `GJ-01-UA-1007` | English (`en`) | Registered Only (Onboarding Not Started) |
| **D8** | UAT Driver 08 | `+919000000008` | `UatPass2026!` | `GJ-01-UA-1008` | Hindi (`hi`) | Approved KYC, Enrolled in A2, Active Dispute Filed with Photo Evidence (Under Review) |
| **D9** | UAT Driver 09 | `+919000000009` | `UatPass2026!` | `GJ-01-UA-1009` | English (`en`) | Approved KYC, Enrolled in A2, Reused Photo Detected, Issued 1 Strike |
| **D10**| UAT Driver 10 | `+919000000010` | `UatPass2026!` | `GJ-01-UA-1010` | Gujarati (`gu`) | Approved KYC, Enrolled in A2, Voluntarily Withdrew Reservation Before Installation |

### 2.3 Administrative Staff (Pre-Existing Accounts)

| Role | Email | Password | Responsibility in Walkthrough |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN (Lead)** | `admin@autoposter.in` | `AdminPassword123!` | Proposes sensitive setting changes, oversees dispute escalations |
| **SUPER_ADMIN (Approver)** | `admin@autoposter.com` | `AdminPassword123!` | Approves two-person setting change requests, final close-outs |
| **MODERATOR** | `moderator@autoposter.in` | `ModeratorPassword123!` | Reviews KYC submissions, approves campaigns, moderates daily photos, resolves flags |
| **FINANCE** | `finance@autoposter.in` | `FinancePassword123!` | Reviews payouts, executes settlements with password step-up, validates bank ledger |

---

## 3. Platform Settings Compression Plan (`public` Schema)

To allow a 1-day campaign (A1) to become live immediately today and complete after midnight IST, the following settings will be modified via the sensitive settings maker-checker workflow:

| Setting Key | Baseline Value | Walkthrough Value | Two-Person Approval Required? | Purpose |
| :--- | :---: | :---: | :---: | :--- |
| `min_lead_days` | `3` | `0` | No (Immediate) | Allows campaign to start on the current calendar date |
| `min_campaign_days` | `15` | `1` | No (Immediate) | Allows 1-day testing duration for Campaign A1 |
| `settlement_delay_days` | `2` | `0` | **Yes (Maker-Checker)** | Allows immediate settlement calculation after assignment completion |
| `daily_photo_late_grace_hours` | `null` (default 0) | `0` | No (Immediate) | Immediate cutoff enforcement at 22:00 IST |

**Backup Destination:** `api/.local/walkthrough/settings-backup.json`  
**Restoration Command:** `cd api && npm run walkthrough:restore-settings`  

---

## 4. End-to-End Walkthrough Execution Matrix

```mermaid
sequenceDiagram
    autonumber
    actor Comp as Company (C1-C4)
    actor Adm as Admins (Mod, Fin, Super)
    actor Driv as Drivers (D1-D10)
    participant API as Core Backend & Ledger

    rect rgb(240, 248, 255)
    Note over Comp,API: Phase 1: Onboarding & Team Provisioning
    Comp->>API: C1, C2, C3, C4 Register
    Comp->>API: C1, C2, C3 Submit KYC
    Adm->>API: Mod reviews KYC (C1/C2 Need-More-Info -> Resubmit -> Approved; C3 Rejected)
    Comp->>API: C1 Invites Manager, Finance, Viewer -> Members Accept
    end

    rect rgb(255, 250, 240)
    Note over Comp,API: Phase 2: Campaign Creation & Escrow Funding
    Comp->>API: C1 Creates A1 (1 day, 3 slots), A2 (15 days, 5 slots), A3 (2 slots)
    Adm->>API: Mod Approves A1, A2, A3
    Comp->>API: C1 Finance Pays A1, A2, A3 via Dev Checkout -> Escrow Credited
    Comp->>API: C1 Cancels A3 -> Full Escrow Refund & Credit Note Issued
    Comp->>API: C2 Creates B1 -> Mod Rejects -> C2 Edits -> Mod Approves (Awaiting Payment)
    end

    rect rgb(240, 255, 240)
    Note over Driv,API: Phase 3: Driver Onboarding & Slot Enrollment
    Driv->>API: D1-D10 Register & Complete KYC
    Adm->>API: Mod Approves D1, D2, D3, D4, D8, D9, D10; D5 Need-More-Info; D6 Pending
    Driv->>API: D1, D2, D8, D9, D10 Reserve A2; D3, D4 Reserve A1
    Driv->>API: D10 Voluntarily Releases A2 Reservation (Slot Restored)
    end

    rect rgb(255, 245, 245)
    Note over Driv,API: Phase 4: Installation & Proof Verification
    Driv->>API: D1, D2, D3, D4, D8, D9 Submit Installation Photos
    Adm->>API: Mod Approves D1, D4; D2 Rejected -> Retaken -> Approved; D3 Left Pending
    Driv->>API: D1, D4 Submit Daily Photo -> Auto-Verified
    Driv->>API: D2 Submits Daily Photo -> Soft Check Flagged -> Mod Approves in Review Queue
    Driv->>API: D9 Submits Duplicate Photo -> Mod Rejects as Reused -> 1 Strike Issued
    Comp->>API: C1 Flags D1 Photo -> Mod Resolves -> C1 Disputes -> Mod Decides
    Driv->>API: D8 Files Dispute on Rejected Photo with Evidence -> Left Under Review
    end
```

---

## 5. Part A: Automated Full Lifecycle Specification (`test` Schema)

Part A runs in `web/e2e/full/e2e-full-lifecycle.spec.ts` against the isolated `test` database. It covers the following exact steps:
1. **New Company**: Register, Support Callback view, Onboarding wizard, File uploads, Need-More-Info, Resubmission, Approval.
2. **Team**: Owner invites Manager and Finance; permissions check (Manager cannot view invoices; Finance can pay).
3. **Campaign**: Create 50 slots, 30 days, Rent 100000 paise, Print 15000 paise, Commission 2000 bps, GST 1800 bps $\to$ Total 6930000 paise. Admin reject, edit, resubmit, approval.
4. **Payment**: Dev checkout payment, webhook, invoice generation, Escrow holds 6930000 paise.
5. **Drivers**: 4 drivers registered, KYC uploaded, approved.
6. **Installation**: Download poster (verify SHA-256 and dimensions), upload invalid proofs (stale, out-of-zone, low accuracy, mock GPS) all rejected, then valid upload, admin approval, print allowance credited.
7. **Daily Proof Simulation**: 30-day compressed timeline, auto-verification, dHash near-duplicate manual review, duplicate rejection, fraud strike, missed days accounting.
8. **Company Progress & Privacy**: Verify driver PII masked (e.g. `GJ-01-**-1234`, coordinates fuzzy to 3 decimals).
9. **Completion & Settlement**: 4 spec cases verified:
   - 30 verified days $\to$ 100000 paise
   - 27 verified days $\to$ 100000 paise (grace days applied)
   - 24 verified days $\to$ 90000 paise
   - 15 verified days $\to$ 60000 paise
10. **Driver Payout**: Minimum withdrawal, cap, idempotency, Finance step-up approval, manual provider UTR import, wallet debit.
11. **Close-Out & Refunds**: Unfilled slots refund, escrow strictly 0, credit notes, final report generation.
12. **Repeatability**: Journey must pass 2x consecutively.

---

## 6. Verification & Day 2 Plan (`public` Schema)

### Part D Verification Checklist
- **Ledger Invariant**: $\sum \text{Debits} = \sum \text{Credits}$ across all transactions (`/api/v1/admin/finance/trial-balance`).
- **Escrow Invariant**: Campaign escrow account equals total unpaid verified obligations.
- **Sequential Invoices**: Tax invoice counter strictly increments without gaps.
- **Attribution Proof**: `walkthrough:verify-attribution` confirms 0 pre-existing records were modified.
- **Trilingual Checks**: Notifications confirmed delivered in English, Hindi, and Gujarati based on driver/company preference.

### Day 2 Automated Script (`npm run walkthrough:day2`)
- Executes after midnight IST when Campaign A1's 1-day duration has concluded.
- Automatically claims assignment completion and verifies settlement calculation for Driver D4.
- Finance Admin approves settlement via step-up password.
- Driver D4 requests wallet withdrawal (rent + print allowance).
- Finance Admin approves payout, exports manual batch, and imports UTR CSV (`UTR-UAT-998877`).
- Executes `walkthrough:restore-settings` to revert all platform settings to baseline.
- Generates final walkthrough completion report.
