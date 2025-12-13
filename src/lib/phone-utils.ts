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
  if (!jid) return '';
  const digits = jid.split('@')[0];

  // If it's a LID (too long), return shortened version
  if (digits.length > 15) {
    return digits.slice(0, 4) + '...' + digits.slice(-4);
  }

  // Format based on common country codes
  if (digits.length >= 10 && digits.length <= 15) {
    // Egyptian format: 20 XXX XXX XXXX
    if (digits.startsWith('20') && digits.length === 12) {
      return '+' + digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
    }
    // Saudi format: 966 XX XXX XXXX
    if (digits.startsWith('966') && digits.length === 12) {
      return '+' + digits.replace(/(\d{3})(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4');
    }
    // General international format
    return '+' + digits.replace(/(\d{1,3})(\d{3})(\d{3})(\d+)/, '$1 $2 $3 $4');
  }

  return '+' + digits;
}

/**
 * Get best display number from chat
 * Prefers phone_jid over remote_id (which might be LID)
 */
export function getBestPhoneNumber(chat: any): string {
  const phoneJid = chat?.phone_jid;
  const remoteId = chat?.remote_id || chat?.remoteId;

  // If we have a phone_jid, use it (it's the real phone number)
  if (phoneJid && isPhoneJid(phoneJid)) {
    return formatPhoneFromJid(phoneJid);
  }

  // If remote_id is a phone number (not LID), use it
  if (remoteId && isPhoneJid(remoteId)) {
    return formatPhoneFromJid(remoteId);
  }

  // Fallback to whatever we have
  if (remoteId) {
    return formatPhoneFromJid(remoteId);
  }

  return '';
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

/**
 * Check if a JID is a phone-based JID (not LID)
 * Phone JIDs: 10-15 digits followed by @s.whatsapp.net
 * LID JIDs: longer numbers or different format
 * @param jid - WhatsApp JID to check
 * @returns true if phone-based JID, false if LID or other format
 */
export function isPhoneJid(jid: string): boolean {
  if (!jid) return false;
  const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
  if (!match) return false;
  const digits = match[1];
  // Phone numbers are typically 10-15 digits
  // LIDs are typically longer (15+ digits) and start with different patterns
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Check if a JID is a LID (Local ID) format
 * LIDs are typically longer numbers used by WhatsApp instead of phone numbers
 * @param jid - WhatsApp JID to check
 * @returns true if LID format
 */
export function isLidJid(jid: string): boolean {
  if (!jid) return false;
  // LID format: ends with @lid or is a long number at @s.whatsapp.net
  if (jid.endsWith('@lid')) return true;
  const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
  if (!match) return false;
  const digits = match[1];
  // LIDs are typically longer than phone numbers (15+ digits)
  return digits.length > 15;
}

/**
 * Extract the numeric part from a JID
 * @param jid - WhatsApp JID
 * @returns numeric part of the JID
 */
export function extractJidNumber(jid: string): string {
  if (!jid) return '';
  return jid.split('@')[0];
}
