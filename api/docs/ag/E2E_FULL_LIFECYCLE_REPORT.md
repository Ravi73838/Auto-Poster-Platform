# Auto Poster Platform - Full End-to-End Business Lifecycle Report (AG-6 Part A)

## 1. Executive Summary

This report documents the automated, end-to-end business lifecycle verification executed under Milestone **AG-6 Part A**. The automated test suite (`web/e2e/full/e2e-full-lifecycle.spec.ts`) systematically exercises the entire journey of the Auto Poster Advertising Platform across all platform personas (Company, Driver, Admin Staff) and every stage of campaign management, double-entry financial accounting, fraud protection, daily proof verification, settlement mathematics, and final sweep to zero escrow.

* **Test Specification**: `web/e2e/full/e2e-full-lifecycle.spec.ts`
* **Test Runner**: Playwright (`npm run e2e:full` - Chromium Desktop)
* **Execution Environment**: Isolated Supabase PostgreSQL `test` schema (`DATABASE_URL_TEST`)
* **Consecutive Passes**: **2/2 PASSED (100% Pass Rate)**
  * **Run 1**: 15.6 minutes – **PASSED**
  * **Run 2**: 11.9 minutes – **PASSED**
* **Total Business Lifecycle Steps Verified**: **12 / 12 Steps Passed**
* **Double-Entry Ledger Integrity**: Trial balance verified balanced with diff = 0 paise across all stages.
* **Escrow Balance Invariant**: Guaranteed zero leftover escrow upon close-out.

---

## 2. 12-Step Lifecycle Execution Summary

| Step | Scope & Description | Key Operations & Invariants Verified | Status |
| :--- | :--- | :--- | :---: |
| **Step 0** | Bootstrap & Staff Setup | Virtual clock reset, login Super Admin, Moderator, Finance Admin, resolve Ahmedabad city and SG Highway zone IDs | **PASSED** |
| **Step 1** | Company Onboarding & KYC | New company registration, forgot-password UI verification, KYC document upload (presign -> S3 PUT -> confirm), GSTIN verification, admin Need-More-Info rejection, resubmission, and moderator verification | **PASSED** |
| **Step 2** | Team Roles & RBAC | Multi-user company team login (Manager, Finance, Viewer), verified role-based access controls and financial document visibility | **PASSED** |
| **Step 3** | Campaign Creation & Review | Poster upload, price preview calculation (50 slots, 30 days, rent 100,000 paise, print allowance 15,000 paise, commission 20%, GST 18% $\to$ Total 6,930,000 paise), moderator review rejection, resubmit, claim & approve | **PASSED** |
| **Step 4** | Dev Payment & Escrow Funding | Dev checkout simulation, payment webhook signature validation, tax invoice generation, double-entry escrow credit of 6,930,000 paise, trial balance zero check | **PASSED** |
| **Step 5** | Driver Registration & KYC | 4 distinct drivers registered, profile updates, vehicle registrations (unique random alphanumeric plates), document uploads (DL, RC, Rickshaw photo), consent checkboxes, admin verification | **PASSED** |
| **Step 6** | Reservation & Installation | Drivers reserve campaign slots, download poster buffer & verify SHA-256 and dimensions, negative proofs rejected (mock location, out-of-zone geofence), valid installation approved, printing allowance credited (15,000 paise per driver) | **PASSED** |
| **Step 7** | Daily Proofs & Fraud Protection | Simulated clock advanced +5 days to campaign start date, running assignments activated, clean photo auto-verified, duplicate photo rejected with 400, company flags photo, driver dispute upheld, moderator claims & approves flagged photo | **PASSED** |
| **Step 8** | Company Progress & Privacy | Company dashboard metrics, gallery photo PII masking (driver phone and unmasked name withheld), CSV export generation | **PASSED** |
| **Step 9** | Completion & Settlements | Simulated clock advanced +35 days past end date, auth tokens refreshed, `daily-day-roll` rolls pending days to `MISSED`, `assignment-complete` finalizes 4 assignments to `COMPLETED`, `settlement-trigger` generates 4 settlements (handling 30, 27, 24, 15 payable day logic & anomaly holds), finance admin approves all settlements, assignments updated to `PAID` | **PASSED** |
| **Step 10** | Wallet Payouts & Reconciliation | Driver wallet balance verified, withdrawal request submitted, dev payout auto-completion / manual batch export & CSV import with bank UTR reconciliation (`UTR-FULL-998877`), trial balance zero check | **PASSED** |
| **Step 11** | Close-Out & Zero Escrow | Unfilled slot sweep and remaining escrow swept to company refund, final escrow strictly 0 paise, trial balance zero check | **PASSED** |
| **Step 12** | Audit Logs & Final Invariant Gate | Structured audit log entries verified for all mutating actors, trial balance diff confirmed strictly 0 paise | **PASSED** |

