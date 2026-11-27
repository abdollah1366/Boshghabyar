import { createHmac, randomUUID } from 'node:crypto';

import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';

import { FOODS, entryNutrition, entryPrice, levelFor } from '@boshghabyar/core';
import type { Food, MealEntry } from '@boshghabyar/core';

import { adminRequired, revokeAllSessions } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { addTokens } from '../club.js';
import { config } from '../config.js';
import { db, findUserById, planOf, today, trackEvent } from '../db.js';
import type { UserRow } from '../db.js';
import { BAD_REQUEST, addDays, audit, clientIp, parse } from '../domain.js';

export const adminRouter = Router();
adminRouter.use(adminRequired);

const scalar = (sql: string, ...params: Array<string | number | null>): number =>
  (db.prepare(sql).get(...params) as unknown as { n: number }).n;

const MEAL_LABELS: Record<string, string> = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده' };

function allFoods(): Map<string, Food> {
  const map = new Map<string, Food>(FOODS.map((f) => [f.id, f]));
  const custom = db.prepare('SELECT * FROM custom_foods').all() as unknown as Array<{
    id: string; name_fa: string; category: Food['category']; per100g: string; serving_grams: number; serving_label: string; price_irr: number;
  }>;
  for (const row of custom) {
    map.set(row.id, {
      id: row.id,
      nameFa: row.name_fa,
      category: row.category,
      per100g: JSON.parse(row.per100g) as Food['per100g'],
      serving: { grams: row.serving_grams, labelFa: row.serving_label },
      estimatedPriceIRR: row.price_irr,
      tags: ['سفارشی'],
      free: true,
    });
  }
  return map;
}

function adminUser(user: UserRow) {
  const progress = levelFor(user.tokens_earned);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    plan: user.plan,
    effectivePlan: planOf(user),
    proUntil: user.pro_until,
    status: user.status,
    tokenBalance: user.token_balance,
    tokensEarned: user.tokens_earned,
    level: progress.level.labelFa,
    referralCode: user.referral_code,
    referredBy: user.referred_by,
    researchConsent: Boolean(user.research_consent),
    streak: user.streak_count,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
  };
}

adminRouter.get('/overview', (req: AuthRequest, res) => {
  const users = scalar('SELECT COUNT(*) AS n FROM users');
  const proUsers = scalar("SELECT COUNT(*) AS n FROM users WHERE plan = 'pro' OR (pro_until IS NOT NULL AND pro_until > ?)", new Date().toISOString());
  const weekAgo = addDays(today(), -6);
  const foods = allFoods();
  const topFoods = (db
    .prepare('SELECT food_id, COUNT(*) AS n FROM meals GROUP BY food_id ORDER BY n DESC LIMIT 5')
    .all() as unknown as Array<{ food_id: string; n: number }>).map((r) => ({ ...r, nameFa: foods.get(r.food_id)?.nameFa ?? r.food_id }));
  const eventsByDay = db
    .prepare('SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS n FROM events WHERE created_at >= ? GROUP BY substr(created_at, 1, 10) ORDER BY date')
    .all(`${weekAgo}T00:00:00.000Z`);
  const mealsByDay = db
    .prepare('SELECT date, COUNT(*) AS n FROM meals WHERE date >= ? GROUP BY date ORDER BY date')
    .all(weekAgo);
  audit(req.user!.id, 'admin.overview.view', null, {}, clientIp(req));
  res.json({
    users,
    proUsers,
    newUsers7d: scalar('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', `${weekAgo}T00:00:00.000Z`),
    activeUsers7d: scalar('SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE user_id IS NOT NULL AND created_at >= ?', `${weekAgo}T00:00:00.000Z`),
    researchConsentUsers: scalar('SELECT COUNT(*) AS n FROM users WHERE research_consent = 1'),
    mealsTotal: scalar('SELECT COUNT(*) AS n FROM meals'),
    mealsToday: scalar('SELECT COUNT(*) AS n FROM meals WHERE date = ?', today()),
    cameraMeals: scalar("SELECT COUNT(*) AS n FROM meals WHERE source = 'camera'"),
    recognitionsToday: scalar('SELECT COUNT(*) AS n FROM recognitions WHERE day = ?', today()),
    revenueIRR: scalar('SELECT COALESCE(SUM(amount_irr), 0) AS n FROM subscriptions'),
    conversionRate: users ? proUsers / users : 0,
    topFoods,
    eventsByDay,
    mealsByDay,
    club: {
      tokensIssued: scalar('SELECT COALESCE(SUM(delta), 0) AS n FROM token_ledger WHERE delta > 0'),
      tokensSpent: -scalar('SELECT COALESCE(SUM(delta), 0) AS n FROM token_ledger WHERE delta < 0'),
      referrals: scalar('SELECT COUNT(*) AS n FROM referrals'),
      referralsRewarded: scalar("SELECT COUNT(*) AS n FROM referrals WHERE status = 'rewarded'"),
      redemptions: scalar("SELECT COUNT(*) AS n FROM token_ledger WHERE reason = 'redeem'"),
    },
  });
});

