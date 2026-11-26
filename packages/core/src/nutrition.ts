import { FOODS_BY_ID } from './foods.js';
import type {
  DaySummary,
  Food,
  Macros,
  MealEntry,
  Plan,
  Suggestion,
  SuggestionKind,
  UserGoal,
} from './types.js';
import { EMPTY_MACROS } from './types.js';

const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function scaleMacros(per100g: Macros, grams: number): Macros {
  const factor = Math.max(0, grams) / 100;
  return {
    kcal: round(per100g.kcal * factor),
    protein: round(per100g.protein * factor, 1),
    carbs: round(per100g.carbs * factor, 1),
    fat: round(per100g.fat * factor, 1),
    fiber: round(per100g.fiber * factor, 1),
  };
}

export function entryNutrition(entry: MealEntry, foods: Food[] = Object.values(FOODS_BY_ID)): Macros {
  const food = foods.find((f) => f.id === entry.foodId);
  if (!food) return { ...EMPTY_MACROS };
  return scaleMacros(food.per100g, entry.grams);
}

export function entryPrice(entry: MealEntry, foods: Food[] = Object.values(FOODS_BY_ID)): number {
  const food = foods.find((f) => f.id === entry.foodId);
  if (!food) return 0;
  return round((food.estimatedPriceIRR * entry.grams) / food.serving.grams);
}

const addMacros = (a: Macros, b: Macros): Macros => ({
  kcal: round(a.kcal + b.kcal),
  protein: round(a.protein + b.protein, 1),
  carbs: round(a.carbs + b.carbs, 1),
  fat: round(a.fat + b.fat, 1),
  fiber: round(a.fiber + b.fiber, 1),
});

export function summarizeDay(
  entries: MealEntry[],
  goal: UserGoal,
  date: string,
  foods: Food[] = Object.values(FOODS_BY_ID),
): DaySummary {
  const dayEntries = entries.filter((e) => e.date === date);
  const totals = dayEntries.reduce<Macros>((acc, entry) => addMacros(acc, entryNutrition(entry, foods)), { ...EMPTY_MACROS });
  const budget = dayEntries.reduce((sum, entry) => sum + entryPrice(entry, foods), 0);

  const ratio = {
    kcal: goal.calorieTarget ? round(totals.kcal / goal.calorieTarget, 2) : 0,
    protein: goal.proteinTarget ? round(totals.protein / goal.proteinTarget, 2) : 0,
    carbs: goal.carbsTarget ? round(totals.carbs / goal.carbsTarget, 2) : 0,
    fat: goal.fatTarget ? round(totals.fat / goal.fatTarget, 2) : 0,
    fiber: goal.fiberTarget ? round(totals.fiber / goal.fiberTarget, 2) : 0,
    budget: goal.dailyBudgetIRR ? round(budget / goal.dailyBudgetIRR, 2) : 0,
  };

  const remaining = {
    kcal: round(goal.calorieTarget - totals.kcal),
    protein: round(goal.proteinTarget - totals.protein, 1),
    carbs: round(goal.carbsTarget - totals.carbs, 1),
    fat: round(goal.fatTarget - totals.fat, 1),
    fiber: round(goal.fiberTarget - totals.fiber, 1),
    budget: round(goal.dailyBudgetIRR - budget),
  };

  let status: DaySummary['status'] = 'balanced';
  if (ratio.kcal < 0.7) status = 'below';
  else if (ratio.kcal > 1.1 || ratio.budget > 1.1) status = 'over';

  return { date, totals, goal, ratio, remaining, entryCount: dayEntries.length, status };
}

export interface TrendPoint {
  date: string;
  kcal: number;
  protein: number;
  budget: number;
  entryCount: number;
}