---

## 3. Financial Settlement & Ledger Verification

### 3.1 Campaign Budget & Escrow Ledger Invariant
* **Total Charged**: 6,930,000 paise
  * Net Rent Commitment: 5,000,000 paise (50 slots × 100,000 paise)
  * Printing Allowance Commitment: 750,000 paise (50 slots × 15,000 paise)
  * Platform Fee / Commission: 1,000,000 paise
  * GST (18% on Commission): 180,000 paise
* **Recipe 1 (Payment & Escrow)**:
  * DR `GATEWAY_CLEARING` 6,930,000 paise
  * CR `CAMPAIGN_ESCROW` 6,930,000 paise
* **Recipe 2 (Printing Allowance)**:
  * DR `CAMPAIGN_ESCROW` 15,000 paise per driver
  * CR `DRIVER_WALLET` 15,000 paise per driver
* **Recipe 3 (Assignment Settlement)**:
  * Correct per-slot deduction from escrow across rent, platform fee, and GST.
* **Recipe 6 (Closeout Sweep)**:
  * Remaining unallocated escrow swept back to `COMPANY_REFUND`.
  * Escrow account balance after closeout: strictly **0 paise**.
* **Trial Balance**: Invariant $\sum \text{Debits} - \sum \text{Credits} = 0\text{ paise}$ satisfied after every monetary step.

---

## 4. Key Defects Identified & Resolved during Part A

1. **BUG-030: S3 File Presign MimeType and Direct Upload**: Added explicit PNG mimeType and client PUT to Supabase S3 before upload confirmation.
2. **BUG-031: Unhandled ZodErrors in Express Controllers**: Wrapped controller methods in `company.controller.ts` and `driver.controller.ts` in `try / catch` calling `next(err)`.
3. **BUG-032: Unique Constraint on GSTIN and Vehicle Numbers**: Replaced fixed strings with randomized alphanumeric generators avoiding conflicts across sequential runs.
4. **BUG-033: Campaign Review Claim Requirement**: Enforced that reviewer must claim campaign before posting review decision.
5. **BUG-034: Installation Proof Geofence & Mock Location Enforcement**: Updated `checks-runner.ts` and `assignments.service.ts` to validate zone bounding boxes and mock location flags on installation submissions.
6. **BUG-035: SystemClock Delegation to AppClock**: Aligned `SystemClock.now()` with `appClock.now()` to ensure simulated clock offset travels across all services.
7. **BUG-036: Ledger Idempotency Race Condition on Retries**: Wrapped `tx.ledgerTransaction.create` with P2002 catch returning existing transaction.
8. **BUG-037: Nested Transaction Deadlock in LedgerService**: Removed redundant `$transaction` invocation when already executing within an interactive transaction client.
9. **BUG-038: Auth Token Expiry on Virtual Clock Jump**: Added `refreshTokens` helper to re-authenticate staff and users under the advanced virtual clock time.

---

## 5. Conclusion

Milestone **AG-6 Part A** is complete with two consecutive 100% passing runs of the 12-step end-to-end business lifecycle test suite. The implementation is verified robust, compliant with all double-entry accounting invariants, and ready for Part B/C public schema walkthrough execution.
