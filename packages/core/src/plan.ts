import type { Plan } from './types.js';

export type Feature =
  | 'extendedFoods'
  | 'customFoods'
  | 'unlimitedHistory'
  | 'advancedAnalytics'
  | 'aiExplanations'
  | 'nutritionistPanel';

export interface PlanLimits {
  labelFa: string;
  maxFoods: number;
  maxHistoryDays: number | null;
  features: Record<Feature, boolean>;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    labelFa: 'رایگان',
    maxFoods: 20,
    maxHistoryDays: 7,
    features: {
      extendedFoods: false,
      customFoods: false,
      unlimitedHistory: false,
      advancedAnalytics: false,
      aiExplanations: false,
      nutritionistPanel: false,
    },
  },
  pro: {
    labelFa: 'حرفهای',
    maxFoods: Number.POSITIVE_INFINITY,
    maxHistoryDays: null,
    features: {
      extendedFoods: true,
      customFoods: true,
      unlimitedHistory: true,
      advancedAnalytics: true,
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
