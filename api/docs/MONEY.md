# Auto Poster Platform - Financial Ledger & Money Architecture (Phase 8)

## 1. Principles & Financial Invariants

Money moves in real businesses with real liability. In the Auto Poster Advertising Platform, the money model follows strict financial accounting standards:

1. **Double-Entry Bookkeeping**: Every financial event creates a `LedgerTransaction` containing at least two balanced `LedgerEntry` items where the total debits exactly equal the total credits:
   $$\sum \text{Debits} = \sum \text{Credits}$$
2. **Append-Only Immutability**: Ledger transactions and entries cannot be updated (`UPDATE`) or deleted (`DELETE`). Corrections must be posted as new compensating transactions or adjustments.
3. **Integer Paise Representation**: All currency amounts are strictly non-negative integers represented in paise ($1\text{ INR} = 100\text{ paise}$). BigInt values are used across the database and runtime engine. Decimal floating-point numbers are prohibited in all money calculations.
4. **Conservation of Funds**: Money cannot be created or destroyed. Funds held across bank clearing and gateway accounts always mirror platform escrow, wallet liabilities, and retained revenue.
5. **Non-Overdraft Protection**: Liability accounts (`CAMPAIGN_ESCROW`, `DRIVER_WALLET`, `PAYOUT_IN_TRANSIT`, `COMPANY_REFUND`) are strictly non-overdraft. The ledger transaction engine rejects any debit that would drive their balance below zero.

---

## 2. Chart of Accounts

| Account Code / Template | Account Type | Normal Balance | Classification | Description |
|:---|:---|:---|:---|:---|
| `SYS_GATEWAY_CLEARING` | `GATEWAY_CLEARING` | Debit | Asset | Funds held at the payment gateway (Razorpay / Bank), awaiting net payout settlement. |
| `SYS_GATEWAY_FEES` | `GATEWAY_FEES` | Debit | Expense | Processing fees and MDR charged by payment gateways. |
| `SYS_PLATFORM_REVENUE` | `PLATFORM_REVENUE` | Credit | Income | Commission earned by Auto Poster Platform on campaign execution. |
| `SYS_GST_PAYABLE` | `GST_PAYABLE` | Credit | Liability | Goods & Services Tax collected on platform commissions, payable to the government. |
| `SYS_COMPANY_REFUND` | `COMPANY_REFUND` | Credit | Liability | Platform reserve for refunds due to companies (unfilled slots, cancellations). |
| `SYS_PAYOUT_IN_TRANSIT` | `PAYOUT_IN_TRANSIT` | Credit | Liability | Funds reserved for driver withdrawals currently being processed by banks / RazorpayX. |
| `SYS_ADJUSTMENT` | `ADJUSTMENT` | Either | Equity | System clearing account for audited manual corrections. |
| `CAMPAIGN_ESCROW_{campaignId}` | `CAMPAIGN_ESCROW` | Credit | Liability | Escrow balance held for a specific campaign order. |
| `DRIVER_WALLET_{driverId}` | `DRIVER_WALLET` | Credit | Liability | Driver earnings available for withdrawal. |

---

## 3. The 8 Posting Recipes

All ledger postings are strictly restricted to canonical recipe functions located in `api/src/modules/ledger/recipes/`:

### Recipe 1: Company Payment Captured
- **Trigger**: Payment gateway confirms company deposit for an approved campaign.
- **Idempotency Key**: `pay:{paymentId}`
- **Entries**:
  - `DR GATEWAY_CLEARING`: $T$ (Total charged)
  - `CR CAMPAIGN_ESCROW_{campaignId}`: $T$

### Recipe 2: Installation Approved (Printing Allowance)
- **Trigger**: Platform verifies driver's poster installation photo.
- **Idempotency Key**: `allowance:{assignmentId}`
- **Entries**:
  - `DR CAMPAIGN_ESCROW_{campaignId}`: $P$ (Printing allowance)
  - `CR DRIVER_WALLET_{driverId}`: $P$

### Recipe 3: Assignment Settlement Split
- **Trigger**: Campaign completes or driver's run window ends. Calculates payable rent based on verified days:
  $$R_\text{payable} = \left\lfloor \frac{R \times \text{verifiedDays}}{\text{totalDays}} \right\rfloor$$
  $$\text{Refund to Company} = R - R_\text{payable}$$
- **Idempotency Key**: `settle:{assignmentId}`
- **Entries**:
  - `DR CAMPAIGN_ESCROW_{campaignId}`: $R + C + G$
  - `CR DRIVER_WALLET_{driverId}`: $R_\text{payable}$
  - `CR COMPANY_REFUND`: $R - R_\text{payable}$
  - `CR PLATFORM_REVENUE`: $C$ (Commission)
  - `CR GST_PAYABLE`: $G$ (GST on commission)

