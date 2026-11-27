import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { TOKEN_RULES } from '@boshghabyar/core';

import { authRequired, publicUser } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { addTokens } from '../club.js';
import { db, findUserById, now, today, trackEvent } from '../db.js';
import { parse } from '../domain.js';

const HEALTH_TYPES = [
  'blood_sugar',
  'weight',
  'height',
  'systolic_bp',
  'diastolic_bp',
  'hba1c',
  'heart_rate',
  'cholesterol',
  'sleep_hours',
] as const;

const UNITS: Record<string, string> = {
  blood_sugar: 'mg/dL',
  weight: 'kg',
  height: 'cm',
  systolic_bp: 'mmHg',
  diastolic_bp: 'mmHg',
  hba1c: '%',
  heart_rate: 'bpm',
  cholesterol: 'mg/dL',
  sleep_hours: 'h',
};

const LABELS: Record<string, string> = {
  blood_sugar: 'قند خون',
  weight: 'وزن',
  height: 'قد',
  systolic_bp: 'فشار سیستولیک',
  diastolic_bp: 'فشار دیاستولیک',
  hba1c: 'هموگلوبین A1c',
  heart_rate: 'ضربان قلب',
  cholesterol: 'کلسترول',
  sleep_hours: 'ساعت خواب',
};

export const healthRouter = Router();
healthRouter.use(authRequired);

healthRouter.get('/types', (_req, res) => {
  res.json({ types: HEALTH_TYPES.map((type) => ({ type, labelFa: LABELS[type], unit: UNITS[type] })) });
});

const measurementSchema = z.object({
  type: z.enum(HEALTH_TYPES),
  value: z.number().min(0).max(10000),
  unit: z.string().max(12).optional(),
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(120).optional(),
});

healthRouter.post('/measurements', (req: AuthRequest, res) => {
  const input = parse(measurementSchema, req.body);
  const user = req.user!;
  const id = randomUUID();
  const measuredAt = input.measuredAt ?? today();
  const unit = input.unit ?? UNITS[input.type];
  db.prepare(
    'INSERT INTO health_measurements (id, user_id, type, value, unit, measured_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, user.id, input.type, input.value, unit, measuredAt, now());

  // ژتون پایه برای ثبت
  const logReward = addTokens(user.id, TOKEN_RULES.healthLog, 'health-log', `${input.type}:${measuredAt}`);
  // پاداش زنجیره: ۷ روز پیاپی ثبتِ هر نوع
  const recentDays = (
    db
      .prepare(
        'SELECT COUNT(DISTINCT measured_at) AS n FROM health_measurements WHERE user_id = ? AND measured_at >= ?',
      )
      .get(user.id, new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)) as { n: number }
  ).n;
  let streakReward = 0;
  if (recentDays >= 7) {
    const r = addTokens(user.id, TOKEN_RULES.healthStreak, 'health-streak', measuredAt.slice(0, 7));
    if (r.ok) streakReward = TOKEN_RULES.healthStreak;
  }
  trackEvent('health.measured', user.id, { type: input.type, value: input.value });
  res.status(201).json({
    id,
    type: input.type,
    value: input.value,
    unit,
    measuredAt,
    tokensEarned: (logReward.ok ? TOKEN_RULES.healthLog : 0) + streakReward,
    balance: logReward.balance,
    user: publicUser(findUserById(user.id)!),
  });
});

healthRouter.get('/measurements', (req: AuthRequest, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100) || 100));
  const where: string[] = ['user_id = ?'];
  const params: Array<string | number> = [req.user!.id];
  if (type) { where.push('type = ?'); params.push(type); }
  if (from) { where.push('measured_at >= ?'); params.push(from); }
  if (to) { where.push('measured_at <= ?'); params.push(to); }
  const rows = db
    .prepare(`SELECT id, type, value, unit, measured_at, created_at FROM health_measurements WHERE ${where.join(' AND ')} ORDER BY measured_at DESC, created_at DESC LIMIT ?`)
    .all(...params, limit);
  res.json({ measurements: rows, count: rows.length });
});

healthRouter.delete('/measurements/:id', (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM health_measurements WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'رکورد پیدا نشد' });
    return;
  }
  res.status(204).end();
});

/** خلاصهٔ روند هفتگی/ماهانه برای هر نوع اندازه‌گیری */
healthRouter.get('/summary', (req: AuthRequest, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days ?? 30) || 30));
  const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = db
    .prepare('SELECT type, value, measured_at FROM health_measurements WHERE user_id = ? AND measured_at >= ? ORDER BY measured_at')
    .all(req.user!.id, from) as unknown as Array<{ type: string; value: number; measured_at: string }>;

  const byType = new Map<string, Array<{ value: number; date: string }>>();
  for (const r of rows) {
    const list = byType.get(r.type) ?? [];
    list.push({ value: r.value, date: r.measured_at });
    byType.set(r.type, list);
  }

  const summary = [...byType.entries()].map(([type, list]) => {
    const values = list.map((x) => x.value);
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const at = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5))] ?? 0;
    return {
      type,
      labelFa: LABELS[type] ?? type,
      unit: UNITS[type] ?? '',
      count: values.length,
      latest: list.at(-1)?.value ?? null,
      latestDate: list.at(-1)?.date ?? null,
      mean: Math.round(mean * 10) / 10,
      min: sorted.length ? sorted[0] : null,
      max: sorted.length ? sorted.at(-1) : null,
      median: sorted.length ? at(0.5) : null,
      trend: list.map((x) => ({ date: x.date, value: x.value })),
    };
  });

  res.json({ days, from, summary });
});
