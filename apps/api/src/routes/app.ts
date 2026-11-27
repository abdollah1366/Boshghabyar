import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import {
  buildExplanationPrompt,
  buildMealPlan,
  hasFeature,
  historyCutoffDate,
  suggestAlternatives,
} from '@boshghabyar/core';
import { TOKEN_RULES } from '@boshghabyar/core';

import { authRequired, publicUser } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { addTokens, awardFirstMealOfDay, rewardReferrerIfFirstMeal } from '../club.js';
import { config } from '../config.js';
import { db, findUserById, now, planOf, today, trackEvent } from '../db.js';
import type { MealRow } from '../db.js';
import { addDays, foodsFor, goalOf, mealRowToEntry, mealsOf, parse, sharedFoods } from '../domain.js';

export const appRouter = Router();
appRouter.use(authRequired);

appRouter.get('/foods', (req: AuthRequest, res) => {
  const foods = foodsFor(req.user!);
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.json({ foods, count: foods.length, plan: planOf(req.user!) });
});

const customFoodSchema = z.object({
  nameFa: z.string().trim().min(2).max(80),
  category: z.enum(['main', 'rice', 'soup', 'bread', 'dairy', 'egg', 'fruit', 'legume', 'local']),
  per100g: z.object({
    kcal: z.number().min(0).max(1000),
    protein: z.number().min(0).max(100),
    carbs: z.number().min(0).max(100),
    fat: z.number().min(0).max(100),
    fiber: z.number().min(0).max(100),
  }),
  servingGrams: z.number().int().min(1).max(2000),
  servingLabel: z.string().trim().min(1).max(60),
  priceIRR: z.number().int().min(0).max(10_000_000),
});

