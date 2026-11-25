import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { UserRow } from './db.js';
import { findUserById } from './db.js';

const DEFAULT_SECRET = 'dev-only-change-me-boshghabyar';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
const SECRET = process.env.JWT_SECRET ?? DEFAULT_SECRET;

export interface AuthRequest extends Request {
  user?: UserRow;
}

export interface TokenPayload {
  sub: string;
  role: 'user' | 'admin';
}

export function signToken(user: UserRow): string {
  const payload: TokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    plan: user.plan,
    goal: {
      calorieTarget: user.calorie_target,
      proteinTarget: user.protein_target,
      carbsTarget: user.carbs_target,
      fatTarget: user.fat_target,
      fiberTarget: user.fiber_target,
      dailyBudgetIRR: user.daily_budget_irr,
      goalType: user.goal_type,
    },
    createdAt: user.created_at,
  };
}

export function authRequired(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'نیاز به ورود به حساب کاربری است' });
    return;
  }
  try {
    const decoded = jwt.verify(token, SECRET) as TokenPayload;
    const user = findUserById(decoded.sub);
    if (!user) {
      res.status(401).json({ error: 'حساب کاربری معتبر نیست' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'نشست منقضی شده است' });
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
