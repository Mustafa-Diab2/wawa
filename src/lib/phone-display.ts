import { isLidJid, isPhoneJid } from './chat-utils';

type ChatLike = {
  phone_jid?: string | null;
  phoneJid?: string | null;
  remote_id?: string | null;
  remoteId?: string | null;
  name?: string | null;
};

function extractDigits(value: string | null | undefined): string {
  if (!value) return '';
  const left = value.includes('@') ? value.split('@')[0] : value;
  return left.replace(/\D/g, '');
}

export function getDisplayJid(chat: ChatLike | null | undefined): string | null {
  if (!chat) return null;
  const phoneJid = chat.phone_jid || chat.phoneJid || null;
  const remoteId = chat.remote_id || chat.remoteId || null;

  if (phoneJid && isPhoneJid(phoneJid)) return extractDigits(phoneJid);
  if (remoteId) return extractDigits(remoteId);
  return null;
}

export function formatE164FromJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const digits = extractDigits(jid);
  if (!digits || digits.length < 10 || digits.length > 15) return null;

  if (digits.startsWith('20') && digits.length >= 12) {
    const country = '+20';
    const first = digits.slice(2, 5);
    const second = digits.slice(5, 8);
    const third = digits.slice(8, 12);
    const rest = digits.slice(12);
    return [country, first, second, third, rest].filter(Boolean).join(' ').trim();
  }

  return `+${digits}`;
}

export function needsMapping(chat: ChatLike | null | undefined): boolean {
  if (!chat) return true;
  const phoneJid = chat.phone_jid || chat.phoneJid || null;
  const remoteId = chat.remote_id || chat.remoteId || '';
  return (!phoneJid || !isPhoneJid(phoneJid)) && isLidJid(remoteId);
}

export function getDisplayName(chat: ChatLike | null | undefined): string {
  const rawName = (chat?.name || '').trim();
  const phoneDigits = getDisplayJid(chat);
  const formattedPhone = formatE164FromJid(chat?.phone_jid || chat?.phoneJid || null);

  if (formattedPhone) return formattedPhone;
  if (rawName) return rawName;
  if (phoneDigits) return phoneDigits;
  return 'Unknown number';
}
