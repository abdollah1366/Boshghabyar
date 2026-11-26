import { randomUUID } from 'node:crypto';

import express, { Router } from 'express';

import { PLAN_LIMITS } from '@boshghabyar/core';

import { authRequired } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { config } from '../config.js';
import { db, now, planOf, today, trackEvent } from '../db.js';
import { foodsFor } from '../domain.js';
import { VisionError, getVisionProvider, sniffImageMime } from '../vision.js';

export const recognizeRouter = Router();

function usedToday(userId: string): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM recognitions WHERE user_id = ? AND day = ?').get(userId, today()) as { n: number }).n;
}

recognizeRouter.get('/status', authRequired, (req: AuthRequest, res) => {
  const limit = PLAN_LIMITS[planOf(req.user!)].recognitionPerDay;
  res.json({
    available: getVisionProvider() !== null,
    provider: getVisionProvider()?.name ?? null,
    limit,
    used: usedToday(req.user!.id),
  });
});

/**
 * تشخیص غذا از روی عکس. بدنهٔ درخواست خود فایل تصویر (image/jpeg|png|webp) است.
 * تصویر روی سرور ذخیره نمی‌شود و فقط برای تشخیص به سرویس بینایی ارسال می‌شود.
 */
recognizeRouter.post(
  '/',
  authRequired,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: config.maxImageBytes }),
  async (req: AuthRequest, res, next) => {
    try {
      const user = req.user!;
      const provider = getVisionProvider();
      if (!provider) {
        res.status(503).json({ error: 'تشخیص غذا با عکس هنوز فعال نشده است؛ غذا را دستی انتخاب کنید', manual: true });
        return;
      }
      const body = req.body as unknown;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: 'تصویر معتبر ارسال نشده است' });
        return;
      }
      const mime = sniffImageMime(body);
      if (!mime) {
        res.status(400).json({ error: 'فقط تصویر JPEG، PNG یا WebP پذیرفته می‌شود' });
        return;
      }

      const limit = PLAN_LIMITS[planOf(user)].recognitionPerDay;
      const used = usedToday(user.id);
      if (used >= limit) {
        res.status(429).json({ error: 'سهمیهٔ امروز تشخیص با عکس تمام شد؛ فردا دوباره امتحان کنید یا نسخهٔ حرفه‌ای بگیرید', limit, used });
        return;
      }

      const foods = foodsFor(user);
      let detection;
      try {
        detection = await provider.recognize(body, mime, foods);
      } catch (error) {
        if (error instanceof VisionError) {
          res.status(error.status).json({ error: error.message, manual: true });
          return;
        }
        res.status(503).json({ error: 'تشخیص غذا موقتاً در دسترس نیست؛ غذا را دستی انتخاب کنید', manual: true });
        return;
      }

      db.prepare('INSERT INTO recognitions (id, user_id, provider, food_id, confidence, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), user.id, provider.name, detection?.foodId ?? null, detection?.confidence ?? null, today(), now());
      trackEvent('food.recognized', user.id, { found: Boolean(detection), provider: provider.name });

      const remaining = Math.max(0, limit - used - 1);
      if (!detection) {
        res.json({ detection: null, remaining, provider: provider.name, messageFa: 'غذا شناسایی نشد؛ لطفاً دستی انتخاب کنید' });
        return;
      }
      const food = foods.find((f) => f.id === detection.foodId)!;
      res.json({
        detection: {
          foodId: food.id,
          foodNameFa: food.nameFa,
          confidence: Math.round(detection.confidence * 100) / 100,
          suggestedGrams: detection.suggestedGrams ?? food.serving.grams,
          alternatives: detection.alternatives.map((a) => ({
            foodId: a.foodId,
            foodNameFa: foods.find((f) => f.id === a.foodId)?.nameFa ?? a.foodId,
            confidence: Math.round(a.confidence * 100) / 100,
          })),
        },
        remaining,
        provider: provider.name,
        demo: provider.name === 'mock',
      });
    } catch (error) {
      next(error);
    }
  },
);
