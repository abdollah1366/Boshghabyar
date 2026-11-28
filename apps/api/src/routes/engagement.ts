import { randomInt, randomUUID } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { TOKEN_RULES, levelFor } from '@boshghabyar/core';

import { authRequired, publicUser } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { addTokens } from '../club.js';
import { db, findUserById, now, today, trackEvent } from '../db.js';
import { audit, clientIp, parse } from '../domain.js';

export const engagementRouter = Router();

// ---------- برترین‌ها (عمومی) ----------
engagementRouter.get('/leaderboard', (_req, res) => {
  const rows = db.prepare(
    `SELECT id, name, tokens_earned FROM users
     WHERE tokens_earned > 0 AND status = 'active' AND role = 'user'
     ORDER BY tokens_earned DESC LIMIT 25`,
  ).all() as unknown as Array<{ id: string; name: string; tokens_earned: number }>;
  const leaderboard = rows.map((r, i) => {
    const level = levelFor(r.tokens_earned);
    return {
      rank: i + 1,
      name: r.name,
      points: r.tokens_earned,
      level: level.level.labelFa,
    };
  });
  res.json({ leaderboard });
});

// ---------- پاس روزانه (Quiz) ----------

function pickTodayQuestion(): { id: string; question: string; options: string[]; explanation: string } | null {
  const rows = db.prepare('SELECT * FROM quiz_questions ORDER BY id').all() as unknown as Array<{
    id: string; question: string; options: string; correct_index: number; explanation: string;
  }>;
  if (rows.length === 0) return null;
  const dayNum = Math.floor(Date.now() / 86_400_000);
  const row = rows[dayNum % rows.length]!;
  return { id: row.id, question: row.question, options: JSON.parse(row.options), explanation: row.explanation };
}

engagementRouter.get('/quiz/today', authRequired, (req: AuthRequest, res) => {
  const q = pickTodayQuestion();
  if (!q) {
    res.status(404).json({ error: 'مسابقهٔ امروز هنوز آماده نیست' });
    return;
  }
  const answered = db.prepare('SELECT correct FROM quiz_answers WHERE user_id = ? AND day = ?').get(req.user!.id, today());
  res.json({
    question: { id: q.id, question: q.question, options: q.options },
    alreadyAnswered: Boolean(answered),
    wasCorrect: answered ? Boolean(answered.correct) : null,
    explanation: answered ? q.explanation : null,
  });
});

const quizAnswerSchema = z.object({ questionId: z.string().min(1).max(80), answerIndex: z.number().int().min(0).max(10) });

engagementRouter.post('/quiz/answer', authRequired, (req: AuthRequest, res) => {
  const input = parse(quizAnswerSchema, req.body);
  const user = req.user!;
  const existing = db.prepare('SELECT 1 AS x FROM quiz_answers WHERE user_id = ? AND day = ?').get(user.id, today());
  if (existing) {
    res.status(409).json({ error: 'امروز قبلاً به مسابقه جواب داده‌اید' });
    return;
  }
  const q = pickTodayQuestion();
  if (!q || q.id !== input.questionId) {
    res.status(400).json({ error: 'سوال مسابقه تغییر کرده است' });
    return;
  }
  const row = db.prepare('SELECT correct_index, explanation FROM quiz_questions WHERE id = ?').get(q.id) as { correct_index: number; explanation: string };
  const correct = input.answerIndex === row.correct_index;
  db.prepare('INSERT INTO quiz_answers (id, user_id, question_id, correct, day, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), user.id, q.id, correct ? 1 : 0, today(), now());
  const amount = correct ? TOKEN_RULES.quizCorrect : TOKEN_RULES.quizWrong;
  const reward = addTokens(user.id, amount, correct ? 'quiz-correct' : 'quiz-wrong', today());
  trackEvent('quiz.answered', user.id, { correct });
  res.json({
    correct,
    explanation: row.explanation,
    tokensEarned: reward.ok ? amount : 0,
    balance: reward.balance,
  });
});

// ---------- هدیهٔ شانسی روزانه (متغیر برای درگیری بیشتر) ----------
engagementRouter.post('/club/surprise', authRequired, (req: AuthRequest, res) => {
  const user = req.user!;
  const amount = randomInt(1, 6);
  const reward = addTokens(user.id, amount, 'surprise-gift', today());
  if (!reward.ok) {
    res.json({ ok: false, alreadyDone: true, amount: 0, balance: reward.balance });
    return;
  }
  trackEvent('club.surprise', user.id, { amount });
  res.json({ ok: true, alreadyDone: false, amount, balance: reward.balance });
});

// ---------- فهرست متخصصان تغذیه (عمومی) ----------
engagementRouter.get('/nutritionists', (_req, res) => {
  const rows = db.prepare(
    `SELECT u.id, u.name, p.bio, p.specialties, p.city, p.price_irr, p.avatar_emoji, p.contact_phone, p.verified, u.created_at
     FROM users u JOIN nutritionist_profiles p ON p.user_id = u.id
     WHERE u.role = 'nutritionist' AND u.status = 'active'
     ORDER BY p.verified DESC, u.created_at DESC LIMIT 100`,
  ).all() as unknown as Array<Record<string, unknown>>;
  res.json({
    nutritionists: rows.map((r) => ({
      id: r.id,
      name: r.name,
      bio: r.bio,
      specialties: r.specialties,
      city: r.city,
      priceIRR: r.price_irr,
      avatarEmoji: r.avatar_emoji,
      contactPhone: r.contact_phone,
      verified: Boolean(r.verified),
    })),
  });
});

// ---------- پروفایل متخصص (خودش) ----------
engagementRouter.get('/me/profile', authRequired, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== 'nutritionist' && user.role !== 'admin') {
    res.status(403).json({ error: 'فقط متخصص تغذیه' });
    return;
  }
  const profile = db.prepare('SELECT * FROM nutritionist_profiles WHERE user_id = ?').get(user.id) as Record<string, unknown> | undefined;
  res.json({ profile: profile ?? null, referralCode: user.referral_code });
});