adminRouter.get('/events', (req: AuthRequest, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
  const rows = db.prepare('SELECT type, user_id, payload, created_at FROM events ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json({ events: rows });
});

adminRouter.get('/users', (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 25) || 25));
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const plan = typeof req.query.plan === 'string' ? req.query.plan : '';
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (q) {
    where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR referral_code LIKE ?)');
    const like = `%${q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like, like);
  }
  if (plan === 'free' || plan === 'pro') {
    where.push('plan = ?');
    params.push(plan);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = scalar(`SELECT COUNT(*) AS n FROM users ${clause}`, ...params);
  const rows = db
    .prepare(`SELECT * FROM users ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as unknown as UserRow[];
  audit(req.user!.id, 'admin.users.list', null, { q, plan, page }, clientIp(req));
  res.json({ users: rows.map(adminUser), total, page, pageSize });
});

adminRouter.get('/users/:id', (req: AuthRequest, res) => {
  const user = findUserById(String(req.params.id));
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const foods = allFoods();
  const meals = db
    .prepare('SELECT * FROM meals WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 100')
    .all(user.id) as unknown as Array<{ id: string; food_id: string; grams: number; meal_type: string; date: string; source: string }>;
  const ledger = db
    .prepare('SELECT delta, reason, balance_after, created_at FROM token_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(user.id);
  const health = db
    .prepare('SELECT type, value, unit, measured_at FROM health_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT 200')
    .all(user.id) as unknown as Array<{ type: string; value: number; unit: string; measured_at: string }>;
  const healthSummary = [...new Set(health.map((h) => h.type))].map((type) => {
    const list = health.filter((h) => h.type === type).sort((a, b) => (a.measured_at < b.measured_at ? -1 : 1));
    const values = list.map((h) => h.value);
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return {
      type,
      count: values.length,
      latest: list[0]?.value ?? null,
      first: list.at(-1)?.value ?? null,
      mean: Math.round(mean * 10) / 10,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      trend: list.map((h) => ({ date: h.measured_at, value: h.value })),
      unit: list[0]?.unit ?? '',
    };
  });
  const mealTrend = db
    .prepare("SELECT date, COUNT(*) AS n, SUM(grams) AS grams FROM meals WHERE user_id = ? GROUP BY date ORDER BY date")
    .all(user.id);
  audit(req.user!.id, 'admin.users.view', user.id, {}, clientIp(req));
  res.json({
    user: adminUser(user),
    goal: {
      calorieTarget: user.calorie_target,
      proteinTarget: user.protein_target,
      carbsTarget: user.carbs_target,
      fatTarget: user.fat_target,
      fiberTarget: user.fiber_target,
      dailyBudgetIRR: user.daily_budget_irr,
      goalType: user.goal_type,
    },
    mealCount: scalar('SELECT COUNT(*) AS n FROM meals WHERE user_id = ?', user.id),
    activeDays: scalar('SELECT COUNT(DISTINCT date) AS n FROM meals WHERE user_id = ?', user.id),
    meals: meals.map((m) => ({ ...m, foodName: foods.get(m.food_id)?.nameFa ?? m.food_id })),
    mealTrend,
    health: healthSummary,
    ledger,
  });
});

const patchUserSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  plan: z.enum(['free', 'pro']).optional(),
  proUntil: z.string().datetime().nullable().optional(),
  status: z.enum(['active', 'blocked']).optional(),
  role: z.enum(['user', 'admin']).optional(),
});

