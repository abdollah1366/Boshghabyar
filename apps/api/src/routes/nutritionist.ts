import { Router } from 'express';
import { z } from 'zod';

import { buildBasicReport, buildTrend, summarizeDay } from '@boshghabyar/core';

import { authRequired, nutritionistRequired, publicUser } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { db, findUserByNutritionistCode, findUserById, today, trackEvent } from '../db.js';
import { foodsFor, goalOf, mealsOf, parse } from '../domain.js';

export const nutritionistRouter = Router();

/** کاربر با کد متخصص، خودش را به متخصص وصل می‌کند */
nutritionistRouter.post('/me/connect', authRequired, (req: AuthRequest, res) => {
  const input = parse(z.object({ code: z.string().trim().min(4).max(20) }), req.body);
  const nutritionist = findUserByNutritionistCode(input.code.trim().toUpperCase());
  if (!nutritionist) {
    res.status(404).json({ error: 'کد متخصص تغذیه معتبر نیست' });
    return;
  }
  if (nutritionist.id === req.user!.id) {
    res.status(400).json({ error: 'نمی‌توانید به خودتان وصل شوید' });
    return;
  }
  db.prepare('UPDATE users SET nutritionist_id = ? WHERE id = ?').run(nutritionist.id, req.user!.id);
  trackEvent('nutritionist.connected', req.user!.id, { nutritionistId: nutritionist.id });
  res.json({ ok: true, nutritionist: { id: nutritionist.id, name: nutritionist.name } });
});

nutritionistRouter.get('/me/status', authRequired, (req: AuthRequest, res) => {
  const user = req.user!;
  const nutritionist = user.nutritionist_id ? findUserById(user.nutritionist_id) : null;
  res.json({
    isNutritionist: user.role === 'nutritionist',
    connected: Boolean(nutritionist),
    nutritionist: nutritionist ? { id: nutritionist.id, name: nutritionist.name } : null,
  });
});

// ---------- پنل متخصص (فقط نقش nutritionist یا admin) ----------

function clientSummary(clientId: string) {
  const user = findUserById(clientId)!;
  const foods = foodsFor(user);
  const entries = mealsOf(clientId);
  const summary = summarizeDay(entries, goalOf(user), today(), foods);
  const from = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const trend = buildTrend(entries, from, 7, foods);
  const basic = buildBasicReport(entries, from, 7, foods);
  return {
    id: user.id,
    name: user.name,
    plan: user.plan,
    goalType: user.goal_type,
    goal: goalOf(user),
    today: { kcal: summary.totals.kcal, entryCount: summary.entryCount, status: summary.status },
    week: { averageKcal: basic.averageKcal, activeDays: basic.activeDays, totalMeals: basic.totalMeals },
    trend: trend.map((p) => ({ date: p.date, kcal: p.kcal, protein: p.protein, budget: p.budget, entryCount: p.entryCount })),
    lastMeals: entries.slice(0, 5).map((m) => ({ id: m.id, foodId: m.foodId, foodName: foods.find((f) => f.id === m.foodId)?.nameFa ?? m.foodId, grams: m.grams, mealType: m.mealType, date: m.date })),
  };
}

nutritionistRouter.get('/clients', nutritionistRequired, (req: AuthRequest, res) => {
  const me = req.user!;
  const rows = db.prepare('SELECT id FROM users WHERE nutritionist_id = ? ORDER BY created_at DESC').all(me.id) as unknown as Array<{ id: string }>;
  res.json({ clients: rows.map((r) => clientSummary(r.id)) });
});

nutritionistRouter.get('/clients/:id', nutritionistRequired, (req: AuthRequest, res) => {
  const me = req.user!;
  const client = findUserById(String(req.params.id));
  if (!client || (client.nutritionist_id !== me.id && me.role !== 'admin')) {
    res.status(404).json({ error: 'مراجع پیدا نشد' });
    return;
  }
  res.json({ client: clientSummary(client.id) });
});
