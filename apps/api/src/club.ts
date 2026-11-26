import { randomUUID } from 'node:crypto';

import { TOKEN_RULES, findReward, levelFor, maskPhone, nextStreak, normalizeReferralCode, isValidReferralCode, REWARDS } from '@boshghabyar/core';

import type { UserRow } from './db.js';
import { db, findUserByEmail, findUserById, findUserByReferralCode, newReferralCode, now, today, trackEvent, tx } from './db.js';

export interface AwardResult {
  ok: boolean;
  /** true اگر همین رویداد قبلاً ثبت شده بود */
  duplicate?: boolean;
  balance: number;
}

/**
 * ثبت تراکنش ژتون. اگر `ref` داده شود، هر (کاربر، دلیل، ref) فقط یک بار ثبت می‌شود.
 * کسر ژتون هرگز موجودی را منفی نمی‌کند.
 */
export function addTokens(userId: string, delta: number, reason: string, ref: string | null = null): AwardResult {
  return tx(() => {
    if (ref !== null) {
      const existing = db
        .prepare('SELECT 1 AS x FROM token_ledger WHERE user_id = ? AND reason = ? AND ref = ?')
        .get(userId, reason, ref);
      if (existing) {
        const u = findUserById(userId);
        return { ok: false, duplicate: true, balance: u?.token_balance ?? 0 };
      }
    }
    const earned = Math.max(delta, 0);
    const result = db
      .prepare(
        'UPDATE users SET token_balance = token_balance + ?, tokens_earned = tokens_earned + ? WHERE id = ? AND token_balance + ? >= 0',
      )
      .run(delta, earned, userId, delta);
    if (result.changes === 0) {
      const u = findUserById(userId);
      return { ok: false, balance: u?.token_balance ?? 0 };
    }
    const user = findUserById(userId)!;
    db.prepare(
      'INSERT INTO token_ledger (id, user_id, delta, reason, ref, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(randomUUID(), userId, delta, reason, ref, user.token_balance, now());
    return { ok: true, balance: user.token_balance };
  });
}

export interface NewUserInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  passwordHash?: string | null;
  referralCode?: string | null;
  researchConsent?: boolean;
}

/** ساخت کاربر جدید همراه با ژتون خوش‌آمد و ثبت دعوت (در صورت وجود کد معرف معتبر) */
export function createUser(input: NewUserInput): UserRow {
  return tx(() => {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO users (id, name, email, phone, password_hash, referral_code, research_consent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.passwordHash ?? null,
      newReferralCode(),
      input.researchConsent ? 1 : 0,
      now(),
    );
    addTokens(id, TOKEN_RULES.welcome, 'welcome', id);
    if (input.researchConsent) addTokens(id, TOKEN_RULES.researchConsent, 'research-consent', id);

    const code = input.referralCode ? normalizeReferralCode(input.referralCode) : '';
    if (code && isValidReferralCode(code)) {
      const referrer = findUserByReferralCode(code);
      if (referrer && referrer.id !== id && referrer.status === 'active') {
        db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, id);
        db.prepare('INSERT INTO referrals (id, referrer_id, referred_id, status, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(randomUUID(), referrer.id, id, 'pending', now());
        addTokens(id, TOKEN_RULES.referralInvitee, 'referral-invitee', referrer.id);
        trackEvent('referral.created', referrer.id, { referredId: id });
      }
    }
    trackEvent('user.registered', id, { via: input.phone ? 'phone' : 'email', referred: Boolean(code) });
    return findUserById(id)!;
  });
}

/** پاداش معرف پس از اولین وعدهٔ ثبت‌شدهٔ کاربر دعوت‌شده (کاهش سوءاستفاده از حساب‌های ساختگی) */
export function rewardReferrerIfFirstMeal(userId: string): number {
  const referral = db
    .prepare("SELECT id, referrer_id FROM referrals WHERE referred_id = ? AND status = 'pending'")
    .get(userId) as { id: string; referrer_id: string } | undefined;
  if (!referral) return 0;

  const monthStart = `${today().slice(0, 7)}-01T00:00:00.000Z`;
  const rewardedThisMonth = (
    db
      .prepare("SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ? AND status = 'rewarded' AND rewarded_at >= ?")
      .get(referral.referrer_id, monthStart) as { n: number }
  ).n;
  if (rewardedThisMonth >= TOKEN_RULES.maxInviterRewardsPerMonth) {
    db.prepare("UPDATE referrals SET status = 'capped' WHERE id = ?").run(referral.id);
    return 0;
  }
  return tx(() => {
    const award = addTokens(referral.referrer_id, TOKEN_RULES.referralInviter, 'referral-inviter', userId);
    db.prepare("UPDATE referrals SET status = 'rewarded', rewarded_at = ? WHERE id = ?").run(now(), referral.id);
    trackEvent('referral.rewarded', referral.referrer_id, { referredId: userId });
    return award.ok ? TOKEN_RULES.referralInviter : 0;
  });
}