adminRouter.patch('/users/:id', (req: AuthRequest, res) => {
  const input = parse(patchUserSchema, req.body);
  const target = findUserById(String(req.params.id));
  if (!target) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  if (target.id === req.user!.id && (input.status === 'blocked' || input.role === 'user')) {
    res.status(400).json({ error: 'نمی‌توانید دسترسی حساب خودتان را کم کنید' });
    return;
  }
  const columns: Record<string, string> = { name: 'name', plan: 'plan', proUntil: 'pro_until', status: 'status', role: 'role' };
  const entries = Object.entries(input).filter(([k, v]) => k in columns && v !== undefined);
  if (entries.length === 0) {
    res.status(400).json({ error: BAD_REQUEST });
    return;
  }
  db.prepare(`UPDATE users SET ${entries.map(([k]) => `${columns[k]} = ?`).join(', ')} WHERE id = ?`).run(
    ...entries.map(([, v]) => v as string | null),
    target.id,
  );
  if (input.status === 'blocked') revokeAllSessions(target.id);
  audit(req.user!.id, 'admin.users.update', target.id, input, clientIp(req));
  res.json({ user: adminUser(findUserById(target.id)!) });
});

adminRouter.post('/users/:id/tokens', (req: AuthRequest, res) => {
  const input = parse(z.object({ delta: z.number().int().min(-10000).max(10000).refine((n) => n !== 0), note: z.string().trim().max(120).optional() }), req.body);
  const target = findUserById(String(req.params.id));
  if (!target) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const result = addTokens(target.id, input.delta, 'admin-grant', randomUUID());
  if (!result.ok) {
    res.status(400).json({ error: 'موجودی ژتون برای این کسر کافی نیست' });
    return;
  }
  audit(req.user!.id, 'admin.tokens.grant', target.id, input, clientIp(req));
  trackEvent('club.admin_grant', target.id, { delta: input.delta });
  res.json({ balance: result.balance });
});