const profileSchema = z.object({
  bio: z.string().max(1000).optional(),
  specialties: z.string().max(400).optional(),
  city: z.string().max(80).optional(),
  priceIRR: z.number().int().min(0).max(10_000_000).optional(),
  avatarEmoji: z.string().max(8).optional(),
  contactPhone: z.string().max(20).optional(),
});

engagementRouter.put('/me/profile', authRequired, (req: AuthRequest, res) => {
  const user = req.user!;
  if (user.role !== 'nutritionist' && user.role !== 'admin') {
    res.status(403).json({ error: 'فقط متخصص تغذیه' });
    return;
  }
  const input = parse(profileSchema, req.body);
  const existing = db.prepare('SELECT 1 AS x FROM nutritionist_profiles WHERE user_id = ?').get(user.id);
  if (existing) {
    db.prepare('UPDATE nutritionist_profiles SET bio=?, specialties=?, city=?, price_irr=?, avatar_emoji=?, contact_phone=? WHERE user_id=?')
      .run(input.bio ?? '', input.specialties ?? '', input.city ?? '', input.priceIRR ?? 0, input.avatarEmoji ?? '👩‍⚕️', input.contactPhone ?? null, user.id);
  } else {
    db.prepare('INSERT INTO nutritionist_profiles (user_id, bio, specialties, city, price_irr, avatar_emoji, contact_phone, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(user.id, input.bio ?? '', input.specialties ?? '', input.city ?? '', input.priceIRR ?? 0, input.avatarEmoji ?? '👩‍⚕️', input.contactPhone ?? null, now());
  }
  res.json({ ok: true });
});

// ---------- ساخت سوال مسابقه (admin) ----------
const quizCreateSchema = z.object({
  question: z.string().min(5).max(400),
  options: z.array(z.string().min(1).max(120)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  explanation: z.string().max(500).optional(),
});

engagementRouter.post('/admin/quiz', authRequired, (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'فقط مدیر' });
    return;
  }
  const input = parse(quizCreateSchema, req.body);
  if (input.correctIndex >= input.options.length) {
    res.status(400).json({ error: 'شاخص پاسخ درست از بازه بیرون است' });
    return;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO quiz_questions (id, question, options, correct_index, explanation, created_at) VALUES (?,?,?,?,?,?)')
    .run(id, input.question, JSON.stringify(input.options), input.correctIndex, input.explanation ?? '', now());
  audit(req.user!.id, 'admin.quiz.create', id, { question: input.question }, clientIp(req));
  res.status(201).json({ id });
});

// ---------- مدیریت پروفایل متخصص (admin) ----------
engagementRouter.put('/admin/nutritionists/:id', authRequired, (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'فقط مدیر' });
    return;
  }
  const input = parse(profileSchema.extend({ verified: z.boolean().optional() }), req.body);
  const targetId = String(req.params.id);
  const existing = db.prepare('SELECT 1 AS x FROM nutritionist_profiles WHERE user_id = ?').get(targetId);
  if (existing) {
    db.prepare('UPDATE nutritionist_profiles SET bio=?, specialties=?, city=?, price_irr=?, avatar_emoji=?, contact_phone=?, verified=? WHERE user_id=?')
      .run(input.bio ?? '', input.specialties ?? '', input.city ?? '', input.priceIRR ?? 0, input.avatarEmoji ?? '👩‍⚕️', input.contactPhone ?? null, input.verified ? 1 : 0, targetId);
  } else {
    db.prepare('INSERT INTO nutritionist_profiles (user_id, bio, specialties, city, price_irr, avatar_emoji, contact_phone, verified, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(targetId, input.bio ?? '', input.specialties ?? '', input.city ?? '', input.priceIRR ?? 0, input.avatarEmoji ?? '👩‍⚕️', input.contactPhone ?? null, input.verified ? 1 : 0, now());
  }
  res.json({ ok: true });
});
