import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import bcrypt from 'bcryptjs';

import { DEFAULT_GOAL, effectivePlan, referralCodeFromBytes } from '@boshghabyar/core';
import type { Plan } from '@boshghabyar/core';

import { DEFAULT_ADMIN_PASSWORD, DEFAULT_DEMO_PASSWORD, config } from './config.js';

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.env.DATABASE_PATH ?? resolve(here, '../data/boshghabyar.db'));
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA temp_store = MEMORY;');
db.exec('PRAGMA cache_size = -16000;');
db.exec('PRAGMA foreign_keys = ON;');

const USERS_V2 = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    plan TEXT NOT NULL DEFAULT 'free',
    pro_until TEXT,
    calorie_target INTEGER NOT NULL DEFAULT 2000,
    protein_target INTEGER NOT NULL DEFAULT 100,
    carbs_target INTEGER NOT NULL DEFAULT 260,
    fat_target INTEGER NOT NULL DEFAULT 65,
    fiber_target INTEGER NOT NULL DEFAULT 25,
    daily_budget_irr INTEGER NOT NULL DEFAULT 250000,
    goal_type TEXT NOT NULL DEFAULT 'balance',
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    token_balance INTEGER NOT NULL DEFAULT 0,
    tokens_earned INTEGER NOT NULL DEFAULT 0,
    streak_count INTEGER NOT NULL DEFAULT 0,
    last_checkin TEXT,
    research_consent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    last_login_at TEXT,
    created_at TEXT NOT NULL
  )
