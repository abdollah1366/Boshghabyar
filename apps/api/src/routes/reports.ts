import { Router } from 'express';

import {
  DETAILED_REPORT_SECTIONS,
  PLAN_LIMITS,
  buildBasicReport,
  buildDetailedReport,
  buildTrend,
  entryNutrition,
  entryPrice,
  hasFeature,
  historyCutoffDate,
  summarizeDay,
} from '@boshghabyar/core';

import { authRequired } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { db, planOf, today, trackEvent } from '../db.js';
import { addDays, foodsFor, goalOf, mealsOf } from '../domain.js';

export const reportsRouter = Router();
reportsRouter.use(authRequired);

const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

reportsRouter.get('/daily', (req: AuthRequest, res) => {
  const user = req.user!;
  const date = isDate(req.query.date) ? req.query.date : today();
  const entries = mealsOf(user.id, date, date);
  res.json({ report: summarizeDay(entries, goalOf(user), date, foodsFor(user)), meals: entries });
});

/** گزارش هفتگی رایگان (جزئی) */
reportsRouter.get('/weekly', (req: AuthRequest, res) => {
  const user = req.user!;
  const plan = planOf(user);
  const days = Math.min(30, Math.max(1, Number(req.query.days ?? 7) || 7));
  const from = isDate(req.query.from) ? req.query.from : addDays(today(), -(days - 1));
  const cutoff = historyCutoffDate(plan);
  const effectiveFrom = cutoff && from < cutoff ? cutoff : from;
  const foods = foodsFor(user);
  const entries = mealsOf(user.id, effectiveFrom);
  const trend = buildTrend(entries, effectiveFrom, days, foods);
  const basic = buildBasicReport(entries, effectiveFrom, days, foods);
  res.json({
    trend,
    summary: {
      averageKcal: basic.averageKcal,
      averageProtein: basic.averageProtein,
      activeDays: basic.activeDays,
      totalMeals: basic.totalMeals,
      budgetUsedIRR: basic.budgetUsedIRR,
    },
    insight: basic.insightFa,
    advanced: hasFeature(plan, 'detailedReports'),
  });
});

/**
 * گزارش تکمیلی (پولی). کاربر رایگان فقط فهرست بخش‌های قفل‌شده را می‌بیند؛
 * هیچ دادهٔ تحلیلی پولی از سرور خارج نمی‌شود.
 */
reportsRouter.get('/detailed', (req: AuthRequest, res) => {
  const user = req.user!;
  const plan = planOf(user);
  if (!hasFeature(plan, 'detailedReports')) {
    res.json({
      locked: true,
      upgradeRequired: true,
      sections: DETAILED_REPORT_SECTIONS,
      maxDays: PLAN_LIMITS.pro.maxReportDays,
      messageFa: 'گزارش تکمیلی با نسخهٔ حرفه‌ای یا با ژتون باشگاه مشتریان فعال می‌شود.',
    });
    return;
  }
  const max = PLAN_LIMITS[plan].maxReportDays;
  const days = Math.min(max, Math.max(1, Number(req.query.days ?? 30) || 30));
  const from = addDays(today(), -(days - 1));
  const report = buildDetailedReport(mealsOf(user.id, from), goalOf(user), from, days, foodsFor(user));
  trackEvent('report.detailed_viewed', user.id, { days });
  res.json({ locked: false, report });
});

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** خروجی CSV وعده‌های خود کاربر (فقط نسخهٔ حرفه‌ای) */
reportsRouter.get('/export.csv', (req: AuthRequest, res) => {
  const user = req.user!;
  if (!hasFeature(planOf(user), 'dataExport')) {
    res.status(403).json({ error: 'خروجی CSV مخصوص نسخهٔ حرفه‌ای است', upgradeRequired: true });
    return;
  }
  const days = Math.min(PLAN_LIMITS.pro.maxReportDays * 4, Math.max(1, Number(req.query.days ?? 90) || 90));
  const foods = foodsFor(user);
  const entries = mealsOf(user.id, addDays(today(), -(days - 1))).reverse();
  const rows = [['تاریخ', 'وعده', 'غذا', 'گرم', 'کیلوکالری', 'پروتئین', 'کربوهیدرات', 'چربی', 'فیبر', 'هزینه (تومان)']];
  const labels: Record<string, string> = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده' };
  for (const e of entries) {
    const n = entryNutrition(e, foods);
    rows.push([
      e.date,
      labels[e.mealType] ?? e.mealType,
      foods.find((f) => f.id === e.foodId)?.nameFa ?? e.foodId,
      String(e.grams),
      String(n.kcal),
      String(n.protein),
      String(n.carbs),
      String(n.fat),
      String(n.fiber),
      String(entryPrice(e, foods)),
    ]);
  }
  trackEvent('report.exported', user.id, { rows: rows.length - 1 });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="boshghabyar-meals.csv"');
  res.send(`\uFEFF${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`);
});

void db;
