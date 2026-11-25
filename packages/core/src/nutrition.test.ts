import assert from 'node:assert/strict';
import test from 'node:test';

import { FOODS, FOODS_BY_ID } from './foods.js';
import { buildTrend, entryNutrition, scaleMacros, suggestAlternatives, summarizeDay } from './nutrition.js';
import { hasFeature, historyCutoffDate } from './plan.js';
import { DEFAULT_GOAL } from './types.js';
import type { MealEntry } from './types.js';

const entry = (foodId: string, grams: number, date = '2026-11-25'): MealEntry => ({
  id: `${foodId}-${grams}`,
  userId: 'u-test',
  foodId,
  grams,
  mealType: 'lunch',
  date,
  createdAt: `${date}T12:00:00.000Z`,
});

test('بانک غذا شامل ۲۰ غذای رایگان و حداقل ۵ غذای Pro است', () => {
  assert.equal(FOODS.filter((f) => f.free).length, 20);
  assert.ok(FOODS.filter((f) => !f.free).length >= 5);
  assert.equal(new Set(FOODS.map((f) => f.id)).size, FOODS.length);
});

test('محاسبه ارزش غذایی بر اساس وزن، خطی و گردشده است', () => {
  const macros = scaleMacros(FOODS_BY_ID['chelow-kebab-koobideh']!.per100g, 250);
  assert.equal(macros.kcal, 575);
  assert.equal(macros.protein, 55);
  assert.deepEqual(entryNutrition(entry('chelow-kebab-koobideh', 250)), macros);
});

test('خلاصه روزانه کالری، هزینه و وضعیت را درست محاسبه میکند', () => {
  const entries = [entry('chelow-kebab-koobideh', 200), entry('sib', 150)];
  const summary = summarizeDay(entries, DEFAULT_GOAL, '2026-11-25');
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.totals.kcal, 460 + 78);
  assert.ok(summary.remaining.budget < DEFAULT_GOAL.dailyBudgetIRR);
  assert.equal(summary.status, 'below');
});

test('پیشنهاد جایگزین برای هدف بودجه، غذای ارزانتر و معتبر برمیگرداند', () => {
  const suggestions = suggestAlternatives({
    entry: entry('chelow-kebab-koobideh', 250),
    goal: { ...DEFAULT_GOAL, goalType: 'budget', dailyBudgetIRR: 200000 },
    plan: 'free',
  });
  assert.ok(suggestions.length >= 1);
  assert.ok(suggestions.every((s) => s.toFoodId !== 'chelow-kebab-koobideh'));
  assert.ok(suggestions.some((s) => s.delta.priceIRR < 0));
  assert.ok(suggestions.every((s) => FOODS_BY_ID[s.toFoodId]?.free === true));
});

test('نسخه رایگان نباید غذاهای حرفهای را پیشنهاد دهد و نسخه حرفهای میدهد', () => {
  const params = {
    entry: entry('chelow-kebab-koobideh', 250),
    goal: DEFAULT_GOAL,
    plan: 'free' as const,
  };
  const freeIds = suggestAlternatives(params).map((s) => s.toFoodId);
  const proIds = suggestAlternatives({ ...params, plan: 'pro' }).map((s) => s.toFoodId);
  assert.ok(freeIds.every((id) => FOODS_BY_ID[id]?.free));
  assert.ok(proIds.length >= freeIds.length);
});

test('روند هفت روزه روزهای بدون وعده را هم شامل میشود', () => {
  const trend = buildTrend([entry('sib', 150, '2026-11-25')], '2026-11-19', 7);
  assert.equal(trend.length, 7);
  assert.equal(trend.at(-1)?.kcal, 78);
  assert.equal(trend[0]?.entryCount, 0);
});

test('دسترسیهای نسخه و محدودیت تاریخچه', () => {
  assert.equal(hasFeature('free', 'advancedAnalytics'), false);
  assert.equal(hasFeature('pro', 'advancedAnalytics'), true);
  assert.equal(historyCutoffDate('pro'), null);
  assert.ok(historyCutoffDate('free'));
});
