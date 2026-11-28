import { randomUUID } from 'node:crypto';
import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { authRequired, publicUser } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { config } from '../config.js';
import { db, findUserById, now, trackEvent, tx } from '../db.js';
import { parse } from '../domain.js';

export const paymentsRouter = Router();

/** محصولات بازار: شناسه → تعداد روز نسخهٔ حرفه‌ای */
const BAZAAR_PRODUCTS: Record<string, number> = {
  '1000': 30,   // اشتراک یک ماهه
  '1001': 365,  // اشتراک یک ساله
};

function toPem(base64: string): string {
  const cleaned = base64.replace(/\s/g, '');
  return `-----BEGIN PUBLIC KEY-----\n${cleaned}\n-----END PUBLIC KEY-----`;
}

/**
 * بررسی امضای خرید بازار. دادهٔ خرید (رشتهٔ JSON) با کلید عمومی بازار امضا شده است.
 * Bazaar از SHA1withRSA یا SHA256withRSA استفاده می‌کند؛ هر دو را امتحان می‌کنیم.
 */
function verifyBazaarSignature(purchaseData: string, signatureB64: string): boolean {
  if (!config.bazaarRsaPublicKey) return false;
  try {
    const pubKey = createPublicKey(toPem(config.bazaarRsaPublicKey));
    const data = Buffer.from(purchaseData, 'utf8');
    const signature = Buffer.from(signatureB64, 'base64');
    return cryptoVerify('RSA-SHA1', data, pubKey, signature) || cryptoVerify('RSA-SHA256', data, pubKey, signature);
  } catch {
    return false;
  }
}

const verifySchema = z.object({
  purchaseData: z.string().min(10).max(10000),
  signature: z.string().min(10).max(10000),
});

paymentsRouter.use(authRequired);

paymentsRouter.get('/bazaar/products', (_req, res) => {
  res.json({ products: Object.entries(BAZAAR_PRODUCTS).map(([sku, days]) => ({ sku, days, labelFa: days >= 365 ? 'اشتراک یک ساله' : 'اشتراک یک ماهه' })) });
});

paymentsRouter.post('/bazaar/verify', (req: AuthRequest, res) => {
  const input = parse(verifySchema, req.body);
  const user = req.user!;

  let purchase: { orderId?: string; productId?: string; purchaseTime?: number; purchaseState?: number };
  try {
    purchase = JSON.parse(input.purchaseData);
  } catch {
    res.status(400).json({ error: 'دادهٔ خرید معتبر نیست' });
    return;
  }

  const orderId = purchase.orderId ?? '';
  const productId = purchase.productId ?? '';
  if (!orderId || !productId) {
    res.status(400).json({ error: 'دادهٔ خرید ناقص است' });
    return;
  }
  const days = BAZAAR_PRODUCTS[productId];
  if (!days) {
    res.status(400).json({ error: 'محصول خریداری‌شده شناخته‌شده نیست' });
    return;
  }

  // بررسی امضا (در حالت آزمایشی رد می‌شود)
  const signatureValid = config.bazaarTestMode || verifyBazaarSignature(input.purchaseData, input.signature);
  if (!signatureValid) {
    res.status(400).json({ error: 'امضای خرید معتبر نیست' });
    return;
  }

  // idempotent: هر سفارش فقط یک بار
  const existing = db.prepare('SELECT 1 AS x FROM subscriptions WHERE reference = ?').get(orderId);
  if (existing) {
    res.json({ ok: true, alreadyProcessed: true, user: publicUser(findUserById(user.id)!) });
    return;
  }

  const result = tx(() => {
    const fresh = findUserById(user.id)!;
    const base = fresh.pro_until && new Date(fresh.pro_until).getTime() > Date.now() ? new Date(fresh.pro_until) : new Date();
    const proUntil = new Date(base.getTime() + days * 86_400_000).toISOString();
    db.prepare('UPDATE users SET pro_until = ? WHERE id = ?').run(proUntil, fresh.id);
    db.prepare('INSERT INTO subscriptions (id, user_id, plan, provider, reference, amount_irr, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(randomUUID(), fresh.id, 'pro', 'bazaar', orderId, 0, now());
    return proUntil;
  });

  trackEvent('payment.completed', user.id, { provider: 'bazaar', orderId, productId, days });
  res.json({ ok: true, alreadyProcessed: false, user: publicUser(findUserById(user.id)!), proUntil: result });
});