/** ژتون اولین وعدهٔ روز؛ هر روز فقط یک بار */
export function awardFirstMealOfDay(userId: string, date: string): number {
  const award = addTokens(userId, TOKEN_RULES.firstMealOfDay, 'meal-day', date);
  return award.ok ? TOKEN_RULES.firstMealOfDay : 0;
}

export interface CheckinResult {
  awarded: number;
  alreadyDone: boolean;
  streak: number;
  bonus: number;
  balance: number;
}

export function dailyCheckin(user: UserRow): CheckinResult {
  const date = today();
  return tx(() => {
    const fresh = findUserById(user.id)!;
    if (fresh.last_checkin === date) {
      return { awarded: 0, alreadyDone: true, streak: fresh.streak_count, bonus: 0, balance: fresh.token_balance };
    }
    const streak = nextStreak(fresh.last_checkin, date, fresh.streak_count);
    db.prepare('UPDATE users SET streak_count = ?, last_checkin = ? WHERE id = ?').run(streak, date, fresh.id);
    addTokens(fresh.id, TOKEN_RULES.dailyCheckin, 'checkin', date);
    let bonus = 0;
    if (streak > 0 && streak % TOKEN_RULES.streakEvery === 0) {
      const b = addTokens(fresh.id, TOKEN_RULES.streakBonus, 'streak-bonus', `${date}#${streak}`);
      if (b.ok) bonus = TOKEN_RULES.streakBonus;
    }
    const balance = findUserById(fresh.id)!.token_balance;
    return { awarded: TOKEN_RULES.dailyCheckin + bonus, alreadyDone: false, streak, bonus, balance };
  });
}

export interface RedeemResult {
  ok: boolean;
  error?: string;
  proUntil?: string;
  balance?: number;
}

export function redeemReward(user: UserRow, rewardId: string): RedeemResult {
  const reward = findReward(rewardId);
  if (!reward) return { ok: false, error: 'جایزهٔ انتخاب‌شده وجود ندارد' };
  return tx(() => {
    const fresh = findUserById(user.id)!;
    if (fresh.token_balance < reward.costTokens) {
      return { ok: false, error: 'ژتون شما برای این جایزه کافی نیست' };
    }
    const spend = addTokens(fresh.id, -reward.costTokens, 'redeem', `${reward.id}#${randomUUID()}`);
    if (!spend.ok) return { ok: false, error: 'ژتون شما برای این جایزه کافی نیست' };
    const base = fresh.pro_until && new Date(fresh.pro_until).getTime() > Date.now() ? new Date(fresh.pro_until) : new Date();
    const proUntil = new Date(base.getTime() + reward.proDays * 86_400_000).toISOString();
    db.prepare('UPDATE users SET pro_until = ? WHERE id = ?').run(proUntil, fresh.id);
    trackEvent('club.redeemed', fresh.id, { rewardId: reward.id, cost: reward.costTokens });
    return { ok: true, proUntil, balance: spend.balance };
  });
}

/** حساب آزمایشی همیشه رایگان شروع می‌شود و ژتون کافی برای امتحان باشگاه دارد */
export function prepareDemo(): void {
  const demo = findUserByEmail('demo@boshghabyar.ir');
  if (!demo) return;
  db.prepare("UPDATE users SET plan = 'free', pro_until = NULL WHERE id = ?").run(demo.id);
  if (demo.token_balance < 300) addTokens(demo.id, 300 - demo.token_balance, 'demo-topup', today());
}

export function clubState(user: UserRow) {
  const fresh = findUserById(user.id)!;
  const progress = levelFor(fresh.tokens_earned);
  const invited = db
    .prepare(
      `SELECT r.status, r.created_at, u.name, u.phone
       FROM referrals r JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = ? ORDER BY r.created_at DESC LIMIT 50`,
    )
    .all(fresh.id) as unknown as Array<{ status: string; created_at: string; name: string; phone: string | null }>;
  const ledger = db
    .prepare('SELECT delta, reason, balance_after, created_at FROM token_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
    .all(fresh.id) as unknown as Array<{ delta: number; reason: string; balance_after: number; created_at: string }>;
  const rewardedCount = invited.filter((r) => r.status === 'rewarded').length;
  return {
    balance: fresh.token_balance,
    tokensEarned: fresh.tokens_earned,
    level: {
      id: progress.level.id,
      labelFa: progress.level.labelFa,
      next: progress.next ? { id: progress.next.id, labelFa: progress.next.labelFa } : null,
      remaining: progress.remaining,
      progressPct: progress.progressPct,
    },
    streak: fresh.streak_count,
    checkedInToday: fresh.last_checkin === today(),
    referralCode: fresh.referral_code,
    referralRewards: {
      invitee: TOKEN_RULES.referralInvitee,
      inviter: TOKEN_RULES.referralInviter,
    },
    invited: invited.map((r) => ({
      name: r.name,
      phone: r.phone ? maskPhone(r.phone) : null,
      status: r.status,
      createdAt: r.created_at,
    })),
    invitedCount: invited.length,
    rewardedCount,
    rewards: REWARDS,
    rules: TOKEN_RULES,
    ledger,
    proUntil: fresh.plan === 'pro' ? null : fresh.pro_until,
  };
}

