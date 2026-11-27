// ساخت ۸ کاربر نمایشی با تاریخچهٔ کامل برای دمو و رویداد ایده‌ها.
// اجرا: node scripts/seed-demo.mjs
// این اسکریپت idempotent است: اگر ایمیل کاربر وجود داشته باشد، از آن رد می‌شود.
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.env.DATABASE_PATH ?? resolve(here, '../apps/api/data/boshghabyar.db'));
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = ON;');

const now = () => new Date().toISOString();
const tehranDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
const today = () => tehranDate();
const isoDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return tehranDate(d);
};

// PRNG قطعی برای بازتولیدپذیری
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOOD_IDS = [
  'chelow-kebab-koobideh', 'joojeh-kebab', 'chelow-rice', 'ghormeh-sabzi', 'gheyme',
  'ash-reshte', 'soup-jow', 'nan-lavash', 'nan-sangak', 'panir-safid', 'egh-jaft-abpaz',
  'mast-sade', 'sib', 'mooz', 'porteghal', 'khorma', 'adas-polo', 'sabzi-polo-mahi',
  'koofteh-tabrizi', 'dolmeh-barg-mo', 'kashke-bademjan', 'shole-zard', 'halim', 'doogh', 'salat-olivieh',
];

const BREAKFAST = ['panir-safid', 'egh-jaft-abpaz', 'halim', 'shole-zard'];
const LUNCH = ['chelow-kebab-koobideh', 'joojeh-kebab', 'ghormeh-sabzi', 'gheyme', 'adas-polo', 'sabzi-polo-mahi', 'koofteh-tabrizi', 'salat-olivieh'];
const DINNER = ['soup-jow', 'ash-reshte', 'salat-olivieh', 'kashke-bademjan', 'dolmeh-barg-mo', 'chelow-kebab-koobideh'];
const SNACK = ['sib', 'mooz', 'porteghal', 'khorma', 'doogh', 'mast-sade'];

