const nodemailer = require('nodemailer');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [new winston.transports.Console()],
});

let transporter = null;

async function initTransport() {
  const host = process.env.SMTP_HOST || 'mailhog';
  const port = parseInt(process.env.SMTP_PORT || '1025', 10);
  const secure = process.env.SMTP_SECURE === 'true';

  const config = {
    host,
    port,
    secure,
    ignoreTLS: true,
  };

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    config.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  transporter = nodemailer.createTransport(config);
  logger.info(`📧 Email transport configured with SMTP ${host}:${port}`);
}

function getEventTemplate(payload) {
  const event = payload.event || (payload.newStatus ? 'parcel.status_changed' : 'parcel.created');
  const status = payload.newStatus || 'CREATED';

  if (event === 'parcel.created') {
    return {
      subject: `✅ Parcel Booked Successfully - ${payload.trackingNumber || ''}`,
      title: 'Your Delivery Order is Confirmed!',
      description: 'Your parcel request has been received and scheduled for courier collection.',
      badgeText: 'ORDER CONFIRMED',
      badgeColor: '#10B981',
    };
  }

  if (event === 'parcel.assigned') {
    return {
      subject: `📦 Courier Assigned - ${payload.trackingNumber || ''}`,
      title: 'Courier Assigned for Pickup',
      description: payload.courierName
        ? `Courier ${payload.courierName} has been assigned to collect your parcel.`
        : 'A dedicated courier has been assigned to pick up your parcel.',
      badgeText: 'COURIER ASSIGNED',
      badgeColor: '#F59E0B',
    };
  }

  // Parcel status transitions
  const statusMap = {
    CREATED: {
      subject: `✅ Order Confirmed - ${payload.trackingNumber || ''}`,
      title: 'Parcel Delivery Booked',
      description: 'Your package is booked and awaiting courier dispatch.',
      badgeText: 'CREATED',
      badgeColor: '#10B981',
    },
    PENDING_PICKUP: {
      subject: `📦 Ready for Pickup - ${payload.trackingNumber || ''}`,
      title: 'Awaiting Courier Collection',
      description: 'Our courier will be arriving at the pickup address shortly.',
      badgeText: 'PENDING PICKUP',
      badgeColor: '#F59E0B',
    },
    PICKED_UP: {
      subject: `🚚 Parcel Picked Up - ${payload.trackingNumber || ''}`,
      title: 'Package Collected by Courier',
      description: 'Your parcel has been verified and securely collected by our courier.',
      badgeText: 'PICKED UP',
      badgeColor: '#3B82F6',
    },
    IN_TRANSIT: {
      subject: `🛣️ In Transit to Hub - ${payload.trackingNumber || ''}`,
      title: 'Package In Transit',
      description: 'Your parcel is traveling through the distribution logistics network.',
      badgeText: 'IN TRANSIT',
      badgeColor: '#8B5CF6',
    },
    OUT_FOR_DELIVERY: {
      subject: `🏃 Out for Delivery Today! - ${payload.trackingNumber || ''}`,
      title: 'Your Package is Arriving Today',
      description: 'Our courier is out on route and will deliver your package today.',
      badgeText: 'OUT FOR DELIVERY',
      badgeColor: '#F97316',
    },
    DELIVERED: {
      subject: `🎉 Delivered Successfully! - ${payload.trackingNumber || ''}`,
      title: 'Package Delivered',
      description: 'Your parcel has been delivered successfully. Thank you for using SwiftDrop!',
      badgeText: 'DELIVERED',
      badgeColor: '#10B981',
    },
    FAILED: {
      subject: `⚠️ Delivery Attempt Notice - ${payload.trackingNumber || ''}`,
      title: 'Delivery Unsuccessful',
      description: 'We were unable to complete delivery. Our support team will assist you with rescheduling.',
      badgeText: 'DELIVERY FAILED',
      badgeColor: '#EF4444',
    },
    CANCELLED: {
      subject: `❌ Delivery Cancelled - ${payload.trackingNumber || ''}`,
      title: 'Parcel Delivery Cancelled',
      description: 'This delivery request has been cancelled.',
      badgeText: 'CANCELLED',
      badgeColor: '#6B7280',
    },
  };

  return statusMap[status] || {
    subject: `📦 Parcel Update - ${payload.trackingNumber || ''}`,
    title: 'Parcel Status Update',
    description: `Your parcel status has been updated to ${status}.`,
    badgeText: status,
    badgeColor: '#6B7280',
  };
}

