const PHONE_PREFIX = 'phone:';

export function parsePlayerContact(rawNotes: string | null | undefined) {
  const source = (rawNotes || '').trim();
  if (!source) return { phone: '', notes: '' };

  const [firstLine, ...rest] = source.split('\n');
  if (firstLine.toLowerCase().startsWith(PHONE_PREFIX)) {
    return {
      phone: firstLine.slice(PHONE_PREFIX.length).trim(),
      notes: rest.join('\n').trim(),
    };
  }

  return { phone: '', notes: source };
}

export function buildPlayerNotes(phone: string, notes: string) {
  const cleanPhone = normalizePhoneInput(phone);
  const cleanNotes = notes.trim();

  if (!cleanPhone && !cleanNotes) return null;
  if (!cleanPhone) return cleanNotes;
  if (!cleanNotes) return `${PHONE_PREFIX}${cleanPhone}`;
  return `${PHONE_PREFIX}${cleanPhone}\n${cleanNotes}`;
}

export function toWhatsAppPhone(phone: string | null | undefined) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export function normalizePhoneInput(value: string) {
  const trimmed = value.trimStart();
  let result = '';
  let hasPlus = false;

  for (const char of trimmed) {
    if (!hasPlus && char === '+' && result.length === 0) {
      hasPlus = true;
      result += '+';
      continue;
    }

    if (/\d/.test(char)) {
      result += char;
      continue;
    }

    if (char === ' ' || char === '-' || char === '(' || char === ')') {
      if (result && !result.endsWith(' ')) result += ' ';
    }
  }

  return result.replace(/\s+/g, ' ').trim();
}