adminRouter.get('/meals', (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50) || 50));
  const params: Array<string | number> = [];
  const where: string[] = [];
  for (const [key, column] of [['userId', 'user_id'], ['foodId', 'food_id']] as const) {
    const value = req.query[key];
    if (typeof value === 'string' && value) {
      where.push(`${column} = ?`);
      params.push(value);
    }
  }
  if (typeof req.query.from === 'string') { where.push('date >= ?'); params.push(req.query.from); }
  if (typeof req.query.to === 'string') { where.push('date <= ?'); params.push(req.query.to); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = scalar(`SELECT COUNT(*) AS n FROM meals ${clause}`, ...params);
  const rows = db
    .prepare(`SELECT * FROM meals ${clause} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  audit(req.user!.id, 'admin.meals.list', null, { filters: req.query, page }, clientIp(req));
  res.json({ meals: rows, total, page, pageSize });
});

adminRouter.get('/audit', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100) || 100));
  res.json({ audit: db.prepare('SELECT admin_id, action, target, detail, ip, created_at FROM admin_audit ORDER BY created_at DESC LIMIT ?').all(limit) });
});

adminRouter.get('/club', (req: AuthRequest, res) => {
  const topReferrers = db
    .prepare(
      `SELECT u.name, u.referral_code, COUNT(*) AS invited,
              SUM(CASE WHEN r.status = 'rewarded' THEN 1 ELSE 0 END) AS rewarded
       FROM referrals r JOIN users u ON u.id = r.referrer_id
       GROUP BY r.referrer_id ORDER BY rewarded DESC, invited DESC LIMIT 10`,
    )
    .all();
  const byLevel = db.prepare('SELECT tokens_earned FROM users').all() as unknown as Array<{ tokens_earned: number }>;
  const levels: Record<string, number> = {};
  for (const row of byLevel) {
    const id = levelFor(row.tokens_earned).level.labelFa;
    levels[id] = (levels[id] ?? 0) + 1;
  }
  audit(req.user!.id, 'admin.club.view', null, {}, clientIp(req));
  res.json({ topReferrers, levels });
});

// ------------------------- دادهٔ پژوهشی -------------------------

interface ResearchRow {
  pseudoUser: string;
  userId: string;
  date: string;
  weekday: number;
  mealType: string;
  foodId: string;
  foodName: string;
  category: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  priceIRR: number;
  source: string;
  goalType: string;
  plan: string;
  calorieTargetBucket: number;
}

const researchQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scope: z.enum(['consented', 'all']).default('consented'),
  anonymize: z.enum(['true', 'false']).default('true'),
  format: z.enum(['csv', 'json']).default('csv'),
  reason: z.string().trim().min(10).max(300).optional(),
  minGroup: z.coerce.number().int().min(1).max(100).default(3),
  limit: z.coerce.number().int().min(1).max(500_000).default(200_000),
});

function pseudonym(userId: string): string {
  return createHmac('sha256', config.researchSecret).update(userId).digest('hex').slice(0, 12);
}

function loadResearchRows(query: z.infer<typeof researchQuerySchema>): ResearchRow[] {
  const foods = allFoods();
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.scope === 'consented') where.push('u.research_consent = 1');
  if (query.from) { where.push('m.date >= ?'); params.push(query.from); }
  if (query.to) { where.push('m.date <= ?'); params.push(query.to); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT m.id, m.user_id, m.food_id, m.grams, m.meal_type, m.date, m.source, m.created_at,
              u.goal_type, u.plan, u.pro_until, u.calorie_target
       FROM meals m JOIN users u ON u.id = m.user_id ${clause}
       ORDER BY m.date, m.created_at LIMIT ?`,
    )
    .all(...params, query.limit) as unknown as Array<{
    id: string; user_id: string; food_id: string; grams: number; meal_type: string; date: string; source: string; created_at: string;
    goal_type: string; plan: 'free' | 'pro'; pro_until: string | null; calorie_target: number;
  }>;
  const foodList = [...foods.values()];
  return rows.map((r) => {
    const entry: MealEntry = {
      id: r.id, userId: r.user_id, foodId: r.food_id, grams: r.grams,
      mealType: r.meal_type as MealEntry['mealType'], date: r.date, createdAt: r.created_at,
    };
    const n = entryNutrition(entry, foodList);
    const food = foods.get(r.food_id);
    return {
      pseudoUser: pseudonym(r.user_id),
      userId: r.user_id,
      date: r.date,
      weekday: new Date(`${r.date}T00:00:00Z`).getUTCDay(),
      mealType: r.meal_type,
      foodId: r.food_id,
      foodName: food?.nameFa ?? r.food_id,
      category: food?.category ?? 'unknown',
      grams: r.grams,
      kcal: n.kcal,
      protein: n.protein,
      carbs: n.carbs,
      fat: n.fat,
      fiber: n.fiber,
      priceIRR: entryPrice(entry, foodList),
      source: r.source,
      goalType: r.goal_type,
      plan: planOf({ plan: r.plan, pro_until: r.pro_until }),
      calorieTargetBucket: Math.round(r.calorie_target / 250) * 250,
    };
  });
}

function stats(values: number[]) {
  if (values.length === 0) return { n: 0, mean: null, median: null, p25: null, p75: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5))]!;
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    n: sorted.length,
    mean: Math.round(mean * 10) / 10,
    median: at(0.5),
    p25: at(0.25),
    p75: at(0.75),
    min: sorted[0]!,
    max: sorted.at(-1)!,
  };
}