export function buildTrend(
  entries: MealEntry[],
  fromDate: string,
  days: number,
  foods: Food[] = Object.values(FOODS_BY_ID),
): TrendPoint[] {
  const points: TrendPoint[] = [];
  const start = new Date(`${fromDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return points;

  for (let i = 0; i < days; i += 1) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const date = d.toISOString().slice(0, 10);
    const day = entries.filter((e) => e.date === date);
    const macros = day.reduce<Macros>((acc, entry) => addMacros(acc, entryNutrition(entry, foods)), { ...EMPTY_MACROS });
    points.push({
      date,
      kcal: macros.kcal,
      protein: macros.protein,
      budget: day.reduce((sum, entry) => sum + entryPrice(entry, foods), 0),
      entryCount: day.length,
    });
  }
  return points;
}

export interface SuggestOptions {
  entry: MealEntry;
  goal: UserGoal;
  plan: Plan;
  foods?: Food[];
  limit?: number;
}

interface CandidateScore {
  food: Food;
  macros: Macros;
  price: number;
  score: number;
  kind: SuggestionKind;
  improvement: number;
}

function chooseKind(
  original: Macros,
  candidate: Macros,
  originalPrice: number,
  candidatePrice: number,
  goal: UserGoal,
): { kind: SuggestionKind; improvement: number } {
  const priceGain = (originalPrice - candidatePrice) / Math.max(originalPrice, 1);
  const proteinGain = (candidate.protein - original.protein) / Math.max(original.protein, 1);
  const fiberGain = candidate.fiber - original.fiber;
  const target = goal.calorieTarget / 3;
  const kcalImprovement =
    (Math.abs(original.kcal - target) - Math.abs(candidate.kcal - target)) / Math.max(target, 1);

  const options: Array<{ kind: SuggestionKind; value: number }> = [
    { kind: 'cheaper', value: priceGain },
    { kind: 'lower-calorie', value: goal.goalType === 'weight-loss' ? kcalImprovement * 1.5 : kcalImprovement },
    { kind: 'higher-protein', value: goal.goalType === 'muscle-gain' ? proteinGain * 1.5 : proteinGain },
    { kind: 'balanced', value: kcalImprovement + fiberGain / 20 + proteinGain / 3 },
  ];
  const best = options.reduce((a, b) => (b.value > a.value ? b : a));
  return { kind: best.value > 0.02 ? best.kind : 'balanced', improvement: best.value };
}

export function suggestAlternatives(options: SuggestOptions): Suggestion[] {
  const { entry, goal, plan } = options;
  const foods = options.foods ?? Object.values(FOODS_BY_ID);
  const original = foods.find((f) => f.id === entry.foodId);
  if (!original) return [];

  const allowed = plan === 'free' ? foods.filter((f) => f.free) : foods;
  const originalMacros = scaleMacros(original.per100g, entry.grams);
  const originalPrice = round((original.estimatedPriceIRR * entry.grams) / original.serving.grams);
  const target = goal.calorieTarget / 3;

  const pool = allowed.filter((food) => {
    if (food.id === original.id) return false;
    const sameCategory = food.category === original.category;
    const sharesTag = food.tags.some((tag) => original.tags.includes(tag));
    return sameCategory || sharesTag || ['legume', 'egg', 'dairy'].includes(food.category);
  });

  const scored: CandidateScore[] = pool.map((food) => {
    const macros = scaleMacros(food.per100g, entry.grams);
    const price = round((food.estimatedPriceIRR * entry.grams) / food.serving.grams);
    const { kind, improvement } = chooseKind(originalMacros, macros, originalPrice, price, goal);
    const kcalCloseness = 1 - Math.min(Math.abs(macros.kcal - target) / Math.max(target, 1), 1);
    const goalWeight =
      goal.goalType === 'budget' ? 0.55 : goal.goalType === 'weight-loss' ? 0.35 : goal.goalType === 'muscle-gain' ? 0.25 : 0.2;
    const score = improvement * (1 + goalWeight) + kcalCloseness * 0.25 - (food.category === original.category ? 0 : 0.05);
    return { food, macros, price, score, kind, improvement };
  });

  const useful = scored
    .filter((c) => c.improvement > 0.03 || c.macros.fiber - originalMacros.fiber >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? (plan === 'free' ? 2 : 4));

  return useful.map((candidate) => {
    const delta: Suggestion['delta'] = {
      kcal: candidate.macros.kcal - originalMacros.kcal,
      protein: round(candidate.macros.protein - originalMacros.protein, 1),
      carbs: round(candidate.macros.carbs - originalMacros.carbs, 1),
      fat: round(candidate.macros.fat - originalMacros.fat, 1),
      fiber: round(candidate.macros.fiber - originalMacros.fiber, 1),
      priceIRR: candidate.price - originalPrice,
    };
    return {
      kind: candidate.kind,
      fromFoodId: original.id,
      toFoodId: candidate.food.id,
      titleFa: `جایگزین: ${candidate.food.nameFa}`,
      reasonFa: reasonFor(candidate.kind, delta),
      delta,
      score: round(candidate.score, 3),
    };
  });
}

function signed(value: number, unit: string): string {
  const n = round(value, value % 1 === 0 ? 0 : 1);
  return `${n > 0 ? '+' : ''}${n}${unit}`;
}

export function reasonFor(kind: SuggestionKind, delta: Suggestion['delta']): string {
  switch (kind) {
    case 'cheaper':
      return `هزینه وعده ${signed(delta.priceIRR, ' تومان')} می‌شود؛ کالری ${signed(delta.kcal, ' کیلوکالوری')} تغییر می‌کند.`;
    case 'lower-calorie':
      return `کالری وعده ${signed(delta.kcal, ' کیلوکالوری')} می‌شود و هزینه ${signed(delta.priceIRR, ' تومان')} تغییر می‌کند.`;
    case 'higher-protein':
      return `پروتئین وعده ${signed(delta.protein, ' گرم')} می‌شود؛ کالری ${signed(delta.kcal, ' کیلوکالوری')} تغییر می‌کند.`;
    case 'balanced':
    default:
      return `کالری ${signed(delta.kcal, '')}، فیبر ${signed(delta.fiber, ' گرم')} و هزینه ${signed(delta.priceIRR, ' تومان')} تغییر می‌کند.`;
  }
}

/**
 * پرامپت آماده برای توضیح هوشمندانه اختیاری. محاسبات عددی در موتور ما انجام شده
 * و مدل زبانی فقط وظیفه تبدیل اعداد به جمله قابل فهم را دارد (مطابق تمایز محصول).
 */
export function buildExplanationPrompt(suggestion: Suggestion, from: Food, to: Food): string {
  return [
    'شما یک توضیح کوتاه و دوستانه به فارسی برای پیشنهاد جایگزینی غذا می‌نویسید.',
    'اعداد زیر از موتور محاسبه بشقاب‌یار آمدهاند و نباید بازمحاسبه یا تغییر شوند:',
    `از: ${from.nameFa} به: ${to.nameFa}`,
    `تغییر کالری: ${suggestion.delta.kcal}، پروتئین: ${suggestion.delta.protein} گرم، فیبر: ${suggestion.delta.fiber} گرم، هزینه: ${suggestion.delta.priceIRR} تومان`,
    'یک جمله حداکثر ۲۰ کلمه بنویسید و از ادعای پزشکی خودداری کنید.',
  ].join('\n');
}
