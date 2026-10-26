const PDFDocument = require('pdfkit');

async function generateReceipt(parcel) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).fillColor('#1a56db').text('SwiftDrop', { align: 'center' });
    doc.fontSize(12).fillColor('#666').text('Delivery Receipt', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e2e8f0');
    doc.moveDown();

    // Tracking info
    doc.fontSize(14).fillColor('#1a202c').text('Tracking Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#4a5568');
    doc.text(`Tracking Number: ${parcel.trackingNumber}`, { continued: false });
    doc.text(`Status: ${parcel.status}`);
    doc.text(`Created: ${new Date(parcel.createdAt).toLocaleString()}`);
    if (parcel.deliveredAt) {
      doc.text(`Delivered: ${new Date(parcel.deliveredAt).toLocaleString()}`);
    }
    doc.moveDown();

    // Parcel details
    doc.fontSize(14).fillColor('#1a202c').text('Parcel Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#4a5568');
    doc.text(`Size: ${parcel.size}`);
    doc.text(`Weight: ${parcel.weightKg} kg`);
    doc.text(`Zone: ${parcel.zone?.name || 'N/A'}`);
    doc.text(`Delivery Fee: LKR ${parcel.estimatedFee.toFixed(2)}`);
    doc.moveDown();

    // Addresses
    doc.fontSize(14).fillColor('#1a202c').text('Addresses', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#4a5568');
    doc.text(`Pickup: ${parcel.pickupAddress}, ${parcel.pickupCity}`);
    doc.text(`Delivery: ${parcel.dropoffAddress}, ${parcel.dropoffCity}`);
    doc.text(`Recipient: ${parcel.recipientName} | ${parcel.recipientPhone}`);
    doc.moveDown();

    // Footer
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e2e8f0');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#a0aec0').text(
      `Generated on ${new Date().toLocaleString()} | SwiftDrop Courier Services`,
      { align: 'center' }
    );

    doc.end();
  });
}

module.exports = { generateReceipt };
