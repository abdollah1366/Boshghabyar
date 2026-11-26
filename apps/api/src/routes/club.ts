import { Router } from 'express';
import { z } from 'zod';

import { authRequired, publicUser } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { clubState, dailyCheckin, redeemReward } from '../club.js';
import { db, findUserById } from '../db.js';
import { parse } from '../domain.js';

export const clubRouter = Router();
clubRouter.use(authRequired);

clubRouter.get('/', (req: AuthRequest, res) => {
  res.json(clubState(req.user!));
});

clubRouter.post('/checkin', (req: AuthRequest, res) => {
  const result = dailyCheckin(req.user!);
  res.json({ ...result, club: clubState(req.user!) });
});

clubRouter.post('/redeem', (req: AuthRequest, res) => {
  const { rewardId } = parse(z.object({ rewardId: z.string().min(1).max(40) }), req.body);
  const result = redeemReward(req.user!, rewardId);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true, proUntil: result.proUntil, balance: result.balance, user: publicUser(findUserById(req.user!.id)!), club: clubState(req.user!) });
});

clubRouter.get('/ledger', (req: AuthRequest, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 30) || 30));
  const rows = db
    .prepare('SELECT delta, reason, balance_after, created_at FROM token_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(req.user!.id, limit);
  res.json({ ledger: rows });
});
