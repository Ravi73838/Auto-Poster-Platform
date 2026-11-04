export interface EmailRenderResult {
  subject: string;
  html: string;
}

export function renderBaseTemplate(options: {
  title: string;
  preheader?: string;
  heading: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const { title, preheader = '', heading, bodyHtml, ctaText, ctaUrl } = options;

  const ctaButtonHtml = ctaText && ctaUrl
    ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
        <tr>
          <td align="center" style="border-radius: 6px; background-color: #2563eb;">
            <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 6px;">
              ${ctaText}
            </a>
          </td>
        </tr>
      </table>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background-color: #1e293b; padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .content { padding: 32px 24px; color: #334155; line-height: 1.6; font-size: 15px; }
    .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;">
    <tr>
      <td align="center">
        <div class="container">
          <div class="header">
            <h1>Auto Poster Advertising Platform</h1>
          </div>
          <div class="content">
            <h2 style="margin-top: 0; color: #0f172a; font-size: 18px; font-weight: 600;">${heading}</h2>
            ${bodyHtml}
            ${ctaButtonHtml}
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px 0;">This is an automated notification from Auto Poster.</p>
            <p style="margin: 0;">Manage your notifications and preferences in your <a href="https://autoposter.local/settings">account settings</a>.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailTemplate(
  templateKey: string,
  params: Record<string, unknown>,
): EmailRenderResult {
  switch (templateKey) {
    case 'kyc-approved':
      return {
        subject: 'Your KYC Verification is Approved',
        html: renderBaseTemplate({
          title: 'KYC Approved',
          heading: 'Account Verified Successfully',
          bodyHtml: '<p>Congratulations! Your business documentation has been reviewed and approved. You can now create campaigns and access all platform features.</p>',
          ctaText: 'Go to Dashboard',
          ctaUrl: 'https://autoposter.local/dashboard',
        }),
      };

    case 'kyc-rejected':
      return {
        subject: 'Update Regarding Your KYC Verification',
        html: renderBaseTemplate({
          title: 'KYC Verification Rejected',
          heading: 'Verification Needs Attention',
          bodyHtml: `<p>We were unable to verify your submitted documents for the following reason:</p>
                     <blockquote style="border-left: 3px solid #ef4444; margin: 12px 0; padding-left: 12px; color: #b91c1c;">
                       ${String(params.reason ?? 'Document requirements not met.')}
                     </blockquote>
                     <p>Please update your documents to proceed.</p>`,
          ctaText: 'Update Verification',
          ctaUrl: 'https://autoposter.local/kyc',
        }),
      };

    case 'campaign-approved':
      return {
        subject: `Campaign Approved: ${String(params.title ?? 'Your Campaign')}`,
        html: renderBaseTemplate({
          title: 'Campaign Approved',
          heading: 'Your Campaign is Ready to Fund',
          bodyHtml: `<p>Great news! Campaign <strong>${String(params.title ?? '')}</strong> has been approved by moderators.</p>
                     <p>Please complete payment to lock your reservation and make the campaign live for drivers.</p>`,
          ctaText: 'Complete Payment',
          ctaUrl: `https://autoposter.local/campaigns/${String(params.campaignId ?? '')}/checkout`,
        }),
      };

    case 'campaign-rejected':
      return {
        subject: `Campaign Needs Changes: ${String(params.title ?? 'Your Campaign')}`,
        html: renderBaseTemplate({
          title: 'Campaign Rejected',
          heading: 'Campaign Revision Required',
          bodyHtml: `<p>Your campaign <strong>${String(params.title ?? '')}</strong> could not be approved:</p>
                     <blockquote style="border-left: 3px solid #ef4444; margin: 12px 0; padding-left: 12px; color: #b91c1c;">
                       ${String(params.reason ?? 'Creative does not meet guidelines.')}
                     </blockquote>`,
          ctaText: 'Review Campaign',
          ctaUrl: `https://autoposter.local/campaigns/${String(params.campaignId ?? '')}`,
        }),
      };

    case 'campaign-payment-due':
      return {
        subject: `Payment Reminder: ${String(params.title ?? 'Campaign Payment')}`,
        html: renderBaseTemplate({
          title: 'Payment Reminder',
          heading: 'Complete Your Campaign Payment',
          bodyHtml: `<p>Payment for campaign <strong>${String(params.title ?? '')}</strong> is pending.</p>
                     <p>Unfunded campaigns expire automatically. Please complete payment to launch.</p>`,
          ctaText: 'Pay Now',
          ctaUrl: `https://autoposter.local/campaigns/${String(params.campaignId ?? '')}/checkout`,
        }),
      };

    case 'campaign-paid':
      return {
        subject: `Payment Confirmed: ${String(params.title ?? 'Campaign')}`,
        html: renderBaseTemplate({
          title: 'Payment Received',
          heading: 'Payment Successfully Processed',
          bodyHtml: `<p>We received payment for campaign <strong>${String(params.title ?? '')}</strong>.</p>
                     <p>Your escrow balance is held safely and driver slot reservation has commenced.</p>`,
          ctaText: 'View Campaign',
          ctaUrl: `https://autoposter.local/campaigns/${String(params.campaignId ?? '')}`,
        }),
      };

    case 'campaign-live':
      return {
        subject: `Campaign is Live: ${String(params.title ?? 'Campaign')}`,
        html: renderBaseTemplate({
          title: 'Campaign Live',
          heading: 'Campaign is Active and Open',
          bodyHtml: `<p>Your campaign <strong>${String(params.title ?? '')}</strong> is now live!</p>
                     <p>Eligible auto-rickshaw drivers can now browse and reserve slots for your advertisement.</p>`,
          ctaText: 'Track Campaign',
          ctaUrl: `https://autoposter.local/campaigns/${String(params.campaignId ?? '')}`,
        }),
      };

    case 'campaign-cancelled':
      return {
        subject: `Campaign Cancelled: ${String(params.title ?? 'Campaign')}`,
        html: renderBaseTemplate({
          title: 'Campaign Cancelled',
          heading: 'Campaign Cancelled Notice',
          bodyHtml: `<p>Campaign <strong>${String(params.title ?? '')}</strong> has been cancelled.</p>
                     <p>Reason: ${String(params.reason ?? 'Cancelled by company or platform.')}</p>`,
          ctaText: 'View Details',
          ctaUrl: `https://autoposter.local/campaigns/${String(params.campaignId ?? '')}`,
        }),
      };

    case 'payment-captured':
      return {
        subject: `Receipt: Payment of ₹${String(params.amount ?? '')}`,
        html: renderBaseTemplate({
          title: 'Payment Receipt',
          heading: 'Payment Confirmation',
          bodyHtml: `<p>We received your payment of <strong>₹${String(params.amount ?? '')}</strong> for campaign <strong>${String(params.title ?? '')}</strong>.</p>
                     <p>A GST-compliant tax invoice will be available in your billing portal.</p>`,
          ctaText: 'View Payments',
          ctaUrl: 'https://autoposter.local/payments',
        }),
      };

    case 'refund-processed':
      return {
        subject: `Refund Processed: ₹${String(params.amount ?? '')}`,
        html: renderBaseTemplate({
          title: 'Refund Processed',
          heading: 'Refund Completed',
          bodyHtml: `<p>A refund of <strong>₹${String(params.amount ?? '')}</strong> has been initiated back to your original payment method.</p>
                     <p>It typically reflects in your bank account in 3-5 business days.</p>`,
          ctaText: 'View Transactions',
          ctaUrl: 'https://autoposter.local/payments',
        }),
      };

    case 'dispute-opened':
      return {
        subject: `Dispute #${String(params.disputeId ?? '')} Opened`,
        html: renderBaseTemplate({
          title: 'Dispute Opened',
          heading: `Dispute Case #${String(params.disputeId ?? '')}`,
          bodyHtml: `<p>A dispute has been submitted regarding ${String(params.reason ?? 'a recent event')}.</p>
                     <p>Our resolution team reviews all cases within 3 business days.</p>`,
          ctaText: 'View Dispute',
          ctaUrl: `https://autoposter.local/disputes/${String(params.disputeId ?? '')}`,
        }),
      };

    case 'dispute-decision':
      return {
        subject: `Dispute #${String(params.disputeId ?? '')} Resolved`,
        html: renderBaseTemplate({
          title: 'Dispute Decision',
          heading: `Resolution for Dispute #${String(params.disputeId ?? '')}`,
          bodyHtml: `<p>A decision has been reached regarding Dispute #${String(params.disputeId ?? '')}:</p>
                     <blockquote style="border-left: 3px solid #2563eb; margin: 12px 0; padding-left: 12px; color: #1e3a8a;">
                       ${String(params.decision ?? 'Review completed.')}
                     </blockquote>`,
          ctaText: 'View Resolution Details',
          ctaUrl: `https://autoposter.local/disputes/${String(params.disputeId ?? '')}`,
        }),
      };

    case 'dispute-escalated':
      return {
        subject: `[URGENT SLA] Dispute #${String(params.disputeId ?? '')} Breached SLA`,
        html: renderBaseTemplate({
          title: 'Dispute SLA Escalation',
          heading: `SLA Alert: Dispute #${String(params.disputeId ?? '')}`,
          bodyHtml: `<p>Dispute #${String(params.disputeId ?? '')} has reached or breached its resolution deadline (${String(params.slaDeadline ?? '')}).</p>
                     <p>Super Admin review is requested immediately.</p>`,
          ctaText: 'Open Admin Workspace',
          ctaUrl: `https://autoposter.local/admin/disputes/${String(params.disputeId ?? '')}`,
        }),
      };

    case 'reconciliation-alert':
      return {
        subject: '[ALERT] Financial Reconciliation Discrepancy',
        html: renderBaseTemplate({
          title: 'Reconciliation Alert',
          heading: 'Reconciliation Discrepancy Detected',
          bodyHtml: `<p>The daily automated reconciliation job detected an imbalance or unverified discrepancy.</p>
                     <p>Please inspect the finance reconciliation dashboard immediately.</p>`,
          ctaText: 'Open Reconciliation',
          ctaUrl: 'https://autoposter.local/finance/reconciliation',
        }),
      };

    case 'admin-digest':
      return {
        subject: 'Auto Poster Daily Platform Digest',
        html: renderBaseTemplate({
          title: 'Daily Digest',
          heading: 'Daily Operations & Finance Digest',
          bodyHtml: `<p>Summary of queues and metrics as of today:</p>
                     <p>${String(params.summary ?? 'All queues within normal thresholds.')}</p>`,
          ctaText: 'Open Admin Dashboard',
          ctaUrl: 'https://autoposter.local/admin/dashboard',
        }),
      };

    default:
      return {
        subject: String(params.title ?? 'Notification from Auto Poster'),
        html: renderBaseTemplate({
          title: String(params.title ?? 'Auto Poster Notification'),
          heading: String(params.title ?? 'Notification'),
          bodyHtml: `<p>${String(params.body ?? '')}</p>`,
          ctaText: params.deepLink ? 'Open Link' : undefined,
          ctaUrl: params.deepLink ? `https://autoposter.local${String(params.deepLink)}` : undefined,
        }),
      };
  }
}

