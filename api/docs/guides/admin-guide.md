# Operations Staff Runbook & Admin Guide

Welcome to the **Auto Poster Advertising Platform Operations Runbook**. This guide details day-to-day procedures for platform operators, moderators, and finance team members.

---

## 1. Quick Start & Daily Checklist

Every morning at the start of shift:
1. **Sign In**: Log into \`https://app.autoposter.com/admin\` using your corporate email and credentials.
2. **Review My-Work Inbox**:
   - Navigate to **My Work / Queues** (\`g w\` or via sidebar).
   - Check SLA warnings (items approaching 24h or 48h resolution targets).
3. **Check Daily Photo Flags**:
   - Navigate to **Daily Photo Review** (\`g p\`).
   - Review auto-flagged photos from the previous day's submissions.
4. **Inspect Driver KYC Queue**:
   - Open pending driver verifications. Cross-reference Driving License, RC, and selfie photos.
5. **Campaign Reviews**:
   - Verify submitted creatives against platform content and safety guidelines.
6. **Finance Check (Finance Role)**:
   - Verify inbound Razorpay escrow settlements.
   - Review and trigger morning payout batches.

---

## 2. Driver KYC Verification

### Acceptance Criteria
- **Full Name**: Matches government photo ID and Driving License.
- **Auto RC (Registration Certificate)**: Number plate must match vehicle photographs.
- **Vehicle Type**: Must be standard commercial auto-rickshaw.
- **Bank Account / UPI**: Verified recipient name matches driver's full name.

### Rejection Reason Codes
When rejecting, select the precise code so the mobile app instructs the driver accurately:
- \`DOCUMENT_UNCLEAR\`: Blurry image or glare over text.
- \`DOCUMENT_EXPIRED\`: Driving license or vehicle insurance has lapsed.
- \`NAME_MISMATCH\`: Bank account name differs from driver identity document.
- \`VEHICLE_NUMBER_MISMATCH\`: Number plate in photo does not match RC.

---

## 3. Campaign Creative & Print Review

Advertisers submit creatives in SVG, PDF, or high-resolution PNG format along with printing instructions.

### Review Guidelines
1. **Safety & Policy**: No hate speech, misleading claims, adult content, or prohibited substances.
2. **Dimensions & Margins**: Ensure bleed margins align with rear auto dimensions (min 300 DPI recommended).
3. **Legibility**: Text and QR codes must be sharp and readable at a 5-meter viewing distance.
4. **Approval**: Click **Approve**. The campaign will transition to \`LIVE\` once the escrow payment is confirmed.

---

## 4. Daily Proof Photo Inspection

Drivers must upload at least one valid photo per day between 06:00 and 22:00 IST.

### Verification Criteria
- **Rear of Auto Rickshaw**: Clearly visible in frame.
- **Printed Poster**: Securely affixed, unwrinkled, unpeeled, and matching the campaign creative.
- **Number Plate**: License plate clearly legible in the same photo.
- **Anti-Fraud Integrity**:
  - Live camera submission only (gallery uploads blocked).
  - EXIF timestamp matches upload window.
  - Device GPS matches assigned operational zone.

### Actions
- **Accept**: Marks assignment day as \`VERIFIED\`.
- **Reject**: Marks day as \`MISSED\` with rejection reason code.
- **Flag for Investigation**: Escalates to senior moderator if synthetic / AI-generated photo is suspected.

---

## 5. Dispute Resolution

When an advertiser disputes a driver's performance or a driver contests a penalty:
1. Open the dispute ticket in **Disputes**.
2. Inspect photo proof logs and assignment daily history in the **Driver 360° Drawer**.
3. Exchange messages with both parties via the dispute timeline.
4. Issue final ruling:
   - **UPHELD**: Driver missed days validated; unearned rent credited back to company escrow.
   - **REJECTED**: Advertiser claim unsubstantiated; driver is exonerated and day marked excused.

---

## 6. Financial Payout Processing (Finance Role)

1. Navigate to **Driver Payouts**.
2. Review the aggregated payout batch containing:
   - Printing allowances for verified installations.
   - Daily rental payments for verified active assignments.
3. Validate total batch sum against Available Cash Ledger balances.
4. Click **Authorize Payout Batch**:
   - Complete Step-Up 2FA verification.
   - The platform dispatches IMPS/NEFT instructions to the payment banking partner.

---

## 7. Emergency Procedures

### Enabling Maintenance Mode
If a critical vulnerability or infrastructure incident occurs:
1. Navigate to **System Settings** -> **Platform**.
2. Locate \`platform.maintenance_mode\`.
3. Set value to \`true\` and provide incident ticket justification.
4. Driver mobile apps and advertiser portals will display maintenance notices while operations access remains available.

