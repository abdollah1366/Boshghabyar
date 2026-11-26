import type { Plan } from './types.js';

export type Feature =
  | 'extendedFoods'
  | 'customFoods'
  | 'unlimitedHistory'
  | 'advancedAnalytics'
  | 'detailedReports'
  | 'dataExport'
  | 'aiExplanations'
  | 'nutritionistPanel';

export interface PlanLimits {
  labelFa: string;
  maxFoods: number;
  maxHistoryDays: number | null;
  /** بیشینهٔ بازهٔ گزارش تکمیلی (روز) */
  maxReportDays: number;
  /** سهمیهٔ روزانهٔ تشخیص غذا با عکس */
  recognitionPerDay: number;
  features: Record<Feature, boolean>;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    labelFa: 'رایگان',
    maxFoods: 20,
    maxHistoryDays: 7,
    maxReportDays: 7,
    recognitionPerDay: 5,
    features: {
      extendedFoods: false,
      customFoods: false,
      unlimitedHistory: false,
      advancedAnalytics: false,
      detailedReports: false,
      dataExport: false,
      aiExplanations: false,
      nutritionistPanel: false,
    },
  },
  pro: {
    labelFa: 'حرفه‌ای',
    maxFoods: Number.POSITIVE_INFINITY,
    maxHistoryDays: null,
    maxReportDays: 90,
    recognitionPerDay: 50,
    features: {
      extendedFoods: true,
      customFoods: true,
      unlimitedHistory: true,
      advancedAnalytics: true,
      detailedReports: true,
      dataExport: true,
      aiExplanations: true,
      nutritionistPanel: true,
    },
  },
};

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_LIMITS[plan]?.features[feature] ?? false;
}

export function historyCutoffDate(plan: Plan, today = new Date()): string | null {
  const days = PLAN_LIMITS[plan].maxHistoryDays;
  if (days === null) return null;
  const cutoff = new Date(today.getTime() - days * 86_400_000);
  return cutoff.toISOString().slice(0, 10);
}

export function isPlan(value: unknown): value is Plan {
  return value === 'free' || value === 'pro';
}

/**
 * طرح مؤثر کاربر: اشتراک دائمی Pro یا Pro موقت (مثلاً خرید با ژتون) که هنوز منقضی نشده است.
 */
export function effectivePlan(plan: Plan, proUntil: string | null | undefined, at = new Date()): Plan {
  if (plan === 'pro') return 'pro';
  if (proUntil) {
    const until = new Date(proUntil).getTime();
    if (!Number.isNaN(until) && until > at.getTime()) return 'pro';
  }
  return 'free';
}