### Recipe 4: Company Refund Lifecycle
- **Part 4A: Reserve**:
  - `DR CAMPAIGN_ESCROW_{campaignId}`: $A$
  - `CR COMPANY_REFUND`: $A$
  - Key: `refund_res:{refundId}`
- **Part 4B: Payout**:
  - `DR COMPANY_REFUND`: $A$
  - `CR GATEWAY_CLEARING`: $A$
  - Key: `refund_pay:{refundId}`

### Recipe 5: Driver Wallet Withdrawal Lifecycle
- **Part 5A: Reserve (Driver Requests Withdrawal)**:
  - `DR DRIVER_WALLET_{driverId}`: $W$
  - `CR PAYOUT_IN_TRANSIT`: $W$
  - Key: `payout_res:{payoutId}`
- **Part 5B: Disbursal Complete (Bank Confirms UTR)**:
  - `DR PAYOUT_IN_TRANSIT`: $W$
  - `CR GATEWAY_CLEARING`: $W$
  - Key: `payout_cmp:{payoutId}`
- **Part 5C: Disbursal Reversal (Bank Rejection)**:
  - `DR PAYOUT_IN_TRANSIT`: $W$
  - `CR DRIVER_WALLET_{driverId}`: $W$
  - Key: `payout_rev:{payoutId}`

### Recipe 6: Campaign Closeout Sweep
- **Trigger**: All assignments in campaign are settled, and unfilled slots / unspent funds are returned to company refund reserve.
- **Idempotency Key**: `closeout:{campaignId}`
- **Entries**:
  - `DR CAMPAIGN_ESCROW_{campaignId}`: $\text{Balance}$
  - `CR COMPANY_REFUND`: $\text{Balance}$

### Recipe 7: Payment Gateway Processing Fee
- **Trigger**: Gateway reports transaction fee/MDR.
- **Idempotency Key**: `gwfee:{paymentId}`
- **Entries**:
  - `DR GATEWAY_FEES`: $\text{Fee}$
  - `CR GATEWAY_CLEARING`: $\text{Fee}$

### Recipe 8: Manual Audited Adjustment
- **Trigger**: Dual-maker-checker approved adjustment.
- **Idempotency Key**: `adj:{adjustmentId}`
- **Entries**:
  - `DR/CR Target Account`: $A$
  - `CR/DR SYS_ADJUSTMENT`: $A$

---

## 4. Maker-Checker Dual Control & Safety

To prevent fraud and unauthorized movement of funds:
1. **Maker-Checker Rule**: The administrator who requests a refund or manual adjustment is strictly forbidden from approving or reviewing that same request (`requestedById !== reviewerId`).
2. **Emergency Circuit Breakers**:
   - `finance.payments_enabled`: Immediately halts all incoming deposits when toggled off.
   - `finance.payouts_enabled`: Immediately pauses all outgoing driver payouts and withdrawals.
3. **Daily Automated Reconciliation**:
   - Compares trial balance $\sum \text{Debits} - \sum \text{Credits} = 0$.
   - Audits running balances on all accounts against their sequential ledger entries.
   - Flags anomalies in `ReconciliationRun` records.

---

## 5. Dispute Escrow Holds & Settlement Interlocking (Phase 9)

To ensure that funds are never prematurely disbursed while a conflict is pending:

1. **Automatic Escrow Hold Calculation**:
   - When a dispute is filed against an assignment or campaign, `calculateHoldAmount()` calculates the maximum financial exposure (e.g., $N_{\text{disputed}} \times \text{daily\_rent\_paise}$, or printing allowance $P = 15000\text{ paise}$).
   - The hold is tracked on the dispute record as `heldAmountPaise`.
2. **Settlement Worker Gatekeeper**:
   - `SettlementHoldProvider.hasActiveHold(assignmentId, campaignId)` is called by the daily settlement trigger job.
   - If an active hold is detected (`OPEN` or `CLAIMED` dispute), settlement execution is delayed and locked.
3. **Double-Entry Hold Release**:
   - Upon dispute resolution, held funds are unlocked or routed according to the 12 typed resolution effects (e.g. `PARTIAL_REFUND_COMPANY`, `RELEASE_PAYMENT_DRIVER`, `SPLIT_ADJUSTMENT`).
   - Every movement posts a balanced double-entry transaction, leaving zero dangling liabilities.


