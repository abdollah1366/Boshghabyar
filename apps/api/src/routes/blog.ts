import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { authRequired } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { db, now } from '../db.js';
import { audit, clientIp, parse } from '../domain.js';

export const blogRouter = Router();

function publicPost(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMd: row.body_md,
    coverEmoji: row.cover_emoji,
    author: row.author,
    publishedAt: row.published_at,
  };
}

const slugify = (title: string): string =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `post-${Date.now()}`;

// ---------- عمومی ----------

blogRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC').all() as unknown as Array<Record<string, unknown>>;
  res.json({ posts: rows.map(publicPost) });
});

blogRouter.get('/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(req.params.slug) as unknown as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'مطلب پیدا نشد' });
    return;
  }
  res.json({ post: publicPost(row) });
});

// ---------- مدیریت (admin) ----------

export const blogAdminRouter = Router();
blogAdminRouter.use(authRequired);

const postSchema = z.object({
  title: z.string().trim().min(3).max(200),
  excerpt: z.string().trim().max(400).optional(),
  bodyMd: z.string().min(10).max(100_000),
  coverEmoji: z.string().max(8).optional(),
  author: z.string().trim().max(80).optional(),
});

blogAdminRouter.post('/', (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'دسترسی مدیر وجود ندارد' });
    return;
  }
  const input = parse(postSchema, req.body);
  const id = randomUUID();
  const slug = slugify(input.title);
  db.prepare('INSERT INTO blog_posts (id, slug, title, excerpt, body_md, cover_emoji, author, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, slug, input.title, input.excerpt ?? '', input.bodyMd, input.coverEmoji ?? '📝', input.author ?? 'بشقاب‌یار', now(), now());
  audit(req.user!.id, 'admin.blog.create', id, { title: input.title }, clientIp(req));
  res.status(201).json({ id, slug });
});

blogAdminRouter.put('/:id', (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'دسترسی مدیر وجود ندارد' });
    return;
  }
  const input = parse(postSchema, req.body);
  const result = db.prepare('UPDATE blog_posts SET title = ?, excerpt = ?, body_md = ?, cover_emoji = ?, author = ? WHERE id = ?')
    .run(input.title, input.excerpt ?? '', input.bodyMd, input.coverEmoji ?? '📝', input.author ?? 'بشقاب‌یار', req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'مطلب پیدا نشد' });
    return;
  }
  audit(req.user!.id, 'admin.blog.update', req.params.id, { title: input.title }, clientIp(req));
  res.json({ ok: true });
});

blogAdminRouter.delete('/:id', (req: AuthRequest, res) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'دسترسی مدیر وجود ندارد' });
    return;
  }
  const result = db.prepare('DELETE FROM blog_posts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'مطلب پیدا نشد' });
    return;
  }
  audit(req.user!.id, 'admin.blog.delete', req.params.id, {}, clientIp(req));
  res.status(204).end();
});
