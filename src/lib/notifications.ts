import "server-only";

interface PaymentSubmissionNotificationData {
  shopName: string;
  shopSlug: string;
  merchantEmail: string;
  merchantPhone?: string | null;
  utr: string;
  amount: number;
  screenshotPath?: string | null;
  notes?: string | null;
  requestId: string;
}

/**
 * Notifies the platform administrator when a merchant submits a manual UPI payment.
 * Delivers via:
 * 1. Resend REST API (if RESEND_API_KEY is configured).
 * 2. Webhook (if ADMIN_NOTIFICATION_WEBHOOK is configured).
 * 3. Structured server log.
 *
 * Designed to be non-blocking and fail-safe: failures are logged and never abort the transaction.
 */
export async function notifyAdminOfPaymentSubmission(data: PaymentSubmissionNotificationData): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "zamzanjr10@gmail.com";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://sweetly.vercel.app").replace(/\/+$/, "");
  const adminUrl = `${siteUrl}/admin/subscriptions`;
  const formattedTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const screenshotUrl = data.screenshotPath && supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/shop-assets/${data.screenshotPath.replace(/^\/+/, "")}`
    : null;

  console.log(`[PAYMENT NOTIFICATION] New UPI submission for shop "${data.shopName}" (UTR: ${data.utr}, Amount: ₹${data.amount})`);

  // 1. Send Email via Resend if RESEND_API_KEY is set
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "Sweetly Alerts <onboarding@resend.dev>";
      const subject = `🔔 New UPI Payment (₹${data.amount}) from ${data.shopName} [UTR: ${data.utr}]`;

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fcf9f6; margin: 0; padding: 24px; color: #2d1810; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #ebdcd5; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
    .header { background: #b84c30; padding: 24px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 24px; }
    .alert-pill { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; background: #f8f3ef; color: #78350f; font-weight: 600; border-bottom: 1px solid #ebdcd5; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0e6e0; color: #431407; }
    .utr-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; font-weight: 700; background: #fef2f2; color: #991b1b; padding: 3px 8px; border-radius: 6px; display: inline-block; }
    .btn { display: inline-block; background: #b84c30; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #faf6f3; border-top: 1px solid #ebdcd5; font-size: 11px; color: #9c6c59; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>New Subscription Payment Received</h1>
      <p>A shop owner has submitted UPI payment verification for Sweetly Pro.</p>
    </div>
    <div class="content">
      <span class="alert-pill">⏳ Action Required: Review &amp; Approve</span>
      <p style="font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
        <strong>${data.shopName}</strong> transferred <strong>₹${data.amount}.00</strong> via UPI to activate Sweetly Pro (30 Days).
      </p>

      <table>
        <tr>
          <th>Field</th>
          <th>Details</th>
        </tr>
        <tr>
          <td><strong>Shop Name</strong></td>
          <td>${data.shopName} (<code>/${data.shopSlug}</code>)</td>
        </tr>
        <tr>
          <td><strong>Merchant Email</strong></td>
          <td>${data.merchantEmail}</td>
        </tr>
        <tr>
          <td><strong>Merchant Phone</strong></td>
          <td>${data.merchantPhone || "Not provided"}</td>
        </tr>
        <tr>
          <td><strong>Submitted UTR / Ref</strong></td>
          <td><span class="utr-code">${data.utr}</span></td>
        </tr>
        <tr>
          <td><strong>Amount</strong></td>
          <td><strong>₹${data.amount}.00 INR</strong></td>
        </tr>
        <tr>
          <td><strong>Submitted Time</strong></td>
          <td>${formattedTime} IST</td>
        </tr>
        ${data.notes ? `<tr><td><strong>Merchant Notes</strong></td><td>${data.notes}</td></tr>` : ""}
        ${screenshotUrl ? `<tr><td><strong>Receipt Screenshot</strong></td><td><a href="${screenshotUrl}" target="_blank" style="color: #b84c30; font-weight: 600;">View Receipt Image ↗</a></td></tr>` : ""}
      </table>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${adminUrl}" class="btn">Open Admin Console to Approve ↗</a>
      </div>
    </div>
    <div class="footer">
      Sweetly Platform Automation • Sent to ${adminEmail}
    </div>
  </div>
</body>
</html>
      `;

      const textBody = `
New UPI Subscription Payment Received!
======================================
Shop: ${data.shopName} (/${data.shopSlug})
Merchant: ${data.merchantEmail} (Phone: ${data.merchantPhone || "N/A"})
Amount: ₹${data.amount}.00 INR
UTR / Transaction ID: ${data.utr}
Time: ${formattedTime} IST
Notes: ${data.notes || "None"}
${screenshotUrl ? `Screenshot: ${screenshotUrl}\n` : ""}
Approve in Admin Console: ${adminUrl}
      `.trim();

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [adminEmail],
          subject,
          html: htmlBody,
          text: textBody,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Resend notification error:", response.status, errText);
      } else {
        const resData = await response.json();
        console.log("Resend notification sent successfully. Email ID:", resData.id);
      }
    } catch (err) {
      console.error("Failed to send Resend email alert:", err);
    }
  } else {
    console.log(
      "[PAYMENT NOTIFICATION] RESEND_API_KEY is not configured. Set RESEND_API_KEY in environment variables to deliver instant email alerts to " +
        adminEmail
    );
  }

  // 2. Send Webhook (Discord / Slack / Telegram / n8n) if ADMIN_NOTIFICATION_WEBHOOK is set
  const webhookUrl = process.env.ADMIN_NOTIFICATION_WEBHOOK;
  if (webhookUrl) {
    try {
      const webhookPayload = {
        content: `🔔 **New UPI Subscription Payment Submitted!**\n• **Shop**: ${data.shopName} (/${data.shopSlug})\n• **Amount**: ₹${data.amount}\n• **UTR**: \`${data.utr}\`\n• **Email**: ${data.merchantEmail}\n• **Time**: ${formattedTime} IST\n• **Action**: Review at ${adminUrl}`,
      };

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });
    } catch (err) {
      console.error("Failed to send webhook notification:", err);
    }
  }
}
