const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [new winston.transports.Console()],
});

// In-memory audit store for sent SMS messages
const mockSmsStore = [];

function formatSmsText(payload) {
  const { trackingNumber, newStatus, event, note, failureReason, courierName } = payload;
  const tn = trackingNumber || 'N/A';

  if (event === 'parcel.created') {
    return `[SwiftDrop] Order Confirmed: Parcel ${tn} has been booked. Track live at swiftdrop.lk/track/${tn}`;
  }
  if (event === 'parcel.assigned') {
    return `[SwiftDrop] Courier Assigned: ${courierName || 'Our courier'} has been assigned to collect your parcel ${tn}.`;
  }

  switch (newStatus) {
    case 'PENDING_PICKUP':
      return `[SwiftDrop] Update: Parcel ${tn} is pending collection by courier.${note ? ' Note: ' + note : ''}`;
    case 'PICKED_UP':
      return `[SwiftDrop] Collected: Parcel ${tn} has been picked up and is on its way.${note ? ' Note: ' + note : ''}`;
    case 'IN_TRANSIT':
      return `[SwiftDrop] In Transit: Parcel ${tn} is moving through the distribution hub.${note ? ' Note: ' + note : ''}`;
    case 'OUT_FOR_DELIVERY':
      return `[SwiftDrop] Alert: Parcel ${tn} is OUT FOR DELIVERY! Our courier will arrive today.${note ? ' Note: ' + note : ''}`;
    case 'DELIVERED':
      return `[SwiftDrop] Delivered: Parcel ${tn} has been delivered successfully! Thank you for using SwiftDrop.`;
    case 'FAILED':
      return `[SwiftDrop] Notice: Delivery attempt for ${tn} was unsuccessful. Reason: ${failureReason || 'Customer unavailable'}. We will reschedule.`;
    case 'CANCELLED':
      return `[SwiftDrop] Notice: Delivery order for parcel ${tn} has been cancelled.`;
    default:
      return `[SwiftDrop] Status Update: Parcel ${tn} is now ${newStatus || 'UPDATED'}.${note ? ' Note: ' + note : ''}`;
  }
}

async function sendSmsNotification(payload) {
  const phone = payload.recipientPhone;
  if (!phone || phone.trim().length < 8) {
    logger.warn(`No valid recipient phone provided for parcel ${payload.trackingNumber || 'N/A'}. Skipping SMS dispatch.`);
    return null;
  }

  const messageText = formatSmsText(payload);
  const smsRecord = {
    id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    phone: phone.trim(),
    trackingNumber: payload.trackingNumber || 'N/A',
    event: payload.event || 'parcel.status_changed',
    status: payload.newStatus || 'CREATED',
    body: messageText,
    sentAt: new Date().toISOString(),
    deliveryStatus: 'DELIVERED', // Simulated telco delivery receipt
  };

  mockSmsStore.push(smsRecord);
  if (mockSmsStore.length > 200) mockSmsStore.shift();

  logger.info(`📱 ==================== [MOCK SMS GATEWAY] ====================`);
  logger.info(`📱 TO: ${smsRecord.phone}`);
  logger.info(`📱 EVENT: ${smsRecord.event} | STATUS: ${smsRecord.status}`);
  logger.info(`📱 BODY: ${smsRecord.body}`);
  logger.info(`📱 TIMESTAMP: ${smsRecord.sentAt} | TELCO RECEIPT: ${smsRecord.deliveryStatus}`);
  logger.info(`📱 ==========================================================`);

  return smsRecord;
}

function getSmsHistory() {
  return [...mockSmsStore];
}

module.exports = { sendSmsNotification, getSmsHistory };
