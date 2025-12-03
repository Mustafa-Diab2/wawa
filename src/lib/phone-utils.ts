/**
 * Normalize phone number to WhatsApp JID format
 * @param phone - Phone number with country code (e.g., "201234567890" or "+20 123 456 7890")
 * @returns Normalized JID (e.g., "201234567890@s.whatsapp.net")
 */
export function normalizePhoneToJid(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Validate minimum length (at least 10 digits)
  if (digits.length < 10) {
    throw new Error('رقم الهاتف غير صحيح. يجب أن يكون على الأقل 10 أرقام.');
  }

  // Return WhatsApp JID format
  return `${digits}@s.whatsapp.net`;
}

/**
 * Format phone number for display
 * @param jid - WhatsApp JID (e.g., "201234567890@s.whatsapp.net")
 * @returns Formatted phone number (e.g., "+20 123 456 7890")
 */
export function formatPhoneFromJid(jid: string): string {
  const digits = jid.split('@')[0];

  // Simple formatting: add + at start and space every 3 digits
  if (digits.length > 3) {
    return '+' + digits.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1 $2 $3 $4');
  }

  return '+' + digits;
}

/**
 * Validate phone number
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}
