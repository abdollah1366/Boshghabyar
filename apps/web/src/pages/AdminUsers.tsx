import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Icon } from '../components/Icon';
import { Dialog, EmptyState, ErrorState, Notice, Skeleton } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api, errorMessage, query } from '../lib/api';
import { GOAL_LABELS, MEAL_LABELS, formatDate, formatDateTime, formatNumber, ledgerLabel, toPersianDigits } from '../lib/format';
import { useApi } from '../lib/hooks';
import type { LedgerItem } from '../lib/types';

interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'user' | 'admin';
  plan: 'free' | 'pro';
  effectivePlan: 'free' | 'pro';
  proUntil: string | null;
  status: 'active' | 'blocked';
  tokenBalance: number;
  tokensEarned: number;
  level: string;
  referralCode: string;
  referredBy: string | null;
  researchConsent: boolean;
  streak: number;
  lastLoginAt: string | null;
  createdAt: string;
}

interface UsersResponse { users: AdminUser[]; total: number; page: number; pageSize: number }
interface UserDetail {
  user: AdminUser;
  goal: { calorieTarget: number; proteinTarget: number; carbsTarget: number; fatTarget: number; fiberTarget: number; dailyBudgetIRR: number; goalType: string };
  mealCount: number;
  meals: Array<{ id: string; food_id: string; foodName: string; grams: number; meal_type: string; date: string; source: string }>;
  ledger: LedgerItem[];
}

const PAGE_SIZE = 20;

function UserDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const detail = useApi<UserDetail>(`/api/admin/users/${id}`);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [proDate, setProDate] = useState('');
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  const user = detail.data?.user;
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPlan(user.plan);
    setRole(user.role);
    setProDate(user.proUntil ? user.proUntil.slice(0, 10) : '');
  }, [user?.id, user?.name, user?.plan, user?.role, user?.proUntil]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (key: string, body: Record<string, unknown>, success: string) => {
    setBusy(key);
    try {
      const result = await api<{ user: AdminUser }>(`/api/admin/users/${id}`, { method: 'PATCH', json: body });
      detail.setData(detail.data ? { ...detail.data, user: result.user } : null);
      toast.success(success);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const addDays = (days: number) => {
    const base = user?.proUntil && new Date(user.proUntil).getTime() > Date.now() ? new Date(user.proUntil) : new Date();
    setProDate(new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10));
  };

  const grant = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(delta);
    if (!Number.isInteger(value) || value === 0 || Math.abs(value) > 10_000) {
      toast.error('مقدار ژتون باید عدد صحیح غیرصفر و حداکثر ۱۰٬۰۰۰ باشد');
      return;
    }
    setBusy('tokens');
    try {
      await api(`/api/admin/users/${id}/tokens`, { method: 'POST', json: { delta: value, note: note.trim() || undefined } });
      toast.success('موجودی ژتون به‌روزرسانی شد');
      setDelta('');
      setNote('');
      detail.reload();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <Dialog title="جزئیات کاربر" drawer onClose={onClose}>
      {detail.loading && !detail.data ? (
        <div className="stack"><Skeleton height={24} /><Skeleton height={120} radius={12} /><Skeleton height={80} radius={12} /></div>
      ) : detail.error && !detail.data ? (
        <ErrorState message={detail.error} onRetry={detail.reload} />
      ) : detail.data && user ? (
        <div className="stack-lg">
          <div className="stack-sm">
            <div className="row">
              <h3>{user.name}</h3>
              <span className={`badge ${user.effectivePlan === 'pro' ? 'badge-pro' : ''}`}>{user.effectivePlan === 'pro' ? 'حرفه‌ای' : 'رایگان'}</span>
              {user.status === 'blocked' && <span className="badge badge-error">مسدود</span>}
              {user.role === 'admin' && <span className="badge badge-info">مدیر</span>}
            </div>
            <dl className="kv">
              <dt>شمارهٔ موبایل</dt><dd className="ltr">{user.phone ? toPersianDigits(user.phone) : '—'}</dd>
              <dt>ایمیل</dt><dd className="ltr">{user.email ?? '—'}</dd>
              <dt>ژتون</dt><dd>{formatNumber(user.tokenBalance)} (سطح {user.level})</dd>
              <dt>کد معرف</dt><dd className="ltr">{user.referralCode}</dd>
              <dt>مشارکت در پژوهش</dt><dd>{user.researchConsent ? 'بله' : 'خیر'}</dd>
              <dt>تعداد وعده‌ها</dt><dd>{formatNumber(detail.data.mealCount)}</dd>
              <dt>هدف</dt><dd>{GOAL_LABELS[detail.data.goal.goalType] ?? detail.data.goal.goalType}، {formatNumber(detail.data.goal.calorieTarget)} کیلوکالری</dd>
              <dt>آخرین ورود</dt><dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}</dd>
              <dt>عضویت</dt><dd>{formatDateTime(user.createdAt)}</dd>
            </dl>
          </div>

          <section className="card stack" aria-label="ویرایش کاربر">
            <h3>ویرایش</h3>
            <form className="row row-nowrap" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); void patch('name', { name: name.trim() }, 'نام به‌روزرسانی شد'); }}>
              <div className="field grow"><label htmlFor="au-name">نام</label><input id="au-name" className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} /></div>
              <button className="btn" type="submit" disabled={busy === 'name' || name.trim().length < 2 || name.trim() === user.name}>ذخیره</button>
            </form>

            <div className="row row-nowrap" style={{ alignItems: 'flex-end' }}>
              <div className="field grow">
                <label htmlFor="au-plan">طرح اشتراک</label>
                <select id="au-plan" className="select" value={plan} onChange={(e) => setPlan(e.target.value as 'free' | 'pro')}>
                  <option value="free">رایگان</option>
                  <option value="pro">حرفه‌ای (دائمی)</option>
                </select>
              </div>
              <button className="btn" type="button" disabled={busy === 'plan' || plan === user.plan} onClick={() => patch('plan', { plan }, 'طرح تغییر کرد')}>اعمال</button>
            </div>

            <div className="stack-sm">
              <div className="row row-nowrap" style={{ alignItems: 'flex-end' }}>
                <div className="field grow">
                  <label htmlFor="au-until">پایان حرفه‌ای موقت</label>
                  <input id="au-until" className="input ltr" type="date" dir="ltr" value={proDate} onChange={(e) => setProDate(e.target.value)} />
                </div>
                <button className="btn" type="button" disabled={busy === 'until'} onClick={() => patch('until', { proUntil: proDate ? `${proDate}T23:59:59.000Z` : null }, proDate ? 'تاریخ پایان ثبت شد' : 'حرفه‌ای موقت حذف شد')}>
                  {proDate ? 'ثبت' : 'حذف'}
                </button>
              </div>
              <div className="row">
                <button className="chip" type="button" onClick={() => addDays(7)}>+۷ روز</button>
                <button className="chip" type="button" onClick={() => addDays(30)}>+۳۰ روز</button>
                <button className="chip" type="button" onClick={() => setProDate('')}>پاک کردن</button>
              </div>
            </div>

            <div className="row row-nowrap" style={{ alignItems: 'flex-end' }}>
              <div className="field grow">
                <label htmlFor="au-role">نقش</label>
                <select id="au-role" className="select" value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')}>
                  <option value="user">کاربر</option>
                  <option value="admin">مدیر</option>
                </select>
              </div>
              <button className="btn" type="button" disabled={busy === 'role' || role === user.role} onClick={() => patch('role', { role }, 'نقش تغییر کرد')}>اعمال</button>
            </div>

            <button
              className={`btn ${user.status === 'active' ? 'btn-danger' : ''}`}
              type="button"
              disabled={busy === 'status'}
              onClick={() => patch('status', { status: user.status === 'active' ? 'blocked' : 'active' }, user.status === 'active' ? 'کاربر مسدود شد' : 'مسدودیت برداشته شد')}
            >
              {user.status === 'active' ? 'مسدود کردن کاربر' : 'رفع مسدودی'}
            </button>
          </section>

          <form className="card stack" onSubmit={grant} aria-label="تنظیم ژتون">
            <h3>تغییر موجودی ژتون</h3>
            <div className="row row-nowrap" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ width: 140 }}>
                <label htmlFor="au-delta">مقدار (منفی = کسر)</label>
                <input id="au-delta" className="input ltr" type="number" dir="ltr" step={1} min={-10000} max={10000} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="50" />
              </div>
              <div className="field grow"><label htmlFor="au-note">یادداشت</label><input id="au-note" className="input" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <button className="btn" type="submit" disabled={busy === 'tokens' || !delta}>ثبت تغییر</button>
          </form>

          <section className="stack-sm">
            <h3>آخرین وعده‌ها</h3>
            {detail.data.meals.length === 0 ? <p className="small muted">وعده‌ای ثبت نشده است.</p> : (
              <div className="table-wrap" style={{ maxHeight: 260, overflow: 'auto' }}>
                <table className="table" style={{ minWidth: 380 }}>
                  <thead><tr><th>تاریخ</th><th>غذا</th><th>وعده</th><th className="num-cell">گرم</th></tr></thead>
                  <tbody>
                    {detail.data.meals.map((m) => (
                      <tr key={m.id}>
                        <td>{formatDate(m.date)}</td>
                        <td>{m.foodName}{m.source === 'camera' && <Icon name="camera" size={12} />}</td>
                        <td>{MEAL_LABELS[m.meal_type] ?? m.meal_type}</td>
                        <td className="num-cell">{formatNumber(m.grams)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="stack-sm">
            <h3>تراکنش‌های ژتون</h3>
            {detail.data.ledger.length === 0 ? <p className="small muted">تراکنشی وجود ندارد.</p> : (
              <ul className="list">
                {detail.data.ledger.map((l, i) => (
                  <li key={`${l.created_at}-${i}`}>
                    <div><strong className="small">{ledgerLabel(l.reason)}</strong><span className="tiny muted" style={{ display: 'block' }}>{formatDateTime(l.created_at)}</span></div>
                    <span className={`ledger-delta ${l.delta >= 0 ? 'plus' : 'minus'}`}>{l.delta >= 0 ? '+' : '−'}{formatNumber(Math.abs(l.delta))}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </Dialog>
  );
}

export function AdminUsers() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const users = useApi<UsersResponse>(`/api/admin/users${query({ q: debounced, plan, page, pageSize: PAGE_SIZE })}`);
  const pages = users.data ? Math.max(1, Math.ceil(users.data.total / users.data.pageSize)) : 1;

  return (
    <div className="stack">
      <div className="filters">
        <div className="field">
          <label htmlFor="user-search">جستجو</label>
          <div className="input-affix">
            <input id="user-search" className="input" type="search" placeholder="نام، موبایل، ایمیل یا کد معرف" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="affix"><Icon name="search" size={18} /></span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="user-plan">طرح اشتراک</label>
          <select id="user-plan" className="select" value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }}>
            <option value="">همه</option>
            <option value="free">رایگان</option>
            <option value="pro">حرفه‌ای</option>
          </select>
        </div>
      </div>

      {users.error && !users.data ? <ErrorState message={users.error} onRetry={users.reload} /> : !users.data ? (
        <div className="stack">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={44} radius={10} />)}</div>
      ) : users.data.users.length === 0 ? (
        <div className="card"><EmptyState icon="users" text="کاربری با این فیلتر پیدا نشد." /></div>
      ) : (
        <>
          <p className="small muted" aria-live="polite">{formatNumber(users.data.total)} کاربر</p>
          <div className="table-wrap" style={users.loading ? { opacity: 0.6 } : undefined}>
            <table className="table">
              <thead><tr><th>نام</th><th>تماس</th><th>طرح</th><th>وضعیت</th><th className="num-cell">ژتون</th><th>عضویت</th><th><span className="sr-only">جزئیات</span></th></tr></thead>
              <tbody>
                {users.data.users.map((u) => (
                  <tr key={u.id} className="clickable-row" onClick={() => setOpenId(u.id)}>
                    <td><strong>{u.name}</strong>{u.role === 'admin' && <span className="badge badge-info" style={{ marginInlineStart: 6 }}>مدیر</span>}</td>
                    <td className="ltr small">{u.phone ? toPersianDigits(u.phone) : u.email ?? '—'}</td>
                    <td><span className={`badge ${u.effectivePlan === 'pro' ? 'badge-pro' : ''}`}>{u.effectivePlan === 'pro' ? 'حرفه‌ای' : 'رایگان'}</span></td>
                    <td>{u.status === 'blocked' ? <span className="badge badge-error">مسدود</span> : <span className="badge badge-success">فعال</span>}</td>
                    <td className="num-cell">{formatNumber(u.tokenBalance)}</td>
                    <td className="small">{formatDate(u.createdAt)}</td>
                    <td><button className="btn btn-ghost btn-sm" type="button" onClick={(e) => { e.stopPropagation(); setOpenId(u.id); }} aria-label={`جزئیات ${u.name}`}>جزئیات</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button className="btn btn-secondary btn-sm" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button>
            <span className="small">صفحهٔ {formatNumber(page)} از {formatNumber(pages)}</span>
            <button className="btn btn-secondary btn-sm" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</button>
          </div>
        </>
      )}

      {openId && <UserDrawer id={openId} onClose={() => setOpenId(null)} onChanged={users.reload} />}
      <Notice icon="shield">مشاهده و ویرایش کاربران در گزارش دسترسی ثبت می‌شود.</Notice>
    </div>
  );
}