appRouter.post('/foods/custom', (req: AuthRequest, res) => {
  if (!hasFeature(planOf(req.user!), 'customFoods')) {
    res.status(403).json({ error: 'افزودن غذای سفارشی مخصوص نسخهٔ حرفه‌ای است', upgradeRequired: true });
    return;
  }
  const input = parse(customFoodSchema, req.body);
  const id = `custom-${randomUUID()}`;
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

// ---------- جمع‌سپاری غذا با بارکد ----------

const normalizeBarcode = (input: string): string => input.replace(/\D/g, '');

const scanFoodSchema = z.object({
  barcode: z.string().min(4).max(20).transform(normalizeBarcode).refine((v) => /^\d{4,20}$/.test(v), 'بارکد معتبر نیست'),
  nameFa: z.string().trim().min(2).max(80),
  category: z.enum(['main', 'rice', 'soup', 'bread', 'dairy', 'egg', 'fruit', 'legume', 'local']).default('local'),
  kcalPer100g: z.number().min(0).max(900),
  servingGrams: z.number().int().min(1).max(2000).default(100),
  servingLabel: z.string().trim().min(1).max(60).default('سهم'),
  priceIRR: z.number().int().min(0).max(10_000_000).optional(),
});

appRouter.post('/foods/scan', (req: AuthRequest, res) => {
  const input = parse(scanFoodSchema, req.body);
  const user = req.user!;

  // اگر بارکد از قبل ثبت شده باشد، همان غذا برمی‌گردد (بدون ژتون تکراری)
  const existing = db
    .prepare('SELECT * FROM custom_foods WHERE barcode = ?')
    .get(input.barcode) as unknown as
    | { id: string; user_id: string; name_fa: string; category: string; per100g: string; serving_grams: number; serving_label: string; price_irr: number }
    | undefined;
  if (existing) {
    res.json({
      id: existing.id,
      alreadyExists: true,
      nameFa: existing.name_fa,
      kcalPer100g: JSON.parse(existing.per100g).kcal,
      servingGrams: existing.serving_grams,
    });
    return;
  }

  const id = `scan-${randomUUID()}`;
  const per100g = {
    kcal: input.kcalPer100g,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  };
  db.prepare(`
    INSERT INTO custom_foods (id, user_id, name_fa, category, per100g, serving_grams, serving_label, price_irr, barcode, shared, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id, user.id, input.nameFa, input.category, JSON.stringify(per100g),
    input.servingGrams, input.servingLabel, input.priceIRR ?? 0, input.barcode, now(),
  );

  const reward = addTokens(user.id, TOKEN_RULES.foodContribution, 'food-contribution', input.barcode);
  trackEvent('food.contributed', user.id, { barcode: input.barcode, foodId: id });
  res.status(201).json({
    id,
    alreadyExists: false,
    nameFa: input.nameFa,
    kcalPer100g: input.kcalPer100g,
    servingGrams: input.servingGrams,
    tokensEarned: reward.ok ? TOKEN_RULES.foodContribution : 0,
    balance: reward.balance,
  });
});

appRouter.get('/foods/barcode/:barcode', (req: AuthRequest, res) => {
  const barcode = normalizeBarcode(req.params.barcode ?? '');
  const row = db
    .prepare('SELECT * FROM custom_foods WHERE barcode = ?')
    .get(barcode) as unknown as
    | { id: string; name_fa: string; category: string; per100g: string; serving_grams: number; serving_label: string; price_irr: number }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'این بارکد در پایگاه‌داده ثبت نشده است' });
    return;
  }
  res.json({ id: row.id, nameFa: row.name_fa, kcalPer100g: JSON.parse(row.per100g).kcal, servingGrams: row.serving_grams, servingLabel: row.serving_label, priceIRR: row.price_irr });
});

// ---------- برنامهٔ غذایی هفتگی ----------

appRouter.get('/mealplan', (req: AuthRequest, res) => {
  const days = Math.min(14, Math.max(1, Number(req.query.days ?? 7) || 7));
  const user = req.user!;
  const plan = buildMealPlan(days, goalOf(user));
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.json({ plan, planAvailable: true, goal: goalOf(user) });
});

const mealSchema = z.object({
  foodId: z.string().min(1).max(120),
  grams: z.number().int().min(1).max(3000),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(['manual', 'camera']).optional(),
});

appRouter.get('/meals', (req: AuthRequest, res) => {
  const user = req.user!;
  const cutoff = historyCutoffDate(planOf(user));
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const effectiveFrom = cutoff ? (from && from > cutoff ? from : cutoff) : from;
  const entries = mealsOf(user.id, effectiveFrom, to);
  res.json({ meals: entries, count: entries.length, historyLimited: Boolean(cutoff), foods: foodsFor(user) });
});

appRouter.post('/meals', (req: AuthRequest, res) => {
  const input = parse(mealSchema, req.body);
  const user = req.user!;
  if (!foodsFor(user).some((f) => f.id === input.foodId)) {
    res.status(400).json({ error: 'این غذا در نسخهٔ شما در دسترس نیست' });
    return;
  }
  const date = input.date ?? today();
  if (date > addDays(today(), 1) || date < addDays(today(), -400)) {
    res.status(400).json({ error: 'تاریخ وعده معتبر نیست' });
    return;
  }
  const id = randomUUID();
  const isFirstEver = !db.prepare('SELECT 1 AS x FROM meals WHERE user_id = ? LIMIT 1').get(user.id);
  db.prepare('INSERT INTO meals (id, user_id, food_id, grams, meal_type, date, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, user.id, input.foodId, input.grams, input.mealType, date, input.source ?? 'manual', now());
  trackEvent('meal.created', user.id, { foodId: input.foodId, grams: input.grams, mealType: input.mealType, source: input.source ?? 'manual' });

  let tokensEarned = awardFirstMealOfDay(user.id, today());
  if (isFirstEver) rewardReferrerIfFirstMeal(user.id);
  res.status(201).json({ id, date, tokensEarned, balance: findUserById(user.id)!.token_balance });
});

appRouter.delete('/meals/:id', (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'وعده پیدا نشد' });
    return;
  }
  trackEvent('meal.deleted', req.user!.id, { id: req.params.id });
  res.status(204).end();
});

appRouter.get('/recommendations/:mealId', (req: AuthRequest, res) => {
  const user = req.user!;
  const plan = planOf(user);
  const row = db.prepare('SELECT * FROM meals WHERE id = ? AND user_id = ?').get(req.params.mealId, user.id) as MealRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'وعده پیدا نشد' });
    return;
  }
  const foods = foodsFor(user);
  const suggestions = suggestAlternatives({ entry: mealRowToEntry(row), goal: goalOf(user), plan, foods });
  const enriched = suggestions.map((suggestion) => {
    const from = foods.find((f) => f.id === suggestion.fromFoodId)!;
    const to = foods.find((f) => f.id === suggestion.toFoodId)!;
    return {
      ...suggestion,
      prompt: hasFeature(plan, 'aiExplanations') ? buildExplanationPrompt(suggestion, from, to) : null,
    };
  });
  trackEvent('recommendation.viewed', user.id, { mealId: row.id, count: enriched.length });
  res.json({ suggestions: enriched, deterministic: true });
});

appRouter.post('/upgrade', (req: AuthRequest, res) => {
  if (!config.allowMockUpgrade) {
    res.status(501).json({ error: 'پرداخت آنلاین به‌زودی فعال می‌شود. فعلاً می‌توانید با ژتون باشگاه، نسخهٔ حرفه‌ای را فعال کنید.' });
    return;
  }
  const input = parse(z.object({ plan: z.literal('pro'), reference: z.string().max(80).optional() }), req.body);
  const user = req.user!;
  if (user.plan === 'pro') {
    res.json({ user: publicUser(user), alreadyPro: true });
    return;
  }
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(input.plan, user.id);
  db.prepare('INSERT INTO subscriptions (id, user_id, plan, provider, reference, amount_irr, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), user.id, 'pro', 'mock', input.reference ?? 'demo-upgrade', 0, now());
  trackEvent('plan.upgraded', user.id, { from: 'free', to: 'pro', provider: 'mock' });
  res.json({ user: publicUser(findUserById(user.id)!), alreadyPro: false, mock: true });
});

const eventSchema = z.object({
  type: z.string().regex(/^[a-z0-9_.-]{1,80}$/i),
  payload: z.record(z.string(), z.unknown()).optional(),
});

appRouter.post('/events', (req: AuthRequest, res) => {
  const input = parse(eventSchema, req.body);
  const payload = JSON.stringify(input.payload ?? {});
  if (payload.length > 2000) {
    res.status(413).json({ error: 'حجم رویداد بیش از حد مجاز است' });
    return;
  }
  trackEvent(input.type, req.user!.id, input.payload ?? {});
  res.status(202).json({ ok: true });
});