`;

function tableColumns(table: string): Array<{ name: string; notnull: number }> {
  return db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string; notnull: number }>;
}

function migrateUsers(): void {
  const columns = tableColumns('users');
  if (columns.length === 0) {
    db.exec(USERS_V2);
    return;
  }
  if (columns.some((c) => c.name === 'referral_code')) return;

  // نسخهٔ قدیمی: ایمیل و رمز اجباری بودند. جدول را بدون از دست رفتن داده بازسازی می‌کنیم.
  const legacy = [
    'id', 'name', 'email', 'phone', 'password_hash', 'role', 'plan',
    'calorie_target', 'protein_target', 'carbs_target', 'fat_target', 'fiber_target',
    'daily_budget_irr', 'goal_type', 'created_at',
  ].join(', ');
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec(USERS_V2.replace('CREATE TABLE users', 'CREATE TABLE users_v2'));
    db.exec(`INSERT INTO users_v2 (${legacy}) SELECT ${legacy} FROM users`);
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_v2 RENAME TO users');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

migrateUsers();

db.exec(`
  CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id TEXT NOT NULL,
    grams INTEGER NOT NULL CHECK (grams > 0),
    meal_type TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

  CREATE TABLE IF NOT EXISTS custom_foods (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name_fa TEXT NOT NULL,
    category TEXT NOT NULL,
    per100g TEXT NOT NULL,
    serving_grams INTEGER NOT NULL,
    serving_label TEXT NOT NULL,
    price_irr INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_custom_foods_user ON custom_foods(user_id);

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, created_at);
  CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, created_at);

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    provider TEXT NOT NULL,
    reference TEXT NOT NULL,
    amount_irr INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    user_agent TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed INTEGER NOT NULL DEFAULT 0,
    ip TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, created_at);

  CREATE TABLE IF NOT EXISTS token_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref TEXT,
    balance_after INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ledger_user ON token_ledger(user_id, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_ref ON token_ledger(user_id, reason, ref) WHERE ref IS NOT NULL;

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    rewarded_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

  CREATE TABLE IF NOT EXISTS recognitions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    food_id TEXT,
    confidence REAL,
    day TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_recognitions_user_day ON recognitions(user_id, day);

  CREATE TABLE IF NOT EXISTS admin_audit (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT NOT NULL,
    ip TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit(created_at);
`);

if (!tableColumns('meals').some((c) => c.name === 'source')) {
  db.exec("ALTER TABLE meals ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
}

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  role: 'user' | 'admin';
  plan: Plan;
  pro_until: string | null;
  calorie_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  fiber_target: number;
  daily_budget_irr: number;
  goal_type: string;
  referral_code: string | null;
  referred_by: string | null;
  token_balance: number;
  tokens_earned: number;
  streak_count: number;
  last_checkin: string | null;
  research_consent: number;
  status: 'active' | 'blocked';
  last_login_at: string | null;
  created_at: string;
}

export interface MealRow {
  id: string;
  user_id: string;
  food_id: string;
  grams: number;
  meal_type: string;
  date: string;
  source: string;
  created_at: string;
}

export const now = (): string => new Date().toISOString();

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** تاریخ امروز به وقت تهران (YYYY-MM-DD) تا مرز روز با ساعت ۰۰:۰۰ ایران یکی باشد */
export const today = (at = new Date()): string => dateFormatter.format(at);

export function planOf(user: Pick<UserRow, 'plan' | 'pro_until'>): Plan {
  return effectivePlan(user.plan, user.pro_until);
}

let depth = 0;
/** اجرای چند دستور در یک تراکنش؛ فراخوانی تو در تو امن است */
export function tx<T>(fn: () => T): T {
  if (depth > 0) return fn();
  db.exec('BEGIN IMMEDIATE');
  depth += 1;
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    depth -= 1;
  }
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as UserRow | undefined;
}

export function findUserByPhone(phone: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function findUserByReferralCode(code: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE referral_code = ?').get(code) as UserRow | undefined;
}

export function trackEvent(type: string, userId: string | null = null, payload: Record<string, unknown> = {}): void {
  db.prepare('INSERT INTO events (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)').run(
    randomUUID(),
    userId,
    type,
    JSON.stringify(payload),
    now(),
  );
}

export function newReferralCode(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = referralCodeFromBytes(randomBytes(8));
    if (!findUserByReferralCode(code)) return code;
  }
  throw new Error('could not allocate referral code');
}

function backfillReferralCodes(): void {
  const rows = db.prepare('SELECT id FROM users WHERE referral_code IS NULL').all() as unknown as Array<{ id: string }>;
  const update = db.prepare('UPDATE users SET referral_code = ? WHERE id = ?');
  for (const row of rows) update.run(newReferralCode(), row.id);
}

function seed(): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (count.n > 0) return;

  const createdAt = now();
  const insert = db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, plan, referral_code,
      calorie_target, protein_target, carbs_target, fat_target, fiber_target,
      daily_budget_irr, goal_type, research_consent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let adminPassword = config.adminPassword;
  if (!adminPassword) {
    if (config.isProd) {
      adminPassword = randomBytes(12).toString('base64url');
      console.warn(`[security] رمز مدیر تصادفی ساخته شد (فقط یک بار نمایش داده می‌شود): ${adminPassword}`);
    } else {
      adminPassword = DEFAULT_ADMIN_PASSWORD;
    }
  }

  insert.run(
    'admin-boshghabyar', 'مدیر بشقاب‌یار', config.adminEmail, null, bcrypt.hashSync(adminPassword, 10), 'admin', 'pro',
    newReferralCode(),
    DEFAULT_GOAL.calorieTarget, DEFAULT_GOAL.proteinTarget, DEFAULT_GOAL.carbsTarget,
    DEFAULT_GOAL.fatTarget, DEFAULT_GOAL.fiberTarget, DEFAULT_GOAL.dailyBudgetIRR,
    DEFAULT_GOAL.goalType, 0, createdAt,
  );
  insert.run(
    randomUUID(), 'کاربر نمونه', 'demo@boshghabyar.ir', '09140000000', bcrypt.hashSync(DEFAULT_DEMO_PASSWORD, 10), 'user', 'free',
    newReferralCode(),
    DEFAULT_GOAL.calorieTarget, DEFAULT_GOAL.proteinTarget, DEFAULT_GOAL.carbsTarget,
    DEFAULT_GOAL.fatTarget, DEFAULT_GOAL.fiberTarget, DEFAULT_GOAL.dailyBudgetIRR,
    DEFAULT_GOAL.goalType, 1, createdAt,
  );
  trackEvent('system.seeded', null, { users: 2 });
}

/** اگر رمز مدیر هنوز مقدار پیش‌فرض عمومی است، با ADMIN_PASSWORD عوض می‌شود یا هشدار می‌دهد */
function hardenAdmin(): void {
  const admin = findUserById('admin-boshghabyar');
  if (!admin?.password_hash) return;
  const isDefault = bcrypt.compareSync(DEFAULT_ADMIN_PASSWORD, admin.password_hash);
  if (config.adminPassword) {
    if (!bcrypt.compareSync(config.adminPassword, admin.password_hash)) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(config.adminPassword, 10), admin.id);
      db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(admin.id);
      console.log('[security] رمز مدیر مطابق ADMIN_PASSWORD به‌روز شد.');
    }
    return;
  }
  if (isDefault && config.isProd) {
    console.warn('[security] هشدار: رمز مدیر هنوز مقدار پیش‌فرض عمومی است. ADMIN_PASSWORD را در .env تنظیم کنید.');
  }
}

seed();
backfillReferralCodes();
hardenAdmin();

/** پاک‌سازی دوره‌ای دادهٔ موقت (کدهای پیامکی و نشست‌های منقضی) */
export function cleanupExpired(): void {
  const at = now();
  db.prepare('DELETE FROM otp_codes WHERE expires_at < ?').run(new Date(Date.now() - 86_400_000).toISOString());
  db.prepare('DELETE FROM sessions WHERE expires_at < ? OR revoked = 1').run(at);
}
cleanupExpired();
