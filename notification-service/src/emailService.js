const nodemailer = require('nodemailer');
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.simple()),
  transports: [new transports.Console()],
});

let transporter = null;

// Initialize Nodemailer with Ethereal (dev) or SMTP (production)
async function initTransport() {
  if (process.env.SMTP_HOST) {
    // Use configured SMTP
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    logger.info(`📧 Email configured with SMTP: ${process.env.SMTP_HOST}`);
  } else {
    // Auto-create Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info(`📧 Email configured with Ethereal test account: ${testAccount.user}`);
    logger.info(`📬 View emails at: https://ethereal.email`);
  }
}

// Status-specific email templates
function getEmailTemplate(event, data) {
  const statusMessages = {
    'parcel.created': {
      subject: `✅ Parcel Booked - ${data.trackingNumber}`,
      title: 'Your Parcel Has Been Booked!',
      body: `Great news! Your parcel has been successfully booked with SwiftDrop.`,
      color: '#10B981',
    },
    'parcel.status_changed': {
      PENDING_PICKUP: {
        subject: `📦 Courier Assigned - ${data.trackingNumber}`,
        title: 'Courier Assigned to Your Parcel',
        body: `A courier has been assigned to collect your parcel.`,
        color: '#F59E0B',
      },
      PICKED_UP: {
        subject: `🚚 Parcel Picked Up - ${data.trackingNumber}`,
        title: 'Your Parcel Has Been Picked Up',
        body: `Your parcel has been collected and is now with our courier.`,
        color: '#3B82F6',
      },
      IN_TRANSIT: {
        subject: `🛣️ In Transit - ${data.trackingNumber}`,
        title: 'Your Parcel is On Its Way',
        body: `Your parcel is in transit and heading to its destination.`,
        color: '#8B5CF6',
      },
      OUT_FOR_DELIVERY: {
        subject: `🏃 Out for Delivery - ${data.trackingNumber}`,
        title: 'Your Parcel is Out for Delivery!',
        body: `Your parcel is out for delivery and will arrive today.`,
        color: '#F97316',
      },
      DELIVERED: {
        subject: `🎉 Delivered! - ${data.trackingNumber}`,
        title: 'Parcel Successfully Delivered',
        body: `Your parcel has been delivered successfully. Thank you for using SwiftDrop!`,
        color: '#10B981',
      },
      FAILED: {
        subject: `⚠️ Delivery Attempt Failed - ${data.trackingNumber}`,
        title: 'Delivery Attempt Failed',
        body: `We were unable to deliver your parcel. Our team will contact you to reschedule.`,
        color: '#EF4444',
      },
    },
  };

  if (event === 'parcel.created') return statusMessages['parcel.created'];
  if (event === 'parcel.status_changed' && data.newStatus) {
    return statusMessages['parcel.status_changed'][data.newStatus] || {
      subject: `Update on ${data.trackingNumber}`,
      title: 'Parcel Status Updated',
      body: `Your parcel status has been updated to: ${data.newStatus}`,
      color: '#6B7280',
    };
  }
  return null;
}

function buildHtmlEmail(template, data) {
  const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/track/${data.trackingNumber}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a56db,#7C3AED);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">⚡ SwiftDrop</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Island-wide Courier Services</p>
        </td></tr>
        <!-- Status badge -->
        <tr><td style="padding:32px 40px 0;text-align:center;">
          <div style="display:inline-block;background:${template.color}15;border:2px solid ${template.color};border-radius:50px;padding:8px 24px;">
            <span style="color:${template.color};font-weight:700;font-size:14px;">${data.newStatus || 'CREATED'}</span>
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 40px;">
          <h2 style="margin:0 0 12px;color:#1a202c;font-size:22px;">${template.title}</h2>
          <p style="margin:0 0 24px;color:#4a5568;font-size:16px;line-height:1.6;">${template.body}</p>
          <!-- Info box -->
          <div style="background:#f8fafc;border-left:4px solid ${template.color};border-radius:0 8px 8px 0;padding:20px;margin:0 0 24px;">
            <table width="100%">
              <tr>
                <td style="color:#6b7280;font-size:13px;padding-bottom:8px;">Tracking Number</td>
                <td align="right" style="color:#1a202c;font-weight:700;font-size:15px;font-family:monospace;">${data.trackingNumber}</td>
              </tr>
              ${data.note ? `<tr><td style="color:#6b7280;font-size:13px;padding-bottom:8px;">Note</td><td align="right" style="color:#4a5568;font-size:14px;">${data.note}</td></tr>` : ''}
              <tr>
                <td style="color:#6b7280;font-size:13px;">Updated</td>
                <td align="right" style="color:#4a5568;font-size:13px;">${new Date(data.timestamp || Date.now()).toLocaleString()}</td>
              </tr>
            </table>
          </div>
          <!-- Track Button -->
          <div style="text-align:center;">
            <a href="${trackingUrl}" style="display:inline-block;background:linear-gradient(135deg,#1a56db,#7C3AED);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:16px;">Track Your Parcel →</a>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#a0aec0;font-size:12px;">© ${new Date().getFullYear()} SwiftDrop Courier Services. All rights reserved.</p>
          <p style="margin:4px 0 0;color:#a0aec0;font-size:12px;">This is an automated message, please do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendStatusEmail(payload) {
  if (!transporter) throw new Error('Email transport not initialized');

  const template = getEmailTemplate(payload.event, payload);
  if (!template) {
    logger.info(`No email template for event: ${payload.event}`);
    return;
  }

  const recipientEmail = payload.customerEmail;
  if (!recipientEmail) {
    logger.warn(`No customer email for parcel ${payload.trackingNumber}`);
    return;
  }

  const htmlContent = buildHtmlEmail(template, payload);

  const info = await transporter.sendMail({
    from: `"SwiftDrop" <${process.env.EMAIL_FROM || 'noreply@swiftdrop.lk'}>`,
    to: recipientEmail,
    subject: template.subject,
    html: htmlContent,
  });

  logger.info(`📧 Email sent to ${recipientEmail} | MessageId: ${info.messageId}`);

  // Log Ethereal preview URL
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info(`📬 Preview: ${previewUrl}`);
  }

  return info;
}

module.exports = { initTransport, sendStatusEmail };
