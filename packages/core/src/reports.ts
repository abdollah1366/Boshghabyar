import { FOODS_BY_ID } from './foods.js';
import { entryNutrition, entryPrice } from './nutrition.js';
import type { Food, Macros, MealEntry, MealType, UserGoal } from './types.js';
import { EMPTY_MACROS } from './types.js';

const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'صبحانه',
  lunch: 'ناهار',
  dinner: 'شام',
  snack: 'میان‌وعده',
};

function dateRange(fromDate: string, days: number): string[] {
  const start = new Date(`${fromDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];
  return Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

export interface BasicReport {
  from: string;
  to: string;
  days: number;
  averageKcal: number;
  averageProtein: number;
  activeDays: number;
  totalMeals: number;
  budgetUsedIRR: number;
  insightFa: string;
}

/** گزارش جزئی و رایگان: میانگین‌ها و تعداد روزهای فعال */
export function buildBasicReport(
  entries: MealEntry[],
  fromDate: string,
  days: number,
  foods: Food[] = Object.values(FOODS_BY_ID),
): BasicReport {
  const dates = dateRange(fromDate, days);
  const inRange = entries.filter((e) => dates.includes(e.date));
  const activeDates = new Set(inRange.map((e) => e.date));
  const totals = inRange.reduce<Macros>(
    (acc, e) => {
      const n = entryNutrition(e, foods);
      return {
        kcal: acc.kcal + n.kcal,
        protein: acc.protein + n.protein,
        carbs: acc.carbs + n.carbs,
        fat: acc.fat + n.fat,
        fiber: acc.fiber + n.fiber,
      };
    },
    { ...EMPTY_MACROS },
  );
  const activeDays = activeDates.size;
  const averageKcal = activeDays ? round(totals.kcal / activeDays) : 0;
  const averageProtein = activeDays ? round(totals.protein / activeDays, 1) : 0;
  const budgetUsedIRR = round(inRange.reduce((sum, e) => sum + entryPrice(e, foods), 0));

  let insightFa = 'هنوز وعده‌ای در این بازه ثبت نشده است.';
  if (activeDays > 0) {
    insightFa = `میانگین دریافت شما ${averageKcal} کیلوکالری در ${activeDays} روز از ${dates.length} روز بوده است.`;
  }
  return {
    from: dates[0] ?? fromDate,
    to: dates.at(-1) ?? fromDate,
    days: dates.length,
    averageKcal,
    averageProtein,
    activeDays,
    totalMeals: inRange.length,
    budgetUsedIRR,
    insightFa,
  };
}

export interface DetailedPoint {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  budget: number;
  entryCount: number;
}

export interface DetailedReport {
  from: string;
  to: string;
  days: number;
  activeDays: number;
  totalMeals: number;
  trend: DetailedPoint[];
  /** میانگین روزهای فعال */
  averages: Macros & { budget: number };
  totals: Macros & { budget: number };
  /** سهم انرژی درشت‌مغذی‌ها (۴/۴/۹ کیلوکالری در هر گرم) */
  macroSplit: { proteinPct: number; carbsPct: number; fatPct: number };
  adherence: {
    kcalPct: number;
    proteinPct: number;
    budgetPct: number;
    kcalInRangeDays: number;
    proteinMetDays: number;
    budgetWithinDays: number;
  };
  mealTypes: Array<{ mealType: MealType; labelFa: string; count: number; kcal: number; sharePct: number }>;
  topFoods: Array<{ foodId: string; nameFa: string; count: number; grams: number; kcal: number }>;
  bestDay: { date: string; kcal: number } | null;
  highestDay: { date: string; kcal: number } | null;
  longestStreak: number;
  /** امتیاز تعادل ۰ تا ۱۰۰ */
  score: number;
  insights: string[];
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** گزارش تکمیلی (پولی): تمام محاسبات تعیین‌پذیر است و عددی را مدل زبانی نمی‌سازد */
export function buildDetailedReport(
  entries: MealEntry[],
  goal: UserGoal,
  fromDate: string,
  days: number,
  foods: Food[] = Object.values(FOODS_BY_ID),
): DetailedReport {
  const dates = dateRange(fromDate, days);
  const dateSet = new Set(dates);
  const inRange = entries.filter((e) => dateSet.has(e.date));

  const trend: DetailedPoint[] = dates.map((date) => {
    const day = inRange.filter((e) => e.date === date);
    const macros = day.reduce<Macros>(
      (acc, e) => {
        const n = entryNutrition(e, foods);
        return {
          kcal: acc.kcal + n.kcal,
          protein: acc.protein + n.protein,
          carbs: acc.carbs + n.carbs,
          fat: acc.fat + n.fat,
          fiber: acc.fiber + n.fiber,
        };
      },
      { ...EMPTY_MACROS },
    );
    return {
      date,
      kcal: round(macros.kcal),
      protein: round(macros.protein, 1),
      carbs: round(macros.carbs, 1),
      fat: round(macros.fat, 1),
      fiber: round(macros.fiber, 1),
      budget: round(day.reduce((sum, e) => sum + entryPrice(e, foods), 0)),
      entryCount: day.length,
    };
  });

  const active = trend.filter((p) => p.entryCount > 0);
  const activeDays = active.length;
  const sum = (key: keyof DetailedPoint): number => active.reduce((acc, p) => acc + (p[key] as number), 0);
  const totals = {
    kcal: round(sum('kcal')),
    protein: round(sum('protein'), 1),
    carbs: round(sum('carbs'), 1),
    fat: round(sum('fat'), 1),
    fiber: round(sum('fiber'), 1),
    budget: round(sum('budget')),
  };
  const avg = (value: number, digits = 0): number => (activeDays ? round(value / activeDays, digits) : 0);
  const averages = {
    kcal: avg(totals.kcal),
    protein: avg(totals.protein, 1),
    carbs: avg(totals.carbs, 1),
    fat: avg(totals.fat, 1),
    fiber: avg(totals.fiber, 1),
    budget: avg(totals.budget),
  };

  const energy = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
  const macroSplit = {
    proteinPct: pct(totals.protein * 4, energy),
    carbsPct: pct(totals.carbs * 4, energy),
    fatPct: pct(totals.fat * 9, energy),
  };

  const kcalInRangeDays = active.filter(
    (p) => goal.calorieTarget > 0 && p.kcal >= goal.calorieTarget * 0.85 && p.kcal <= goal.calorieTarget * 1.15,
  ).length;
  const proteinMetDays = active.filter((p) => goal.proteinTarget > 0 && p.protein >= goal.proteinTarget * 0.9).length;
  const budgetWithinDays = active.filter((p) => goal.dailyBudgetIRR <= 0 || p.budget <= goal.dailyBudgetIRR * 1.1).length;
  const adherence = {
    kcalPct: pct(kcalInRangeDays, activeDays),
    proteinPct: pct(proteinMetDays, activeDays),
    budgetPct: pct(budgetWithinDays, activeDays),
    kcalInRangeDays,
    proteinMetDays,
    budgetWithinDays,
  };

  const byType = new Map<MealType, { count: number; kcal: number }>();
  const byFood = new Map<string, { count: number; grams: number; kcal: number }>();
  for (const e of inRange) {
    const n = entryNutrition(e, foods);
    const t = byType.get(e.mealType) ?? { count: 0, kcal: 0 };
    byType.set(e.mealType, { count: t.count + 1, kcal: t.kcal + n.kcal });
    const f = byFood.get(e.foodId) ?? { count: 0, grams: 0, kcal: 0 };
    byFood.set(e.foodId, { count: f.count + 1, grams: f.grams + e.grams, kcal: f.kcal + n.kcal });
  }
  const totalTypeKcal = [...byType.values()].reduce((acc, v) => acc + v.kcal, 0);
  const mealTypes = (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mealType) => {
    const v = byType.get(mealType) ?? { count: 0, kcal: 0 };
    return {
      mealType,
      labelFa: MEAL_TYPE_LABELS[mealType],
      count: v.count,
      kcal: round(v.kcal),
      sharePct: pct(v.kcal, totalTypeKcal),
    };
  });
  const topFoods = [...byFood.entries()]
    .map(([foodId, v]) => ({
      foodId,
      nameFa: foods.find((f) => f.id === foodId)?.nameFa ?? foodId,
      count: v.count,
      grams: v.grams,
      kcal: round(v.kcal),
    }))
    .sort((a, b) => b.count - a.count || b.kcal - a.kcal)
    .slice(0, 5);

  let bestDay: DetailedReport['bestDay'] = null;
  let highestDay: DetailedReport['highestDay'] = null;
  for (const p of active) {
    if (!bestDay || Math.abs(p.kcal - goal.calorieTarget) < Math.abs(bestDay.kcal - goal.calorieTarget)) {
      bestDay = { date: p.date, kcal: p.kcal };
    }
    if (!highestDay || p.kcal > highestDay.kcal) highestDay = { date: p.date, kcal: p.kcal };
  }

  let longestStreak = 0;
  let run = 0;
  for (const p of trend) {
    run = p.entryCount > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }

  const consistency = pct(activeDays, dates.length);
  const score = activeDays
    ? Math.round(adherence.kcalPct * 0.4 + adherence.proteinPct * 0.25 + adherence.budgetPct * 0.2 + consistency * 0.15)
    : 0;

  const insights: string[] = [];
  if (activeDays === 0) {
    insights.push('در این بازه وعده‌ای ثبت نشده است؛ با ثبت چند وعده، تحلیل کامل ساخته می‌شود.');
  } else {
    if (averages.kcal < goal.calorieTarget * 0.85) {
      insights.push(`میانگین کالری شما ${averages.kcal} است و کمتر از هدف ${goal.calorieTarget} قرار دارد.`);
    } else if (averages.kcal > goal.calorieTarget * 1.15) {
      insights.push(`میانگین کالری شما ${averages.kcal} است و بیشتر از هدف ${goal.calorieTarget} قرار دارد.`);
    } else {
      insights.push('میانگین کالری شما نزدیک به هدف تعیین‌شده است.');
    }
    if (averages.protein < goal.proteinTarget * 0.9) {
      insights.push(`پروتئین روزانه ${averages.protein} گرم است؛ برای رسیدن به هدف ${goal.proteinTarget} گرم، غذاهای پروتئین‌دارتر را بررسی کنید.`);
    }
    if (averages.fiber < goal.fiberTarget * 0.7) {
      insights.push(`فیبر روزانه ${averages.fiber} گرم است؛ سبزی، حبوبات و میوه می‌توانند آن را بالا ببرند.`);
    }
    if (goal.dailyBudgetIRR > 0 && averages.budget > goal.dailyBudgetIRR * 1.1) {
      insights.push('میانگین هزینهٔ غذایی از بودجهٔ روزانه بیشتر است؛ بخش پیشنهادها گزینه‌های اقتصادی‌تر نشان می‌دهد.');
    }
    if (consistency < 50) {
      insights.push(`فقط در ${activeDays} روز از ${dates.length} روز وعده ثبت کرده‌اید؛ ثبت منظم‌تر، تحلیل دقیق‌تری می‌دهد.`);
    }
    if (longestStreak >= 5) {
      insights.push(`طولانی‌ترین زنجیرهٔ ثبت شما ${longestStreak} روز پیاپی بوده است؛ آفرین!`);
    }
  }

  return {
    from: dates[0] ?? fromDate,
    to: dates.at(-1) ?? fromDate,
    days: dates.length,
    activeDays,
    totalMeals: inRange.length,
    trend,
    averages,
    totals,
    macroSplit,
    adherence,
    mealTypes,
    topFoods,
    bestDay,
    highestDay,
    longestStreak,
    score,
    insights,
  };
}

export const DETAILED_REPORT_SECTIONS = [
  { id: 'macro-split', titleFa: 'سهم انرژی درشت‌مغذی‌ها' },
  { id: 'adherence', titleFa: 'پایبندی به هدف کالری، پروتئین و بودجه' },
  { id: 'meal-types', titleFa: 'توزیع کالری بین وعده‌ها' },
  { id: 'top-foods', titleFa: 'پرمصرف‌ترین غذاها' },
  { id: 'score', titleFa: 'امتیاز تعادل و تحلیل‌های شخصی' },
  { id: 'long-range', titleFa: 'روند تا ۹۰ روز و خروجی CSV' },
] as const;
