import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { TOKEN_RULES, normalizeIranPhone, toLatinDigits } from '@boshghabyar/core';

import { authRequired, createSession, publicUser, revokeAllSessions, revokeSession } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { addTokens, createUser } from '../club.js';
import { config } from '../config.js';
import { db, findUserByEmail, findUserById, findUserByPhone, trackEvent } from '../db.js';
import { BAD_REQUEST, asyncHandler, clientIp, parse } from '../domain.js';
import { OtpError, requestOtp, verifyOtp } from '../otp.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'تعداد تلاش‌ها زیاد است؛ کمی صبر کنید و دوباره امتحان کنید' },
});

const DEFAULT_NAME = 'کاربر بشقاب‌یار';

const phoneSchema = z.string().min(10).max(24).transform((value, ctx) => {
  const phone = normalizeIranPhone(value);
  if (!phone) {
    ctx.addIssue({ code: 'custom', message: 'شمارهٔ موبایل معتبر نیست' });
    return z.NEVER;
  }
  return phone;
});

function sendOtpError(res: import('express').Response, error: unknown): boolean {
  if (error instanceof OtpError) {
    if (error.retryAfterSec) res.setHeader('Retry-After', String(error.retryAfterSec));
    res.status(error.status).json({ error: error.message, retryAfterSec: error.retryAfterSec });
    return true;
  }
  return false;
}

authRouter.post(
  '/otp/request',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = parse(z.object({ phone: phoneSchema }), req.body);
    try {
      const result = await requestOtp(phone, clientIp(req));
      res.json({ ok: true, ...result });
    } catch (error) {
      if (!sendOtpError(res, error)) throw error;
    }
  }),
);

const verifySchema = z.object({
  phone: phoneSchema,
  code: z.string().transform((v) => toLatinDigits(v).replace(/\D/g, '')).pipe(z.string().regex(/^\d{4}$/)),
  name: z.string().trim().min(2).max(60).optional(),
  referralCode: z.string().max(20).optional(),
  researchConsent: z.boolean().optional(),
});

authRouter.post('/otp/verify', authLimiter, (req, res) => {
  const input = parse(verifySchema, req.body);
  try {
    verifyOtp(input.phone, input.code);
  } catch (error) {
    if (sendOtpError(res, error)) return;
    throw error;
  }

  let user = findUserByPhone(input.phone);
  let isNew = false;
  if (user?.status === 'blocked') {
    res.status(403).json({ error: 'دسترسی این حساب مسدود شده است' });
    return;
  }
  if (!user) {
    user = createUser({
      name: input.name ?? DEFAULT_NAME,
      phone: input.phone,
      referralCode: input.referralCode,
      researchConsent: input.researchConsent ?? false,
    });
    isNew = true;
  } else if (input.name && user.name === DEFAULT_NAME) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(input.name, user.id);
    user = findUserById(user.id)!;
  }
  trackEvent('user.logged_in', user.id, { via: 'otp', isNew });
  res.json({ token: createSession(user, req.header('user-agent')), user: publicUser(user), isNew });
});

authRouter.post('/demo', authLimiter, (req, res) => {
  if (!config.enableDemo) {
    res.status(404).json({ error: 'ورود آزمایشی در این محیط فعال نیست' });
    return;
  }
  const user = findUserByEmail('demo@boshghabyar.ir');
  if (!user) {
    res.status(404).json({ error: 'حساب آزمایشی پیدا نشد' });
    return;
  }
  trackEvent('user.logged_in', user.id, { via: 'demo' });
  res.json({ token: createSession(user, req.header('user-agent')), user: publicUser(user), isNew: false });
});

