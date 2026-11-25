import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { z, ZodError } from 'zod';

import {
  DEFAULT_GOAL,
  FOODS,
  buildExplanationPrompt,
  buildTrend,
  hasFeature,
  historyCutoffDate,
  suggestAlternatives,
  summarizeDay,
} from '@boshghabyar/core';
import type { Food, MealEntry, UserGoal } from '@boshghabyar/core';

import { adminRequired, authRequired, publicUser, signToken } from './auth.js';
import type { AuthRequest } from './auth.js';
import { db, findUserByEmail, findUserById, now, today, trackEvent } from './db.js';
import type { MealRow, UserRow } from './db.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean)
  ?? ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '64kb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'تعداد تلاشهای ورود زیاد است، کمی صبر کنید' },
});

const BAD_REQUEST = 'دادههای ارسالی معتبر نیست';

function parse<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  return schema.parse(payload) as z.infer<T>;
}

function goalOf(user: UserRow): UserGoal {
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

function customFoodsOf(userId: string): Food[] {
  const rows = db
    .prepare('SELECT * FROM custom_foods WHERE user_id = ?')
    .all(userId) as Array<{
    id: string;
    name_fa: string;
    category: Food['category'];
    per100g: string;
    serving_grams: number;
    serving_label: string;
    price_irr: number;
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

function foodsFor(user: UserRow): Food[] {
  return hasFeature(user.plan, 'extendedFoods') ? [...FOODS, ...customFoodsOf(user.id)] : FOODS.filter((f) => f.free);
}

function mealRowToEntry(row: MealRow): MealEntry {
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

function mealsOf(user: UserRow, from?: string, to?: string): MealEntry[] {
  const rows = db
    .prepare('SELECT * FROM meals WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC')
    .all(user.id, from ?? '0000-01-01', to ?? '9999-12-31') as unknown as MealRow[];
  return rows.map(mealRowToEntry);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'boshghabyar-api', version: '0.1.0', time: now() });
});

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.string().min(8).max(128),
  phone: z.string().max(20).optional(),
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  const input = parse(registerSchema, req.body);
  const email = input.email.toLowerCase().trim();
  if (findUserByEmail(email)) {
    res.status(409).json({ error: 'ایمیل قبلاً ثبت شده است' });
    return;
  }
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.name, email, input.phone ?? null, bcrypt.hashSync(input.password, 10), now());
  const user = findUserById(id)!;
  trackEvent('user.registered', id, { plan: user.plan });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

