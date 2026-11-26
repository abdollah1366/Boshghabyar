import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { levelFor } from '@boshghabyar/core';

import { config } from './config.js';
import type { UserRow } from './db.js';
import { db, findUserById, now, planOf } from './db.js';

const DEFAULT_SECRET = 'dev-only-change-me-boshghabyar';
if (config.isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
const SECRET = process.env.JWT_SECRET ?? DEFAULT_SECRET;
const ISSUER = 'boshghabyar-api';

export interface AuthRequest extends Request {
  user?: UserRow;
  sessionId?: string;
}

export interface TokenPayload {
  sub: string;
  sid: string;
  role: 'user' | 'admin';
}

/** ساخت نشست جدید و برگرداندن توکن؛ نشست‌ها قابل ابطال (خروج) هستند */
export function createSession(user: UserRow, userAgent?: string): string {
  const id = randomUUID();
  const created = new Date();
  const expires = new Date(created.getTime() + config.sessionDays * 86_400_000);
  db.prepare(
    'INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, user.id, created.toISOString(), created.toISOString(), expires.toISOString(), (userAgent ?? '').slice(0, 200));
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(created.toISOString(), user.id);
  const payload: TokenPayload = { sub: user.id, sid: id, role: user.role };
  return jwt.sign(payload, SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    expiresIn: `${config.sessionDays}d`,
  });
}

export function publicUser(user: UserRow) {
  const plan = planOf(user);
  const progress = levelFor(user.tokens_earned);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    plan,
    proUntil: user.plan === 'pro' ? null : user.pro_until,
    goal: {
      calorieTarget: user.calorie_target,
      proteinTarget: user.protein_target,
      carbsTarget: user.carbs_target,
      fatTarget: user.fat_target,
      fiberTarget: user.fiber_target,
      dailyBudgetIRR: user.daily_budget_irr,
      goalType: user.goal_type,
    },
    referralCode: user.referral_code,
    tokenBalance: user.token_balance,
    level: { id: progress.level.id, labelFa: progress.level.labelFa },
    researchConsent: Boolean(user.research_consent),
    createdAt: user.created_at,
  };
}

export function authRequired(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'برای ادامه وارد حساب خود شوید' });
    return;
  }
  try {
    const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'], issuer: ISSUER }) as TokenPayload;
    if (!decoded.sid) throw new Error('legacy token');
    const session = db
      .prepare('SELECT id, revoked, expires_at, last_seen_at FROM sessions WHERE id = ? AND user_id = ?')
      .get(decoded.sid, decoded.sub) as
      | { id: string; revoked: number; expires_at: string; last_seen_at: string }
      | undefined;
    if (!session || session.revoked || session.expires_at < now()) {
      res.status(401).json({ error: 'نشست شما پایان یافته است؛ دوباره وارد شوید' });
      return;
    }
    const user = findUserById(decoded.sub);
    if (!user) {
      res.status(401).json({ error: 'حساب کاربری معتبر نیست' });
      return;
    }
    if (user.status === 'blocked') {
      res.status(403).json({ error: 'دسترسی این حساب مسدود شده است' });
      return;
    }
    if (Date.now() - new Date(session.last_seen_at).getTime() > 3_600_000) {
      db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(now(), session.id);
    }
    req.user = user;
    req.sessionId = session.id;
    next();
  } catch {
    res.status(401).json({ error: 'نشست شما پایان یافته است؛ دوباره وارد شوید' });
  }
}

export function adminRequired(req: AuthRequest, res: Response, next: NextFunction): void {
  authRequired(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'دسترسی مدیر وجود ندارد' });
      return;
    }
    next();
  });
}

export function revokeSession(sessionId: string): void {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(sessionId);
}

export function revokeAllSessions(userId: string): void {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(userId);
}
