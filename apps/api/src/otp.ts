import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import { config } from './config.js';
import { db, now } from './db.js';

const CODE_TTL_MS = 2 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 6;

export class OtpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
  }
}

function hashCode(phone: string, code: string): string {
  return createHmac('sha256', config.researchSecret).update(`${phone}:${code}`).digest('hex');
}

async function sendSms(phone: string, code: string): Promise<void> {
  if (config.smsProvider === 'kavenegar') {
    if (!config.kavenegarKey) throw new OtpError('سرویس پیامک پیکربندی نشده است', 503);
    const url = new URL(`https://api.kavenegar.com/v1/${config.kavenegarKey}/verify/lookup.json`);
    url.searchParams.set('receptor', phone);
    url.searchParams.set('token', code);
    url.searchParams.set('template', config.kavenegarTemplate);
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new OtpError('ارسال پیامک ناموفق بود؛ کمی بعد دوباره تلاش کنید', 503);
    return;
  }
  if (!config.otpDebugReturnCode) {
    throw new OtpError('سرویس پیامک هنوز راه‌اندازی نشده است', 503);
  }
  console.log(`[otp] کد ورود ${phone}: ${code}`);
}

export interface OtpRequestResult {
  expiresInSec: number;
  resendInSec: number;
  devCode?: string;
}

export async function requestOtp(phone: string, ip: string | undefined): Promise<OtpRequestResult> {
  const last = db
    .prepare('SELECT created_at FROM otp_codes WHERE phone = ? ORDER BY created_at DESC LIMIT 1')
    .get(phone) as { created_at: string } | undefined;
  if (last) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < RESEND_AFTER_MS) {
      const wait = Math.ceil((RESEND_AFTER_MS - elapsed) / 1000);
      throw new OtpError(`لطفاً ${wait} ثانیه دیگر دوباره درخواست کد بدهید`, 429, wait);
    }
  }
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const count = (
    db.prepare('SELECT COUNT(*) AS n FROM otp_codes WHERE phone = ? AND created_at >= ?').get(phone, hourAgo) as { n: number }
  ).n;
  if (count >= MAX_PER_HOUR) {
    throw new OtpError('تعداد درخواست کد برای این شماره زیاد است؛ یک ساعت بعد دوباره امتحان کنید', 429, 3600);
  }

  const code = String(randomInt(10_000, 100_000));
  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE phone = ? AND consumed = 0').run(phone);
  const id = randomUUID();
  db.prepare(
    'INSERT INTO otp_codes (id, phone, code_hash, expires_at, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, phone, hashCode(phone, code), new Date(Date.now() + CODE_TTL_MS).toISOString(), ip ?? null, now());

  try {
    await sendSms(phone, code);
  } catch (error) {
    db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(id);
    throw error;
  }

  const result: OtpRequestResult = {
    expiresInSec: CODE_TTL_MS / 1000,
    resendInSec: RESEND_AFTER_MS / 1000,
  };
  if (config.otpDebugReturnCode && config.smsProvider === 'console') result.devCode = code;
  return result;
}

/** بررسی کد؛ در صورت موفقیت کد مصرف می‌شود. در غیر این صورت OtpError پرتاب می‌شود. */
export function verifyOtp(phone: string, code: string): void {
  const row = db
    .prepare('SELECT id, code_hash, expires_at, attempts FROM otp_codes WHERE phone = ? AND consumed = 0 ORDER BY created_at DESC LIMIT 1')
    .get(phone) as { id: string; code_hash: string; expires_at: string; attempts: number } | undefined;
  if (!row || row.expires_at < now()) {
    throw new OtpError('کد منقضی شده است؛ کد جدید دریافت کنید', 400);
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(row.id);
    throw new OtpError('تعداد تلاش‌ها زیاد بود؛ کد جدید دریافت کنید', 429);
  }
  const expected = Buffer.from(row.code_hash, 'hex');
  const actual = Buffer.from(hashCode(phone, code), 'hex');
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!ok) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    throw new OtpError('کد واردشده درست نیست', 400);
  }
  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(row.id);
}