app.post('/api/auth/login', authLimiter, (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = findUserByEmail(input.email);
  if (!user || !bcrypt.compareSync(input.password, user.password_hash)) {
    res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است' });
    return;
  }
  trackEvent('user.logged_in', user.id);
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/me', authRequired, (req: AuthRequest, res) => {
  res.json({ user: publicUser(req.user!) });
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

app.patch('/api/me/goal', authRequired, (req: AuthRequest, res) => {
  const input = parse(goalSchema, req.body);
  const columns: Record<string, number | string> = {
    calorieTarget: 'calorie_target',
    proteinTarget: 'protein_target',
    carbsTarget: 'carbs_target',
    fatTarget: 'fat_target',
    fiberTarget: 'fiber_target',
    dailyBudgetIRR: 'daily_budget_irr',
    goalType: 'goal_type',
  };
  const entries = Object.entries(input).filter(([key]) => key in columns);
  if (entries.length === 0) {
    res.status(400).json({ error: BAD_REQUEST });
    return;
  }
  const set = entries.map(([key]) => `${columns[key]} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(...entries.map(([, value]) => value), req.user!.id);
  trackEvent('goal.updated', req.user!.id, { fields: entries.map(([key]) => key) });
  res.json({ user: publicUser(findUserById(req.user!.id)!) });
});

app.get('/api/foods', authRequired, (req: AuthRequest, res) => {
  const foods = foodsFor(req.user!);
  res.json({ foods, count: foods.length, plan: req.user!.plan });
});

const customFoodSchema = z.object({
  nameFa: z.string().min(2).max(80),
  category: z.enum(['main', 'rice', 'soup', 'bread', 'dairy', 'egg', 'fruit', 'legume', 'local']),
  per100g: z.object({
    kcal: z.number().min(0).max(1000),
    protein: z.number().min(0).max(100),
    carbs: z.number().min(0).max(100),
    fat: z.number().min(0).max(100),
    fiber: z.number().min(0).max(100),
  }),
  servingGrams: z.number().int().min(1).max(2000),
  servingLabel: z.string().min(1).max(60),
  priceIRR: z.number().int().min(0).max(10_000_000),
});

app.post('/api/foods/custom', authRequired, (req: AuthRequest, res) => {
  if (!hasFeature(req.user!.plan, 'customFoods')) {
    res.status(403).json({ error: 'افزودن غذای سفارشی مخصوص نسخه حرفهای است', upgradeRequired: true });
    return;
  }
  const input = parse(customFoodSchema, req.body);
  const id = `custom-${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO custom_foods (id, user_id, name_fa, category, per100g, serving_grams, serving_label, price_irr, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.user!.id, input.nameFa, input.category, JSON.stringify(input.per100g),
    input.servingGrams, input.servingLabel, input.priceIRR, now(),
  );
  trackEvent('custom_food.created', req.user!.id, { id });
  res.status(201).json({ id });
});

const mealSchema = z.object({
  foodId: z.string().min(1).max(120),
  grams: z.number().int().min(1).max(3000),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

app.get('/api/meals', authRequired, (req: AuthRequest, res) => {
  const cutoff = historyCutoffDate(req.user!.plan);
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const effectiveFrom = cutoff ? (from && from > cutoff ? from : cutoff) : from;
  const entries = mealsOf(req.user!, effectiveFrom, to);
  const foods = foodsFor(req.user!);
  res.json({
    meals: entries,
    count: entries.length,
    historyLimited: Boolean(cutoff),
    foods,
  });
});

app.post('/api/meals', authRequired, (req: AuthRequest, res) => {
  const input = parse(mealSchema, req.body);
  const user = req.user!;
  const foods = foodsFor(user);
  if (!foods.some((f) => f.id === input.foodId)) {
    res.status(400).json({ error: 'غذای انتخابشده در دسترس نسخه شما نیست' });
    return;
  }
  const id = crypto.randomUUID();
  const date = input.date ?? today();
  db.prepare('INSERT INTO meals (id, user_id, food_id, grams, meal_type, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, user.id, input.foodId, input.grams, input.mealType, date, now());
  trackEvent('meal.created', user.id, { foodId: input.foodId, grams: input.grams, mealType: input.mealType });
  res.status(201).json({ id, date });
});

app.delete('/api/meals/:id', authRequired, (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'وعده یافت نشد' });
    return;
  }
  trackEvent('meal.deleted', req.user!.id, { id: req.params.id });
  res.status(204).end();
});

app.get('/api/reports/daily', authRequired, (req: AuthRequest, res) => {
  const user = req.user!;
  const date = typeof req.query.date === 'string' ? req.query.date : today();
  const entries = mealsOf(user, date, date);
  const summary = summarizeDay(entries, goalOf(user), date, foodsFor(user));
  res.json({ report: summary, meals: entries });
});

app.get('/api/reports/weekly', authRequired, (req: AuthRequest, res) => {
  const user = req.user!;
  const from = typeof req.query.from === 'string' ? req.query.from : new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const days = Math.min(30, Math.max(1, Number(req.query.days ?? 7)));
  const cutoff = historyCutoffDate(user.plan);
  const effectiveFrom = cutoff && from < cutoff ? cutoff : from;
  const entries = mealsOf(user, effectiveFrom);
  const trend = buildTrend(entries, effectiveFrom, days, foodsFor(user));
  const advanced = hasFeature(user.plan, 'advancedAnalytics');
  const avgKcal = trend.reduce((sum, p) => sum + p.kcal, 0) / Math.max(trend.length, 1);
  const activeDays = trend.filter((p) => p.entryCount > 0).length;
  res.json({
    trend,
    summary: {
      averageKcal: Math.round(avgKcal),
      activeDays,
      totalMeals: entries.length,
      budgetUsedIRR: Math.round(trend.reduce((sum, p) => sum + p.budget, 0)),
    },
    insight: advanced
      ? `میانگین دریافت کالری ${Math.round(avgKcal)} کیلوکالوری و ${activeDays} روز از ${trend.length} روز دارای ثبت وعده است.`
      : 'گزارش پیشرفته مخصوص نسخه حرفهای است.',
    advanced,
  });
});

app.get('/api/recommendations/:mealId', authRequired, (req: AuthRequest, res) => {
  const user = req.user!;
  const row = db.prepare('SELECT * FROM meals WHERE id = ? AND user_id = ?').get(req.params.mealId, user.id) as MealRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'وعده یافت نشد' });
    return;
  }
  const foods = foodsFor(user);
  const suggestions = suggestAlternatives({ entry: mealRowToEntry(row), goal: goalOf(user), plan: user.plan, foods });
  const enriched = suggestions.map((suggestion) => {
    const from = foods.find((f) => f.id === suggestion.fromFoodId)!;
    const to = foods.find((f) => f.id === suggestion.toFoodId)!;
    return {
      ...suggestion,
      prompt: hasFeature(user.plan, 'aiExplanations') ? buildExplanationPrompt(suggestion, from, to) : null,
    };
  });
  trackEvent('recommendation.viewed', user.id, { mealId: row.id, count: enriched.length });
  res.json({ suggestions: enriched, deterministic: true });
});

app.post('/api/upgrade', authRequired, (req: AuthRequest, res) => {
  const input = parse(z.object({ plan: z.literal('pro'), reference: z.string().max(80).optional() }), req.body);
  const user = req.user!;
  if (user.plan === 'pro') {
    res.json({ user: publicUser(user), alreadyPro: true });
    return;
  }
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(input.plan, user.id);
  db.prepare('INSERT INTO subscriptions (id, user_id, plan, provider, reference, amount_irr, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), user.id, 'pro', 'mock', input.reference ?? 'demo-upgrade', 0, now());
  trackEvent('plan.upgraded', user.id, { from: 'free', to: 'pro' });
  res.json({ user: publicUser(findUserById(user.id)!), alreadyPro: false });
});

const eventSchema = z.object({
  type: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).optional(),
});

app.post('/api/events', authRequired, (req: AuthRequest, res) => {
  const input = parse(eventSchema, req.body);
  trackEvent(input.type, req.user!.id, input.payload ?? {});
  res.status(202).json({ ok: true });
});

app.get('/api/admin/overview', adminRequired, (_req, res) => {
  const scalar = (sql: string, ...params: Array<string | number | null>): number =>
    (db.prepare(sql).get(...params) as unknown as { n: number }).n;
  const topFoods = db
    .prepare('SELECT food_id, COUNT(*) AS n FROM meals GROUP BY food_id ORDER BY n DESC LIMIT 5')
    .all() as Array<{ food_id: string; n: number }>;
  const daily = db
    .prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS n FROM events WHERE created_at >= ? GROUP BY substr(created_at, 1, 10) ORDER BY date")
    .all(new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)) as unknown as Array<{ date: string; n: number }>;
  res.json({
    users: scalar('SELECT COUNT(*) AS n FROM users'),
    proUsers: scalar("SELECT COUNT(*) AS n FROM users WHERE plan = 'pro'"),
    mealsTotal: scalar('SELECT COUNT(*) AS n FROM meals'),
    mealsToday: scalar('SELECT COUNT(*) AS n FROM meals WHERE date = ?', today()),
    revenueIRR: scalar('SELECT COALESCE(SUM(amount_irr), 0) AS n FROM subscriptions'),
    conversionRate: scalar('SELECT COUNT(*) AS n FROM users') ? scalar("SELECT COUNT(*) AS n FROM users WHERE plan = 'pro'") / scalar('SELECT COUNT(*) AS n FROM users') : 0,
    topFoods,
    eventsByDay: daily,
  });
});

app.get('/api/admin/events', adminRequired, (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
  const rows = db.prepare('SELECT type, user_id, payload, created_at FROM events ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json({ events: rows });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: BAD_REQUEST, details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'خطای داخلی سرور' });
});

app.listen(PORT, () => {
  console.log(`BoshghabYar API on http://localhost:${PORT} (${process.env.NODE_ENV ?? 'development'})`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('Demo: demo@boshghabyar.ir / Demo@12345 | Admin: admin@boshghabyar.ir / Admin@12345');
  }
});
