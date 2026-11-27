import { RECIPES, recipesFor } from './recipes.js';
import type { Recipe } from './recipes.js';
import type { MealType, UserGoal } from './types.js';

export interface PlannedMeal {
  mealType: MealType;
  recipe: Recipe;
}

export interface MealPlanDay {
  dayIndex: number;
  /** برچسب روز هفته به فارسی */
  weekdayFa: string;
  meals: PlannedMeal[];
  totalKcal: number;
  totalProtein: number;
  totalPriceIRR: number;
}

export interface MealPlan {
  days: MealPlanDay[];
  averageKcal: number;
  averagePriceIRR: number;
}

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const PLAN_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * برنامهٔ غذایی تعیین‌پذیر: برای هر روز یک صبحانه، ناهار، شام و میان‌وعده انتخاب می‌شود.
 * انتخاب با چرخش روی فهرست دستورها است تا تنوع حفظ شود و نتیجه همیشه قابل بازتولید باشد.
 */
export function buildMealPlan(days: number, goal: UserGoal, startDayIndex = 0): MealPlan {
  const count = Math.max(1, Math.min(14, Math.floor(days)));
  const planDays: MealPlanDay[] = [];
  for (let d = 0; d < count; d += 1) {
    const meals: PlannedMeal[] = PLAN_MEAL_TYPES.map((mealType) => {
      const pool = recipesFor(mealType);
      // چرخش روی دستورها؛ بدون وابستگی به روز، فقط برای تنوع جابه‌جا می‌شود
      const recipe = pool[(d + startDayIndex) % pool.length]!;
      return { mealType, recipe };
    });
    const totalKcal = meals.reduce((sum, m) => sum + m.recipe.perServing.kcal, 0);
    const totalProtein = Math.round(meals.reduce((sum, m) => sum + m.recipe.perServing.protein, 0));
    const totalPriceIRR = meals.reduce((sum, m) => sum + m.recipe.priceIRRPerServing, 0);
    planDays.push({
      dayIndex: d,
      weekdayFa: WEEKDAYS[(d + startDayIndex) % 7]!,
      meals,
      totalKcal,
      totalProtein,
      totalPriceIRR,
    });
  }
  const averageKcal = planDays.length ? Math.round(planDays.reduce((s, d) => s + d.totalKcal, 0) / planDays.length) : 0;
  const averagePriceIRR = planDays.length ? Math.round(planDays.reduce((s, d) => s + d.totalPriceIRR, 0) / planDays.length) : 0;
  return { days: planDays, averageKcal, averagePriceIRR };
}

export { RECIPES };
