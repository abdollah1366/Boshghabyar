import assert from 'node:assert/strict';
import test from 'node:test';

import { LEVELS, REWARDS, TOKEN_RULES, isValidReferralCode, levelFor, nextStreak, normalizeReferralCode, referralCodeFromBytes } from './club.js';
import { maskPhone, normalizeIranPhone, toLatinDigits } from './phone.js';
import { effectivePlan, hasFeature } from './plan.js';
import { buildBasicReport, buildDetailedReport } from './reports.js';
import { DEFAULT_GOAL } from './types.js';
import type { MealEntry } from './types.js';

const entry = (foodId: string, grams: number, date: string, mealType: MealEntry['mealType'] = 'lunch'): MealEntry => ({
  id: `${foodId}-${grams}-${date}-${mealType}`,
  userId: 'u',
  foodId,
  grams,
  mealType,
  date,
  createdAt: `${date}T12:00:00.000Z`,
});

test('شمارهٔ موبایل در قالب‌های مختلف نرمال می‌شود', () => {
  assert.equal(normalizeIranPhone('09141199762'), '09141199762');
  assert.equal(normalizeIranPhone('۰۹۱۴۱۱۹۹۷۶۲'), '09141199762');
  assert.equal(normalizeIranPhone('+98 914 119 9762'), '09141199762');
  assert.equal(normalizeIranPhone('00989141199762'), '09141199762');
  assert.equal(normalizeIranPhone('9141199762'), '09141199762');
  assert.equal(normalizeIranPhone('0214119'), null);
  assert.equal(normalizeIranPhone('abc'), null);
  assert.equal(toLatinDigits('٠١٢۳۴'), '01234');
  assert.equal(maskPhone('09141199762'), '0914***9762');
});

test('طرح مؤثر: Pro موقت تا زمان انقضا فعال است', () => {
  const at = new Date('2026-11-26T00:00:00Z');
  assert.equal(effectivePlan('free', null, at), 'free');
  assert.equal(effectivePlan('free', '2026-11-27T00:00:00Z', at), 'pro');
  assert.equal(effectivePlan('free', '2026-11-25T00:00:00Z', at), 'free');
  assert.equal(effectivePlan('pro', null, at), 'pro');
  assert.equal(hasFeature('free', 'detailedReports'), false);
  assert.equal(hasFeature('pro', 'detailedReports'), true);
  assert.equal(hasFeature('free', 'dataExport'), false);
});

test('سطح باشگاه بر اساس ژتون کسب‌شده محاسبه می‌شود', () => {
  assert.equal(levelFor(0).level.id, 'bronze');
  assert.equal(levelFor(199).level.id, 'bronze');
  assert.equal(levelFor(200).level.id, 'silver');
  assert.equal(levelFor(5000).level.id, 'diamond');
  assert.equal(levelFor(5000).next, null);
  assert.equal(levelFor(100).progressPct, 50);
  assert.equal(LEVELS.length, 4);
  assert.ok(REWARDS.every((r) => r.costTokens > 0 && r.proDays > 0));
  assert.ok(TOKEN_RULES.referralInviter > TOKEN_RULES.referralInvitee);
});

test('کد معرف معتبر و بدون نویسهٔ مبهم ساخته می‌شود', () => {
  const code = referralCodeFromBytes(Uint8Array.from([1, 2, 3, 4, 5, 6, 7]));
  assert.equal(code.length, 7);
  assert.ok(isValidReferralCode(code));
  assert.ok(isValidReferralCode(` ${code.toLowerCase()} `));
  assert.equal(normalizeReferralCode(' ab-c '), 'ABC');
  assert.equal(isValidReferralCode('0OIL1AB'), false);
});

test('زنجیرهٔ روزهای متوالی', () => {
  assert.equal(nextStreak(null, '2026-11-26', 0), 1);
  assert.equal(nextStreak('2026-11-25', '2026-11-26', 3), 4);
  assert.equal(nextStreak('2026-11-26', '2026-11-26', 3), 3);
  assert.equal(nextStreak('2026-11-20', '2026-11-26', 3), 1);
});

test('گزارش رایگان فقط میانگین و روزهای فعال را می‌دهد', () => {
  const report = buildBasicReport([entry('sib', 150, '2026-11-25'), entry('sib', 150, '2026-11-24')], '2026-11-20', 7);
  assert.equal(report.activeDays, 2);
  assert.equal(report.totalMeals, 2);
  assert.equal(report.averageKcal, 78);
  assert.equal(report.days, 7);
  assert.ok(!('macroSplit' in report));
});

test('گزارش تکمیلی تعیین‌پذیر است و بخش‌های پولی را می‌سازد', () => {
  const entries = [
    entry('chelow-kebab-koobideh', 250, '2026-11-24', 'lunch'),
    entry('sib', 150, '2026-11-24', 'snack'),
    entry('ghormeh-sabzi', 300, '2026-11-25', 'dinner'),
    entry('sib', 100, '2026-11-26', 'snack'),
  ];
  const a = buildDetailedReport(entries, DEFAULT_GOAL, '2026-11-20', 7);
  const b = buildDetailedReport(entries, DEFAULT_GOAL, '2026-11-20', 7);
  assert.deepEqual(a, b);
  assert.equal(a.days, 7);
  assert.equal(a.activeDays, 3);
  assert.equal(a.totalMeals, 4);
  assert.equal(a.trend.length, 7);
  assert.equal(a.longestStreak, 3);
  assert.equal(a.macroSplit.proteinPct + a.macroSplit.carbsPct + a.macroSplit.fatPct >= 98, true);
  assert.equal(a.mealTypes.length, 4);
  assert.ok(a.topFoods.length >= 1 && a.topFoods[0]!.count >= 1);
  assert.ok(a.score >= 0 && a.score <= 100);
  assert.ok(a.insights.length >= 1);
});

test('گزارش تکمیلی برای بازهٔ خالی خطا نمی‌دهد', () => {
  const report = buildDetailedReport([], DEFAULT_GOAL, '2026-11-20', 7);
  assert.equal(report.activeDays, 0);
  assert.equal(report.score, 0);
  assert.equal(report.bestDay, null);
  assert.equal(report.insights.length, 1);
});
