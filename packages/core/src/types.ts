/** انواع مشترک دامنه بشقاب‌یار — بدون وابستگی به فریمورک */

export type Plan = 'free' | 'pro';

export type GoalType = 'balance' | 'weight-loss' | 'muscle-gain' | 'budget';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Macros {
  /** کیلوکالری */
  kcal: number;
  /** پروتئین (گرم) */
  protein: number;
  /** کربوهیدرات (گرم) */
  carbs: number;
  /** چربی (گرم) */
  fat: number;
  /** فیبر (گرم) */
  fiber: number;
}

export interface Serving {
  grams: number;
  labelFa: string;
}

export interface Food {
  id: string;
  nameFa: string;
  category: 'main' | 'rice' | 'soup' | 'bread' | 'dairy' | 'egg' | 'fruit' | 'legume' | 'local';
  /** ارزش غذایی به ازای ۱۰۰ گرم */
  per100g: Macros;
  serving: Serving;
  /** تخمین هزینه هر سهم به تومان (قابل بهروزرسانی توسط ادمین) */
  estimatedPriceIRR: number;
  tags: string[];
  /** غذاهای پایه در نسخه رایگان و بقیه در نسخه Pro */
  free: boolean;
}

export interface MealEntry {
  id: string;
  userId: string;
  foodId: string;
  grams: number;
  mealType: MealType;
  /** تاریخ YYYY-MM-DD بر اساس منطقه زمانی کاربر */
  date: string;
  createdAt: string;
}

export interface UserGoal {
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  fiberTarget: number;
  dailyBudgetIRR: number;
  goalType: GoalType;
}

export interface DaySummary {
  date: string;
  totals: Macros;
  goal: UserGoal;
  ratio: Macros & { budget: number };
  remaining: Macros & { budget: number };
  entryCount: number;
  status: 'below' | 'balanced' | 'over';
}

export type SuggestionKind = 'cheaper' | 'balanced' | 'lower-calorie' | 'higher-protein';

export interface Suggestion {
  kind: SuggestionKind;
  fromFoodId: string;
  toFoodId: string;
  titleFa: string;
  reasonFa: string;
  /** تغییرات به ازای همان وزن ثبتشده */
  delta: Macros & { priceIRR: number };
  score: number;
}

export interface MealLogInput {
  foodId: string;
  grams: number;
  mealType: MealType;
  date?: string;
}

export const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export const DEFAULT_GOAL: UserGoal = {
  calorieTarget: 2000,
  proteinTarget: 100,
  carbsTarget: 260,
  fatTarget: 65,
  fiberTarget: 25,
  dailyBudgetIRR: 250000,
  goalType: 'balance',
};