/** گروه‌هایی که کمتر از `minGroup` کاربر متمایز دارند حذف می‌شوند (کاهش خطر شناسایی) */
function group<T extends string | number>(rows: ResearchRow[], key: (r: ResearchRow) => T, minGroup: number) {
  const map = new Map<T, ResearchRow[]>();
  for (const r of rows) {
    const k = key(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()]
    .map(([k, list]) => {
      const users = new Set(list.map((r) => r.pseudoUser)).size;
      if (users < minGroup) return { key: k, suppressed: true as const, users };
      return {
        key: k,
        suppressed: false as const,
        users,
        meals: list.length,
        kcal: stats(list.map((r) => r.kcal)),
        protein: stats(list.map((r) => r.protein)),
        grams: stats(list.map((r) => r.grams)),
      };
    })
    .sort((a, b) => ((b as { meals?: number }).meals ?? 0) - ((a as { meals?: number }).meals ?? 0));
}

adminRouter.get('/research/summary', (req: AuthRequest, res) => {
  const query = parse(researchQuerySchema, req.query);
  if (query.scope === 'all' && !query.reason) {
    res.status(400).json({ error: 'برای دسترسی به داده‌های همهٔ کاربران، دلیل استفاده را (حداقل ۱۰ نویسه) بنویسید' });
    return;
  }
  const rows = loadResearchRows(query);
  audit(req.user!.id, 'admin.research.summary', null, { ...query, rows: rows.length }, clientIp(req));
  const users = new Set(rows.map((r) => r.pseudoUser)).size;
  res.json({
    scope: query.scope,
    from: query.from ?? null,
    to: query.to ?? null,
    minGroup: query.minGroup,
    users,
    meals: rows.length,
    kcal: stats(rows.map((r) => r.kcal)),
    protein: stats(rows.map((r) => r.protein)),
    fiber: stats(rows.map((r) => r.fiber)),
    priceIRR: stats(rows.map((r) => r.priceIRR)),
    cameraShare: rows.length ? Math.round((rows.filter((r) => r.source === 'camera').length / rows.length) * 100) : 0,
    byMealType: group(rows, (r) => MEAL_LABELS[r.mealType] ?? r.mealType, query.minGroup),
    byGoalType: group(rows, (r) => r.goalType, query.minGroup),
    byCategory: group(rows, (r) => r.category, query.minGroup),
    byWeekday: group(rows, (r) => r.weekday, query.minGroup),
    byFood: group(rows, (r) => r.foodName, query.minGroup).slice(0, 25),
  });
});

const CSV_COLUMNS: Array<[keyof ResearchRow, string]> = [
  ['pseudoUser', 'pseudo_user'], ['date', 'date'], ['weekday', 'weekday'], ['mealType', 'meal_type'], ['foodId', 'food_id'],
  ['foodName', 'food_name'], ['category', 'category'], ['grams', 'grams'], ['kcal', 'kcal'], ['protein', 'protein_g'],
  ['carbs', 'carbs_g'], ['fat', 'fat_g'], ['fiber', 'fiber_g'], ['priceIRR', 'price_toman'], ['source', 'source'],
  ['goalType', 'goal_type'], ['plan', 'plan'], ['calorieTargetBucket', 'calorie_target_bucket'],
];

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportHandler(req: Request, res: import('express').Response): void {
  const authReq = req as AuthRequest;
  const query = parse(researchQuerySchema, req.query);
  const anonymize = query.anonymize === 'true';
  if ((query.scope === 'all' || !anonymize) && !query.reason) {
    res.status(400).json({ error: 'برای داده‌های همهٔ کاربران یا داده‌های غیرناشناس، دلیل استفاده را (حداقل ۱۰ نویسه) بنویسید' });
    return;
  }
  const rows = loadResearchRows(query);
  audit(authReq.user!.id, 'admin.research.export', null, { ...query, anonymize, rows: rows.length }, clientIp(req));
  const stamp = today();
  const mapped = rows.map((r) => (anonymize ? { ...r, userId: undefined } : r));
  if (query.format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="boshghabyar-research-${stamp}.json"`);
    res.json({
      generatedAt: new Date().toISOString(),
      anonymized: anonymize,
      scope: query.scope,
      rows: mapped.map((r) => (anonymize ? Object.fromEntries(CSV_COLUMNS.map(([k, name]) => [name, r[k]])) : r)),
    });
    return;
  }
  const header = anonymize ? CSV_COLUMNS.map(([, n]) => n) : ['user_id', ...CSV_COLUMNS.map(([, n]) => n)];
  const lines = [header.join(',')];
  for (const r of rows) {
    const cells = CSV_COLUMNS.map(([k]) => csvCell(r[k] as string | number));
    lines.push((anonymize ? cells : [csvCell(r.userId), ...cells]).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="boshghabyar-research-${stamp}.csv"`);
  res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
}

adminRouter.get('/research/export', exportHandler);
