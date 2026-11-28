/** قواعد باشگاه مشتریان بشقاب‌یار: ژتون، سطح، جایزه و کد معرف */

export const TOKEN_RULES = {
  welcome: 20,
  researchConsent: 10,
  referralInvitee: 20,
  referralInviter: 50,
  dailyCheckin: 2,
  firstMealOfDay: 3,
  streakBonus: 10,
  streakEvery: 7,
  maxInviterRewardsPerMonth: 20,
  foodContribution: 5,
  healthLog: 2,
  healthStreak: 10,
  healthGoal: 50,
  quizCorrect: 10,
  quizWrong: 1,
} as const;

export type LevelId = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface Level {
  id: LevelId;
  labelFa: string;
  /** حداقل ژتون کسب‌شده در طول زمان */
  minEarned: number;
}

export const LEVELS: readonly Level[] = [
  { id: 'bronze', labelFa: 'برنزی', minEarned: 0 },
  { id: 'silver', labelFa: 'نقره‌ای', minEarned: 200 },
  { id: 'gold', labelFa: 'طلایی', minEarned: 600 },
  { id: 'diamond', labelFa: 'الماسی', minEarned: 1500 },
];

export interface LevelProgress {
  level: Level;
  next: Level | null;
  /** ژتون باقی‌مانده تا سطح بعد */
  remaining: number;
  /** ۰ تا ۱۰۰ */
  progressPct: number;
}

export function levelFor(tokensEarned: number): LevelProgress {
  const earned = Math.max(0, Math.floor(tokensEarned));
  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (earned >= LEVELS[i]!.minEarned) index = i;
  }
  const level = LEVELS[index]!;
  const next = LEVELS[index + 1] ?? null;
  if (!next) return { level, next: null, remaining: 0, progressPct: 100 };
  const span = next.minEarned - level.minEarned;
  return {
    level,
    next,
    remaining: next.minEarned - earned,
    progressPct: Math.min(100, Math.round(((earned - level.minEarned) / span) * 100)),
  };
}

export interface Reward {
  id: string;
  titleFa: string;
  descriptionFa: string;
  costTokens: number;
  /** تعداد روز نسخهٔ حرفه‌ای که با این جایزه فعال می‌شود */
  proDays: number;
}

export const REWARDS: readonly Reward[] = [
  {
    id: 'pro-3d',
    titleFa: 'سه روز نسخهٔ حرفه‌ای',
    descriptionFa: 'گزارش‌های تکمیلی، غذای سفارشی و سهمیهٔ بیشتر تشخیص با عکس به مدت ۳ روز',
    costTokens: 120,
    proDays: 3,
  },
  {
    id: 'pro-7d',
    titleFa: 'هفت روز نسخهٔ حرفه‌ای',
    descriptionFa: 'تمام امکانات حرفه‌ای به مدت یک هفته',
    costTokens: 250,
    proDays: 7,
  },
  {
    id: 'pro-30d',
    titleFa: 'سی روز نسخهٔ حرفه‌ای',
    descriptionFa: 'تمام امکانات حرفه‌ای به مدت یک ماه',
    costTokens: 900,
    proDays: 30,
  },
];

export function findReward(id: string): Reward | undefined {
  return REWARDS.find((reward) => reward.id === id);
}

/** الفبای بدون نویسه‌های مشابه (O/0، I/1/L) برای کد معرف */
export const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 7;

export function referralCodeFromBytes(bytes: Uint8Array): string {
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    code += REFERRAL_ALPHABET[(bytes[i] ?? 0) % REFERRAL_ALPHABET.length];
  }
  return code;
}

export function normalizeReferralCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidReferralCode(input: string): boolean {
  const code = normalizeReferralCode(input);
  return code.length === REFERRAL_CODE_LENGTH && [...code].every((c) => REFERRAL_ALPHABET.includes(c));
}

/** ادامهٔ زنجیرهٔ روزهای متوالی: امروز یا دیروز آخرین ورود بوده؟ */
export function nextStreak(lastCheckin: string | null, today: string, current: number): number {
  if (!lastCheckin) return 1;
  if (lastCheckin === today) return current;
  const previous = new Date(`${today}T00:00:00Z`).getTime() - 86_400_000;
  const last = new Date(`${lastCheckin}T00:00:00Z`).getTime();
  return last === previous ? current + 1 : 1;
}

