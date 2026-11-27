import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

import { FOODS, hasFeature } from '@boshghabyar/core';
import type { Food, MealEntry, UserGoal } from '@boshghabyar/core';

import { db, planOf, now } from './db.js';
import type { MealRow, UserRow } from './db.js';
import { randomUUID } from 'node:crypto';

export const BAD_REQUEST = 'اطلاعات واردشده معتبر نیست';

export function parse<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  return schema.parse(payload) as z.infer<T>;
}

/** اتصال هندلرهای async به مدیریت خطای اکسپرس 4 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function clientIp(req: Request): string | undefined {
  return req.ip ?? req.socket.remoteAddress ?? undefined;
}

export function goalOf(user: UserRow): UserGoal {
  return {
    calorieTarget: user.calorie_target,
    proteinTarget: user.protein_target,
    carbsTarget: user.carbs_target,
    fatTarget: user.fat_target,
    fiberTarget: user.fiber_target,
    dailyBudgetIRR: user.daily_budget_irr,
    goalType: user.goal_type as UserGoal['goalType'],
  };
}

export function customFoodsOf(userId: string): Food[] {
  const rows = db
    .prepare('SELECT * FROM custom_foods WHERE user_id = ?')
    .all(userId) as unknown as Array<{
    id: string;
    name_fa: string;
    category: Food['category'];
    per100g: string;
    serving_grams: number;
    serving_label: string;
    price_irr: number;
    barcode: string | null;
    shared: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    nameFa: row.name_fa,
    category: row.category,
    per100g: JSON.parse(row.per100g) as Food['per100g'],
    serving: { grams: row.serving_grams, labelFa: row.serving_label },
    estimatedPriceIRR: row.price_irr,
    tags: ['سفارشی'],
    free: true,
  }));
}

/** غذاهای ثبت‌شده توسط کاربران (جمع‌سپاری) که برای همه در دسترس است */
export function sharedFoods(): Food[] {
  const rows = db
    .prepare('SELECT * FROM custom_foods WHERE shared = 1 ORDER BY created_at DESC LIMIT 500')
    .all() as unknown as Array<{
    id: string;
    name_fa: string;
    category: Food['category'];
    per100g: string;
    serving_grams: number;
    serving_label: string;
    price_irr: number;
    barcode: string | null;
    shared: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    nameFa: row.name_fa,
    category: row.category,
    per100g: JSON.parse(row.per100g) as Food['per100g'],
    serving: { grams: row.serving_grams, labelFa: row.serving_label },
    estimatedPriceIRR: row.price_irr,
    tags: ['کاربری'],
    free: true,
  }));
}

export function foodsFor(user: UserRow): Food[] {
  const own = customFoodsOf(user.id);
  const shared = sharedFoods().filter((f) => !own.some((o) => o.id === f.id));
  return hasFeature(planOf(user), 'extendedFoods')
    ? [...FOODS, ...own, ...shared]
    : [...FOODS.filter((f) => f.free), ...own, ...shared];
}

export function mealRowToEntry(row: MealRow): MealEntry {
  return {
    id: row.id,
    userId: row.user_id,
    foodId: row.food_id,
    grams: row.grams,
    mealType: row.meal_type as MealEntry['mealType'],
    date: row.date,
    createdAt: row.created_at,
  };
}

export function mealsOf(userId: string, from?: string, to?: string): MealEntry[] {
  const rows = db
    .prepare('SELECT * FROM meals WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC')
    .all(userId, from ?? '0000-01-01', to ?? '9999-12-31') as unknown as MealRow[];
  return rows.map(mealRowToEntry);
}

export function addDays(date: string, delta: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + delta * 86_400_000).toISOString().slice(0, 10);
}

/** ثبت دسترسی ادمین به دادهٔ کاربران برای حسابرسی */
export function audit(adminId: string, action: string, target: string | null, detail: Record<string, unknown>, ip?: string): void {
  db.prepare('INSERT INTO admin_audit (id, admin_id, action, target, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    randomUUID(),
    adminId,
    action,
    target,
    JSON.stringify(detail),
    ip ?? null,
    now(),
  );
}