function buildHtmlTemplate(payload) {
  const { trackingNumber, recipientName, note, failureReason, proofImageUrl, pickupCity, dropoffCity, weightKg } = payload;
  const template = getEventTemplate(payload);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const trackingLink = `${frontendUrl}/track/${encodeURIComponent(trackingNumber || '')}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${template.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 15px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#0E131F;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#FFFFFF;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
                <span style="color:#F95716;">→</span> SwiftDrop
              </h1>
              <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;letter-spacing:0.5px;">SMART ISLAND-WIDE LOGISTICS</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <div style="display:inline-block;padding:6px 14px;background-color:${template.badgeColor}15;border:1.5px solid ${template.badgeColor};border-radius:999px;font-size:12px;font-weight:700;color:${template.badgeColor};text-transform:uppercase;letter-spacing:0.5px;">
                ${template.badgeText}
              </div>

              <h2 style="margin:18px 0 10px;font-size:22px;color:#0F172A;font-weight:700;">
                ${template.title}
              </h2>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
                Hello <strong>${recipientName || 'Valued Customer'}</strong>,<br/>
                ${template.description}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;margin:24px 0;padding:16px 20px;">
                <tr>
                  <td style="padding:6px 0;color:#64748B;font-size:13px;">Tracking Number</td>
                  <td align="right" style="padding:6px 0;color:#0F172A;font-weight:700;font-family:monospace;font-size:14px;">${trackingNumber || 'N/A'}</td>
                </tr>
                ${pickupCity && dropoffCity ? `
                <tr>
                  <td style="padding:6px 0;color:#64748B;font-size:13px;">Route</td>
                  <td align="right" style="padding:6px 0;color:#0F172A;font-size:13px;">${pickupCity} → ${dropoffCity}</td>
                </tr>` : ''}
                ${weightKg ? `
                <tr>
                  <td style="padding:6px 0;color:#64748B;font-size:13px;">Weight</td>
                  <td align="right" style="padding:6px 0;color:#0F172A;font-size:13px;">${weightKg} kg</td>
                </tr>` : ''}
                ${note ? `
                <tr>
                  <td style="padding:6px 0;color:#64748B;font-size:13px;">Note / Instruction</td>
                  <td align="right" style="padding:6px 0;color:#0F172A;font-size:13px;">${note}</td>
                </tr>` : ''}
                ${failureReason ? `
                <tr>
                  <td style="padding:6px 0;color:#EF4444;font-size:13px;font-weight:600;">Failure Reason</td>
                  <td align="right" style="padding:6px 0;color:#EF4444;font-weight:600;font-size:13px;">${failureReason}</td>
                </tr>` : ''}
              </table>

              ${proofImageUrl ? `
              <div style="margin:20px 0;padding:16px;background:#F1F5F9;border-radius:12px;text-align:center;">
                <p style="margin:0 0 10px;font-size:12px;color:#475569;font-weight:600;text-transform:uppercase;">Delivery Proof Captured</p>
                <img src="${proofImageUrl}" alt="Delivery Proof" style="max-width:100%;max-height:240px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" />
              </div>
              ` : ''}

              <div style="margin:30px 0 10px;text-align:center;">
                <a href="${trackingLink}" style="display:inline-block;padding:14px 32px;background:#F95716;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;box-shadow:0 4px 14px rgba(249,87,22,0.3);">
                  View Live Tracking →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                © ${new Date().getFullYear()} SwiftDrop Logistics System. Automated message, do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendEmailNotification(payload) {
  if (!transporter) throw new Error('Email transport not initialized');

  const recipientEmail = payload.recipientEmail;
  if (!recipientEmail || !recipientEmail.includes('@')) {
    logger.warn(`No valid recipient email provided for parcel ${payload.trackingNumber}. Skipping email dispatch.`);
    return null;
  }

  const template = getEventTemplate(payload);
  const html = buildHtmlTemplate(payload);

  const info = await transporter.sendMail({
    from: `"SwiftDrop Logistics" <${process.env.EMAIL_FROM || 'notifications@swiftdrop.lk'}>`,
    to: recipientEmail,
    subject: template.subject,
    html,
  });

  logger.info(`✉️ Email successfully delivered to [${recipientEmail}] for tracking# [${payload.trackingNumber || 'N/A'}] Subject: "${template.subject}"`);
  return info;
}

module.exports = { initTransport, sendEmailNotification };
