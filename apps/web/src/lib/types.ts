import type { DetailedReport, Plan, UserGoal } from '@boshghabyar/core';

export type { DetailedReport };

export interface AppUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'user' | 'admin';
  plan: Plan;
  proUntil: string | null;
  goal: UserGoal;
  referralCode: string;
  tokenBalance: number;
  level: { id: string; labelFa: string };
  researchConsent: boolean;
  createdAt: string;
}

export interface LedgerItem {
  delta: number;
  reason: string;
  balance_after: number;
  created_at: string;
}

export interface RewardItem {
  id: string;
  titleFa: string;
  descriptionFa: string;
  costTokens: number;
  proDays: number;
}

export interface InvitedFriend {
  name: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

export interface ClubState {
  balance: number;
  tokensEarned: number;
  level: {
    id: string;
    labelFa: string;
    next: { id: string; labelFa: string } | null;
    remaining: number;
    progressPct: number;
  };
  streak: number;
  checkedInToday: boolean;
  referralCode: string;
  referralRewards: { invitee: number; inviter: number };
  invited: InvitedFriend[];
  invitedCount: number;
  rewardedCount: number;
  rewards: RewardItem[];
  rules: Record<string, number>;
  ledger: LedgerItem[];
  proUntil: string | null;
}

export interface WeeklyReport {
  trend: Array<{ date: string; kcal: number; protein: number; budget: number; entryCount: number }>;
  summary: { averageKcal: number; averageProtein: number; activeDays: number; totalMeals: number; budgetUsedIRR: number };
  insight: string;
  advanced: boolean;
}

export interface LockedSection {
  id: string;
  titleFa: string;
}

export type DetailedResponse =
  | { locked: true; upgradeRequired: boolean; sections: LockedSection[]; maxDays: number; messageFa: string }
  | { locked: false; report: DetailedReport };

export interface RecognitionDetection {
  foodId: string;
  foodNameFa: string;
  confidence: number;
  suggestedGrams: number;
  alternatives: Array<{ foodId: string; foodNameFa: string; confidence: number }>;
}

export interface RecognitionResponse {
  detection: RecognitionDetection | null;
  remaining: number;
  provider: string;
  demo?: boolean;
  messageFa?: string;
}

export interface RecognitionStatus {
  available: boolean;
  provider: string | null;
  limit: number;
  used: number;
}