function insertMeal(userId, foodId, grams, mealType, date, source = 'manual') {
  db.prepare('INSERT INTO meals (id, user_id, food_id, grams, meal_type, date, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, foodId, grams, mealType, date, source, now());
}

function insertHealth(userId, type, value, unit, measuredAt) {
  db.prepare('INSERT INTO health_measurements (id, user_id, type, value, unit, measured_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, type, value, unit, measuredAt, now());
}

function userExists(email) {
  return Boolean(db.prepare('SELECT 1 AS x FROM users WHERE email = ?').get(email));
}

function createUser(def) {
  if (userExists(def.email)) {
    console.log(`skip (exists): ${def.name}`);
    return db.prepare('SELECT id FROM users WHERE email = ?').get(def.email).id;
  }
  const id = randomUUID();
  const referral = createHash('md5').update(def.email).digest('hex').slice(0, 7).toUpperCase();
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, plan, pro_until,
      calorie_target, protein_target, carbs_target, fat_target, fiber_target, daily_budget_irr, goal_type,
      referral_code, token_balance, tokens_earned, streak_count, last_checkin, research_consent, status, last_login_at, created_at)
    VALUES (?, ?, ?, ?, NULL, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)
  `).run(
    id, def.name, def.email, def.phone, def.plan ?? 'free', def.proUntil ?? null,
    def.goal.calorieTarget, def.goal.proteinTarget, def.goal.carbsTarget, def.goal.fatTarget, def.goal.fiberTarget, def.goal.dailyBudgetIRR, def.goal.goalType,
    referral, def.tokenBalance ?? 0, def.tokensEarned ?? 0, def.streak ?? 0, def.lastCheckin ?? null, def.lastLoginAt ?? now(), def.createdAt ?? now(),
  );
  console.log(`created: ${def.name} (${def.email})`);
  return id;
}

const GOAL = {
  'balance': { calorieTarget: 2000, proteinTarget: 100, carbsTarget: 260, fatTarget: 65, fiberTarget: 25, dailyBudgetIRR: 250000, goalType: 'balance' },
  'weight-loss': { calorieTarget: 1800, proteinTarget: 110, carbsTarget: 200, fatTarget: 55, fiberTarget: 30, dailyBudgetIRR: 250000, goalType: 'weight-loss' },
  'muscle-gain': { calorieTarget: 2600, proteinTarget: 150, carbsTarget: 320, fatTarget: 70, fiberTarget: 30, dailyBudgetIRR: 400000, goalType: 'muscle-gain' },
  'budget': { calorieTarget: 2000, proteinTarget: 90, carbsTarget: 250, fatTarget: 60, fiberTarget: 25, dailyBudgetIRR: 150000, goalType: 'budget' },
};

/**
 * def: { name, email, phone, plan, goal, days, adherence (0..1),
 *        mealsPerDay, tokens, weightTrend {start,end} }
 * adherence: 1 = هر روز کامل، 0 = پراکنده
 */
function seedPersona(def) {
  const id = createUser(def);
  const rnd = mulberry32(def.seed ?? 1);
  const days = def.days;
  // ثبت وعده‌ها
  for (let d = 0; d < days; d += 1) {
    // روزهایی که ثبت دارد
    if (rnd() > def.adherence && d > 0) continue;
    const date = isoDate(days - 1 - d);
    const mealsToday = Math.max(1, Math.min(4, Math.round(def.mealsPerDay * (0.7 + rnd() * 0.6))));
    const picks = new Set();
    for (let m = 0; m < mealsToday; m += 1) {
      const type = m === 0 ? 'breakfast' : m === 1 ? 'lunch' : m === 2 ? 'dinner' : 'snack';
      const pool = type === 'breakfast' ? BREAKFAST : type === 'lunch' ? LUNCH : type === 'dinner' ? DINNER : SNACK;
      const food = pool[Math.floor(rnd() * pool.length)];
      if (picks.has(food)) continue;
      picks.add(food);
      const grams = type === 'breakfast' ? 80 + Math.floor(rnd() * 60) : type === 'snack' ? 100 + Math.floor(rnd() * 80) : 180 + Math.floor(rnd() * 120);
      insertMeal(id, food, grams, type, date);
    }
  }
  // روند وزن (اگر تعریف شده باشد)
  if (def.weightTrend) {
    const { start, end, weekly } = def.weightTrend;
    const steps = Math.max(1, Math.floor(days / (weekly ?? 7)));
    for (let i = 0; i <= steps; i += 1) {
      const frac = i / steps;
      const value = Math.round((start + (end - start) * frac) * 10) / 10;
      insertHealth(id, 'weight', value, 'kg', isoDate(Math.max(0, Math.floor(days * (1 - frac)))));
    }
  }
  // قند خون نمونه (اگر تعریف شده باشد)
  if (def.bloodSugar) {
    for (let i = 0; i < Math.min(days, 12); i += 1) {
      insertHealth(id, 'blood_sugar', Math.round(def.bloodSugar + (rnd() * 30 - 15)), 'mg/dL', isoDate(Math.floor(rnd() * days)));
    }
  }
  if (def.hba1c) {
    insertHealth(id, 'hba1c', def.hba1c, '%', isoDate(1));
  }
  return id;
}

// ============ ۸ پرسونا ============
const personas = [
  {
    name: 'سارا احمدی', email: 'sara.demo@boshghabyar.ir', phone: '09121000001', plan: 'free',
    goal: GOAL['weight-loss'], days: 7, adherence: 1.0, mealsPerDay: 4, seed: 11, tokens: 120,
    weightTrend: { start: 71, end: 70.4 }, bloodSugar: 95, hba1c: 5.2,
    desc: 'یک هفته، پایبند، به هدف رسیده',
  },
  {
    name: 'علی محمدی', email: 'ali.demo@boshghabyar.ir', phone: '09121000002', plan: 'free',
    goal: GOAL['balance'], days: 10, adherence: 0.35, mealsPerDay: 2, seed: 22, tokens: 40,
    weightTrend: { start: 82, end: 82.5 }, bloodSugar: 110,
    desc: 'ده روز، ناپایبند، فقط بعضی روزها ثبت کرده',
  },
  {
    name: 'مریم رضایی', email: 'maryam.demo@boshghabyar.ir', phone: '09121000003', plan: 'pro',
    goal: GOAL['weight-loss'], days: 100, adherence: 0.9, mealsPerDay: 4, seed: 33, tokens: 900,
    weightTrend: { start: 78, end: 70 }, bloodSugar: 92, hba1c: 5.1,
    desc: 'صد روز، پایبند، ۸ کیلو کاهش وزن',
  },
  {
    name: 'رضا کریمی', email: 'reza.demo@boshghabyar.ir', phone: '09121000004', plan: 'pro',
    goal: GOAL['muscle-gain'], days: 180, adherence: 0.95, mealsPerDay: 4, seed: 44, tokens: 1600,
    weightTrend: { start: 70, end: 76 }, bloodSugar: 90,
    desc: 'شش ماه، پایبند، افزایش عضله',
  },
  {
    name: 'ندا حسینی', email: 'neda.demo@boshghabyar.ir', phone: '09121000005', plan: 'pro',
    goal: GOAL['weight-loss'], days: 365, adherence: 0.9, mealsPerDay: 4, seed: 55, tokens: 3000,
    weightTrend: { start: 88, end: 74 }, bloodSugar: 94, hba1c: 5.0,
    desc: 'یک سال، پایبند، کاهش وزن موفق',
  },
  {
    name: 'امیر قاسمی', email: 'amir.demo@boshghabyar.ir', phone: '09121000006', plan: 'pro',
    goal: GOAL['weight-loss'], days: 180, adherence: 1.0, mealsPerDay: 5, seed: 66, tokens: 1100,
    weightTrend: { start: 85, end: 84.5 }, bloodSugar: 120, hba1c: 6.2,
    desc: 'شش ماه، ثبت کامل ولی ناپایبند به هدف (کالری بالا)',
  },
  {
    name: 'لیلا موسوی', email: 'leila.demo@boshghabyar.ir', phone: '09121000007', plan: 'pro',
    goal: GOAL['weight-loss'], days: 365, adherence: 0.9, mealsPerDay: 4, seed: 77, tokens: 2800,
    weightTrend: { start: 80, end: 77 }, bloodSugar: 100, hba1c: 5.6,
    desc: 'یک سال، پایبند ولی به هدف نرسیده (توقف وزن)',
  },
  {
    name: 'حسین عباسی', email: 'hossein.demo@boshghabyar.ir', phone: '09121000008', plan: 'pro',
    goal: GOAL['balance'], days: 730, adherence: 0.85, mealsPerDay: 4, seed: 88, tokens: 5000,
    weightTrend: { start: 95, end: 78, weekly: 14 }, bloodSugar: 92, hba1c: 5.0,
    desc: 'دو سال، موفق و پایدار (نگهداشت وزن)',
  },
];

for (const p of personas) {
  seedPersona(p);
}

console.log(`\nانجام شد. ۸ کاربر نمایشی آماده است (مجموع ${db.prepare('SELECT COUNT(*) AS n FROM users').get().n} کاربر).`);
console.log('برای مقایسه به پنل ادمین بروید: /admin → کاربران');
db.close();
