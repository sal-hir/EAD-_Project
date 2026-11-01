// Replace individual adapters only after a public API contract is implemented.
// These adapters deliberately make no HTTP requests to Auth or Merchant.
export class PublicServiceError extends Error {
  constructor(kind, message) { super(message); this.name = 'PublicServiceError'; this.kind = kind; }
}
const unavailable = async () => { throw new PublicServiceError('unavailable', 'This service is not connected yet.'); };
export const publicServices = { track: unavailable, quote: unavailable, contact: unavailable };
export const normalizeTrackingNumber = value => value.trim().toUpperCase();
export const validTrackingNumber = value => /^[A-Z0-9][A-Z0-9-]{3,63}$/.test(normalizeTrackingNumber(value));
