import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import bcrypt from 'bcryptjs';

import { DEFAULT_GOAL } from '@boshghabyar/core';

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.env.DATABASE_PATH ?? resolve(here, '../data/boshghabyar.db'));
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    plan TEXT NOT NULL DEFAULT 'free',
    calorie_target INTEGER NOT NULL DEFAULT 2000,
    protein_target INTEGER NOT NULL DEFAULT 100,
    carbs_target INTEGER NOT NULL DEFAULT 260,
    fat_target INTEGER NOT NULL DEFAULT 65,
    fiber_target INTEGER NOT NULL DEFAULT 25,
    daily_budget_irr INTEGER NOT NULL DEFAULT 250000,
    goal_type TEXT NOT NULL DEFAULT 'balance',
    created_at TEXT NOT NULL
  );

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

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, created_at);

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    provider TEXT NOT NULL,
    reference TEXT NOT NULL,
    amount_irr INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro';
  calorie_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  fiber_target: number;
  daily_budget_irr: number;
  goal_type: string;
  created_at: string;
}

export interface MealRow {
  id: string;
  user_id: string;
  food_id: string;
  grams: number;
  meal_type: string;
  date: string;
  created_at: string;
}

export const now = (): string => new Date().toISOString();
export const today = (): string => now().slice(0, 10);

export function findUserByEmail(email: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function trackEvent(type: string, userId: string | null = null, payload: Record<string, unknown> = {}): void {
  db.prepare('INSERT INTO events (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)').run(
    crypto.randomUUID(),
    userId,
    type,
    JSON.stringify(payload),
    now(),
  );
}

function seed(): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (count.n > 0) return;

  const createdAt = now();
  const insert = db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, plan,
      calorie_target, protein_target, carbs_target, fat_target, fiber_target,
      daily_budget_irr, goal_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adminHash = bcrypt.hashSync('Admin@12345', 10);
  const demoHash = bcrypt.hashSync('Demo@12345', 10);

  insert.run(
    'admin-boshghabyar', 'مدیر بشقاب‌یار', 'admin@boshghabyar.ir', null, adminHash, 'admin', 'pro',
    DEFAULT_GOAL.calorieTarget, DEFAULT_GOAL.proteinTarget, DEFAULT_GOAL.carbsTarget,
    DEFAULT_GOAL.fatTarget, DEFAULT_GOAL.fiberTarget, DEFAULT_GOAL.dailyBudgetIRR,
    DEFAULT_GOAL.goalType, createdAt,
  );
  insert.run(
    crypto.randomUUID(), 'کاربر نمونه', 'demo@boshghabyar.ir', '09140000000', demoHash, 'user', 'free',
    DEFAULT_GOAL.calorieTarget, DEFAULT_GOAL.proteinTarget, DEFAULT_GOAL.carbsTarget,
    DEFAULT_GOAL.fatTarget, DEFAULT_GOAL.fiberTarget, DEFAULT_GOAL.dailyBudgetIRR,
    DEFAULT_GOAL.goalType, createdAt,
  );
  trackEvent('system.seeded', null, { users: 2 });
}

seed();
