const PERSIAN_ZERO = 0x06f0;
const ARABIC_ZERO = 0x0660;

/** تبدیل ارقام فارسی و عربی به لاتین */
export function toLatinDigits(input: string): string {
  let out = '';
  for (const char of input) {
    const code = char.codePointAt(0)!;
    if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) out += String(code - PERSIAN_ZERO);
    else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) out += String(code - ARABIC_ZERO);
    else out += char;
  }
  return out;
}

/**
 * شمارهٔ موبایل ایران را به قالب استاندارد ۰۹xxxxxxxxx تبدیل می‌کند.
 * ورودی‌های پذیرفته‌شده: ۰۹۱۴…، +98914…، 0098914…، 914… و ارقام فارسی/عربی.
 */
export function normalizeIranPhone(input: string): string | null {
  let value = toLatinDigits(input).replace(/[\s\-()\u200c\u200f\u200e]/g, '');
  if (value.startsWith('+98')) value = `0${value.slice(3)}`;
  else if (value.startsWith('0098')) value = `0${value.slice(4)}`;
  else if (value.startsWith('98') && value.length === 12) value = `0${value.slice(2)}`;
  else if (/^9\d{9}$/.test(value)) value = `0${value}`;
  return /^09\d{9}$/.test(value) ? value : null;
}

/** پوشاندن شماره برای نمایش در فهرست دعوت‌ها: ۰۹۱۴***۱۲۳۴ */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
}
