const fa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const fa1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

export const formatNumber = (value: number): string => fa.format(Math.round(Number.isFinite(value) ? value : 0));

export const formatDecimal = (value: number): string => fa1.format(Number.isFinite(value) ? value : 0);

export const formatPercent = (value: number): string => `${formatNumber(value)}٪`;

export const formatIRR = (value: number): string => `${formatNumber(value)} تومان`;

export const clampPercent = (ratio: number): number => (Number.isFinite(ratio) ? Math.min(100, Math.max(0, ratio * 100)) : 0);

const dayFormat = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDayFormat = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' });
const fullDateFormat = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' });

export const formatDate = (isoDate: string): string => {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoDate : dayFormat.format(date);
};

export const formatLongDate = (isoDate: string): string => {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoDate : longDayFormat.format(date);
};

export const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormat.format(date);
};

export const formatFullDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : fullDateFormat.format(date);
};

export const WEEKDAYS_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'] as const;

/** شمارهٔ روز هفته به سبک جاوااسکریپت (۰ = یکشنبه) */
export const weekdayFa = (index: number): string => WEEKDAYS_FA[index] ?? String(index);

export const weekdayShortOf = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : (WEEKDAYS_FA[date.getUTCDay()] ?? '').slice(0, 1);
};

/** «۳ روز و ۴ ساعت» یا null اگر گذشته باشد */
export function countdownText(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return hours > 0 ? `${formatNumber(days)} روز و ${formatNumber(hours)} ساعت` : `${formatNumber(days)} روز`;
  const minutes = Math.max(1, Math.floor((ms % 3_600_000) / 60_000));
  return hours > 0 ? `${formatNumber(hours)} ساعت و ${formatNumber(minutes)} دقیقه` : `${formatNumber(minutes)} دقیقه`;
}

export const formatClock = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(m)}:${new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(s)}`;
};

/** تبدیل ارقام فارسی و عربی به لاتین */
export function toLatinDigits(input: string): string {
  let out = '';
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0);
    else if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660);
    else out += char;
  }
  return out;
}

/** شمارهٔ موبایل ایران → 09xxxxxxxxx، یا null اگر نامعتبر باشد */
export function normalizePhone(input: string): string | null {
  let value = toLatinDigits(input).replace(/[\s\-()\u200c\u200f\u200e]/g, '');
  if (value.startsWith('+98')) value = `0${value.slice(3)}`;
  else if (value.startsWith('0098')) value = `0${value.slice(4)}`;
  else if (value.startsWith('98') && value.length === 12) value = `0${value.slice(2)}`;
  else if (/^9\d{9}$/.test(value)) value = `0${value}`;
  return /^09\d{9}$/.test(value) ? value : null;
}

export const toPersianDigits = (input: string): string => input.replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d)));

export const digitsOnly = (input: string): string => toLatinDigits(input).replace(/\D/g, '');

export const MEAL_LABELS: Record<string, string> = {
  breakfast: 'صبحانه',
  lunch: 'ناهار',
  dinner: 'شام',
  snack: 'میان‌وعده',
};

export const GOAL_LABELS: Record<string, string> = {
  balance: 'تعادل',
  'weight-loss': 'کاهش وزن',
  'muscle-gain': 'افزایش عضله',
  budget: 'اقتصادی',
};

export const CATEGORY_LABELS: Record<string, string> = {
  main: 'غذای اصلی',
  rice: 'برنج و پلو',
  soup: 'آش و سوپ',
  bread: 'نان',
  dairy: 'لبنیات',
  egg: 'تخم‌مرغ',
  fruit: 'میوه',
  legume: 'حبوبات',
  local: 'غذای محلی',
  unknown: 'نامشخص',
};

export const LEDGER_LABELS: Record<string, string> = {
  welcome: 'هدیهٔ خوش‌آمدگویی',
  checkin: 'ورود روزانه',
  'meal-day': 'ثبت نخستین وعدهٔ روز',
  'referral-inviter': 'دعوت دوست',
  'referral-invitee': 'هدیهٔ دعوت‌شدگان',
  'streak-bonus': 'پاداش ورود پیاپی',
  redeem: 'دریافت جایزه',
  'research-consent': 'مشارکت در پژوهش',
  'admin-grant': 'تنظیم توسط پشتیبانی',
  'demo-topup': 'شارژ آزمایشی',
};

export const ledgerLabel = (reason: string): string => LEDGER_LABELS[reason] ?? 'تراکنش ژتون';

export const REFERRAL_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'در انتظار نخستین وعده', tone: 'badge-warn' },
  rewarded: { label: 'جایزه داده شد', tone: 'badge-success' },
  capped: { label: 'سقف ماهانه پر شده', tone: '' },
};