authRouter.post('/register', authLimiter, (_req, res) => {
  // ثبت‌نام با ایمیل/رمز غیرفعال شده است؛ کاربران فقط با شمارهٔ موبایل و کد پیامکی ثبت‌نام می‌کنند.
  res.status(404).json({ error: 'ثبت‌نام با ایمیل غیرفعال است؛ با شمارهٔ موبایل وارد شوید' });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/login', authLimiter, (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = findUserByEmail(input.email);
  if (!user?.password_hash || !bcrypt.compareSync(input.password, user.password_hash)) {
    res.status(401).json({ error: 'ایمیل یا رمز عبور درست نیست' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'ورود با ایمیل و رمز فقط برای مدیران است؛ کاربران با شمارهٔ موبایل وارد می‌شوند' });
    return;
  }
  if (user.status === 'blocked') {
    res.status(403).json({ error: 'دسترسی این حساب مسدود شده است' });
    return;
  }
  trackEvent('user.logged_in', user.id, { via: 'password' });
  res.json({ token: createSession(user, req.header('user-agent')), user: publicUser(user) });
});

authRouter.post('/logout', authRequired, (req: AuthRequest, res) => {
  revokeSession(req.sessionId!);
  res.status(204).end();
});

authRouter.post('/logout-all', authRequired, (req: AuthRequest, res) => {
  revokeAllSessions(req.user!.id);
  res.status(204).end();
});

export const meRouter = Router();
meRouter.use(authRequired);

meRouter.get('/', (req: AuthRequest, res) => {
  res.json({ user: publicUser(findUserById(req.user!.id)!) });
});

meRouter.patch('/', (req: AuthRequest, res) => {
  const input = parse(
    z.object({ name: z.string().trim().min(2).max(60).optional(), researchConsent: z.boolean().optional() }),
    req.body,
  );
  if (input.name === undefined && input.researchConsent === undefined) {
    res.status(400).json({ error: BAD_REQUEST });
    return;
  }
  if (input.name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(input.name, req.user!.id);
  if (input.researchConsent !== undefined) {
    db.prepare('UPDATE users SET research_consent = ? WHERE id = ?').run(input.researchConsent ? 1 : 0, req.user!.id);
    trackEvent('research.consent_changed', req.user!.id, { consent: input.researchConsent });
    if (input.researchConsent) addTokens(req.user!.id, TOKEN_RULES.researchConsent, 'research-consent', req.user!.id);
  }
  res.json({ user: publicUser(findUserById(req.user!.id)!) });
});

const goalSchema = z.object({
  calorieTarget: z.number().int().min(800).max(6000).optional(),
  proteinTarget: z.number().int().min(10).max(400).optional(),
  carbsTarget: z.number().int().min(10).max(800).optional(),
  fatTarget: z.number().int().min(5).max(300).optional(),
  fiberTarget: z.number().int().min(0).max(100).optional(),
  dailyBudgetIRR: z.number().int().min(0).max(100_000_000).optional(),
  goalType: z.enum(['balance', 'weight-loss', 'muscle-gain', 'budget']).optional(),
});

const GOAL_COLUMNS: Record<string, string> = {
  calorieTarget: 'calorie_target',
  proteinTarget: 'protein_target',
  carbsTarget: 'carbs_target',
  fatTarget: 'fat_target',
  fiberTarget: 'fiber_target',
  dailyBudgetIRR: 'daily_budget_irr',
  goalType: 'goal_type',
};

meRouter.patch('/goal', (req: AuthRequest, res) => {
  const input = parse(goalSchema, req.body);
  const entries = Object.entries(input).filter(([key]) => key in GOAL_COLUMNS);
  if (entries.length === 0) {
    res.status(400).json({ error: BAD_REQUEST });
    return;
  }
  const set = entries.map(([key]) => `${GOAL_COLUMNS[key]} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(...entries.map(([, value]) => value as number | string), req.user!.id);
  trackEvent('goal.updated', req.user!.id, { fields: entries.map(([key]) => key) });
  res.json({ user: publicUser(findUserById(req.user!.id)!) });
});

meRouter.delete('/', (req: AuthRequest, res) => {
  const input = parse(z.object({ confirm: z.literal(true) }), req.body);
  void input;
  if (req.user!.role === 'admin') {
    res.status(403).json({ error: 'حساب مدیر از این مسیر حذف نمی‌شود' });
    return;
  }
  const userId = req.user!.id;
  db.prepare('DELETE FROM events WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  trackEvent('user.deleted', null, {});
  res.status(204).end();
});

