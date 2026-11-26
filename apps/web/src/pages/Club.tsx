import { useState } from 'react';

import { Coin, Icon } from '../components/Icon';
import { ConfirmDialog, EmptyState, ErrorState, PageHead, PageSkeleton, Progress } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, errorMessage } from '../lib/api';
import { REFERRAL_STATUS, countdownText, formatDateTime, formatNumber, ledgerLabel, toPersianDigits } from '../lib/format';
import { useApi, useDocumentTitle } from '../lib/hooks';
import type { AppUser, ClubState, RewardItem } from '../lib/types';

interface CheckinResponse { awarded: number; alreadyDone: boolean; streak: number; bonus: number; balance: number; club: ClubState }
interface RedeemResponse { ok: boolean; proUntil: string; balance: number; user: AppUser; club: ClubState }

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function Club() {
  useDocumentTitle('باشگاه مشتریان');
  const { refresh, setUser } = useAuth();
  const toast = useToast();
  const club = useApi<ClubState>('/api/club');
  const [checkingIn, setCheckingIn] = useState(false);
  const [redeeming, setRedeeming] = useState<RewardItem | null>(null);
  const [busy, setBusy] = useState(false);

  const checkin = async () => {
    setCheckingIn(true);
    try {
      const result = await api<CheckinResponse>('/api/club/checkin', { method: 'POST' });
      club.setData(result.club);
      if (result.alreadyDone) toast.success('ورود امروز شما قبلاً ثبت شده است');
      else toast.token(`+${formatNumber(result.awarded)} ژتون${result.bonus > 0 ? ` (شامل ${formatNumber(result.bonus)} ژتون پاداش ورود پیاپی)` : ''}`);
      void refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCheckingIn(false);
    }
  };

  const redeem = async () => {
    if (!redeeming) return;
    setBusy(true);
    try {
      const result = await api<RedeemResponse>('/api/club/redeem', { method: 'POST', json: { rewardId: redeeming.id } });
      club.setData(result.club);
      setUser(result.user);
      toast.success(`«${redeeming.titleFa}» فعال شد`);
      setRedeeming(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (club.loading && !club.data) return <PageSkeleton />;
  if (club.error && !club.data) return <ErrorState message={club.error} onRetry={club.reload} />;
  if (!club.data) return null;

  const state = club.data;
  const link = `${window.location.origin}/login?ref=${state.referralCode}`;
  const proLeft = countdownText(state.proUntil);

  const copy = async () => {
    const ok = await copyText(state.referralCode);
    if (ok) toast.success('کد معرف کپی شد');
    else toast.error('کپی انجام نشد؛ کد را دستی کپی کنید');
  };
  const copyLink = async () => {
    const ok = await copyText(link);
    if (ok) toast.success('پیوند دعوت کپی شد');
    else toast.error('کپی انجام نشد؛ پیوند را دستی کپی کنید');
  };
  const share = async () => {
    const text = `با کد من در بشقاب‌یار ثبت‌نام کن و ${formatNumber(state.referralRewards.invitee)} ژتون هدیه بگیر: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'بشقاب‌یار', text, url: link });
      } catch {
        /* کاربر انصراف داد */
      }
    } else {
      await copyLink();
    }
  };

  return (
    <>
      <PageHead title="باشگاه مشتریان" subtitle="با هر فعالیت ژتون بگیرید و با ژتون، نسخهٔ حرفه‌ای را رایگان فعال کنید." />

      <section className="card card-hero card-lg stack" aria-labelledby="balance-title">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="token-balance">
            <Coin size={56} />
            <div>
              <h2 id="balance-title" style={{ fontSize: 'var(--text-sm)', fontWeight: 500, opacity: 0.85 }}>موجودی ژتون</h2>
              <p className="num" style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1.2 }}>{formatNumber(state.balance)}</p>
            </div>
          </div>
          <span className="badge badge-gold"><Icon name="crown" size={12} /> سطح {state.level.labelFa}</span>
        </div>

        <div className="stack-sm">
          <div className="progress progress-thin gold" style={{ background: 'rgb(255 255 255 / 22%)' }} role="progressbar" aria-label="پیشرفت تا سطح بعد" aria-valuenow={state.level.progressPct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${state.level.progressPct}%` }} />
          </div>
          <p className="small">
            {state.level.next
              ? `${formatNumber(state.level.remaining)} ژتون تا سطح ${state.level.next.labelFa}`
              : 'شما در بالاترین سطح باشگاه هستید'}
          </p>
        </div>

        <div className="row between">
          <button className="btn btn-light" type="button" onClick={checkin} disabled={checkingIn || state.checkedInToday}>
            <Icon name="gift" size={18} />
            {state.checkedInToday ? 'ورود امروز ثبت شد' : `ورود روزانه (+${formatNumber(state.rules.dailyCheckin ?? 2)} ژتون)`}
          </button>
          <span className="streak" style={{ color: '#ffd08a' }} title="روزهای متوالی">
            <Icon name="flame" size={22} /> {formatNumber(state.streak)} روز پیاپی
          </span>
        </div>
        <p className="tiny" style={{ color: 'rgb(255 255 255 / 80%)' }}>
          هر {formatNumber(state.rules.streakEvery ?? 7)} روز ورود پیاپی، {formatNumber(state.rules.streakBonus ?? 10)} ژتون پاداش دارد. ثبت نخستین وعدهٔ هر روز هم {formatNumber(state.rules.firstMealOfDay ?? 3)} ژتون می‌دهد.
        </p>
      </section>

      {proLeft && (
        <div className="notice success">
          <Icon name="crown" size={20} />
          <div className="notice-body">نسخهٔ حرفه‌ای شما <strong>{proLeft}</strong> دیگر فعال است.</div>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="card stack" aria-labelledby="ref-title">
          <div className="card-head" style={{ marginBlockEnd: 0 }}><h2 id="ref-title">دعوت از دوستان</h2></div>
          <p className="small muted">
            هر دوستی که با کد شما وارد شود و نخستین وعدهٔ خود را ثبت کند، شما {formatNumber(state.referralRewards.inviter)} ژتون و او {formatNumber(state.referralRewards.invitee)} ژتون می‌گیرد.
          </p>
          <div className="referral-code">
            <code className="ltr">{state.referralCode}</code>
            <button className="btn btn-secondary btn-sm" type="button" onClick={copy}><Icon name="copy" size={16} /> کپی</button>
          </div>
          <div className="row">
            <button className="btn grow" type="button" onClick={share}><Icon name="share" size={18} /> ارسال دعوت‌نامه</button>
            <button className="btn btn-secondary" type="button" onClick={copyLink}>کپی پیوند</button>
          </div>
          <p className="tiny faint ltr" style={{ wordBreak: 'break-all' }}>{link}</p>

          <hr />
          <div className="row between">
            <h3>دوستان دعوت‌شده</h3>
            <span className="small muted">{formatNumber(state.rewardedCount)} از {formatNumber(state.invitedCount)} نفر فعال شده‌اند</span>
          </div>
          {state.invited.length === 0 ? (
            <EmptyState icon="users" text="هنوز کسی با کد شما وارد نشده است." />
          ) : (
            <ul className="list">
              {state.invited.map((friend, index) => {
                const meta = REFERRAL_STATUS[friend.status] ?? { label: friend.status, tone: '' };
                return (
                  <li key={`${friend.createdAt}-${index}`}>
                    <div className="grow">
                      <strong className="truncate" style={{ display: 'block' }}>{friend.name}</strong>
                      <span className="tiny muted ltr">{friend.phone ? toPersianDigits(friend.phone) : '—'}</span>
                    </div>
                    <span className={`badge ${meta.tone}`}>{meta.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card stack" aria-labelledby="rewards-title">
          <div className="card-head" style={{ marginBlockEnd: 0 }}><h2 id="rewards-title">جایزه‌ها</h2></div>
          {state.rewards.map((reward) => {
            const affordable = state.balance >= reward.costTokens;
            return (
              <div className="card reward-card" key={reward.id} style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
                <div className="row between row-nowrap">
                  <strong>{reward.titleFa}</strong>
                  <span className="badge badge-gold"><Coin size={14} /> {formatNumber(reward.costTokens)}</span>
                </div>
                <p className="small muted">{reward.descriptionFa}</p>
                <button className="btn btn-sm" type="button" disabled={!affordable} onClick={() => setRedeeming(reward)}>
                  {affordable ? 'دریافت جایزه' : `${formatNumber(reward.costTokens - state.balance)} ژتون کم دارید`}
                </button>
              </div>
            );
          })}
          <Progress label="پیشرفت تا ارزان‌ترین جایزه" value={Math.min(state.balance, state.rewards[0]?.costTokens ?? 0)} target={state.rewards[0]?.costTokens ?? 0} tone="gold" />
        </section>
      </div>

      <section className="card" aria-labelledby="ledger-title">
        <div className="card-head"><h2 id="ledger-title">آخرین تراکنش‌ها</h2></div>
        {state.ledger.length === 0 ? (
          <EmptyState icon="gift" text="هنوز تراکنشی ندارید." />
        ) : (
          <ul className="list">
            {state.ledger.map((item, index) => (
              <li key={`${item.created_at}-${index}`}>
                <div className="grow">
                  <strong>{ledgerLabel(item.reason)}</strong>
                  <span className="tiny muted" style={{ display: 'block' }}>{formatDateTime(item.created_at)}</span>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <span className={`ledger-delta ${item.delta >= 0 ? 'plus' : 'minus'}`}>{item.delta >= 0 ? '+' : '−'}{formatNumber(Math.abs(item.delta))}</span>
                  <span className="tiny faint" style={{ display: 'block' }}>موجودی: {formatNumber(item.balance_after)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {redeeming && (
        <ConfirmDialog title="دریافت جایزه" confirmLabel={`پرداخت ${formatNumber(redeeming.costTokens)} ژتون`} danger={false} busy={busy} onConfirm={redeem} onClose={() => setRedeeming(null)}>
          <p><strong>{redeeming.titleFa}</strong></p>
          <p className="small muted">{redeeming.descriptionFa}</p>
          <p className="small">موجودی پس از دریافت: {formatNumber(state.balance - redeeming.costTokens)} ژتون</p>
        </ConfirmDialog>
      )}
    </>
  );
}
