import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ZodError } from 'zod';

import { prepareDemo } from './club.js';
import { config } from './config.js';
import { cleanupExpired, db, now } from './db.js';
import { BAD_REQUEST } from './domain.js';
import { adminRouter } from './routes/admin.js';
import { appRouter } from './routes/app.js';
import { authRouter, meRouter } from './routes/auth.js';
import { clubRouter } from './routes/club.js';
import { healthRouter } from './routes/health.js';
import { recognizeRouter } from './routes/recognize.js';
import { reportsRouter } from './routes/reports.js';
import { getVisionProvider } from './vision.js';

if (config.enableDemo) prepareDemo();

const app = express();

const trust = config.trustProxy;
app.set('trust proxy', trust === 'true' ? true : trust === 'false' ? false : /^\d+$/.test(trust) ? Number(trust) : trust);
app.set('etag', 'strong');
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, maxAge: 86_400 }));
app.use(compression());
app.use(express.json({ limit: '64kb' }));

app.use((req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (ms > 1000 || res.statusCode >= 500) {
      console.warn(`[slow/error] ${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(0)}ms`);
    }
  });
  next();
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید' },
  }),
);

app.get('/api/health', (_req, res) => {
  let database = true;
  try {
    db.prepare('SELECT 1').get();
  } catch {
    database = false;
  }
  res.status(database ? 200 : 503).json({
    ok: database,
    service: 'boshghabyar-api',
    version: '0.2.0',
    time: now(),
    features: {
      otp: config.smsProvider !== 'console' || config.otpDebugReturnCode,
      recognition: getVisionProvider() !== null,
      demo: config.enableDemo,
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/club', clubRouter);
app.use('/api/health', healthRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/recognize', recognizeRouter);
app.use('/api/admin', adminRouter);
app.use('/api', appRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'مسیر درخواستی پیدا نشد' });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: error.issues.find((i) => i.code === 'custom')?.message ?? BAD_REQUEST,
      details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  const typed = error as { type?: string; status?: number };
  if (typed.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'قالب درخواست معتبر نیست' });
    return;
  }
  if (typed.type === 'entity.too.large') {
    res.status(413).json({ error: 'حجم درخواست بیش از حد مجاز است' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'خطای داخلی سرور؛ لطفاً دوباره تلاش کنید' });
});

const server = app.listen(config.port, () => {
  console.log(`BoshghabYar API on http://localhost:${config.port} (${config.env})`);
  if (!config.isProd) {
    console.log('Demo: دکمهٔ «ورود آزمایشی» یا demo@boshghabyar.ir | مدیر: admin@boshghabyar.ir (رمز در ADMIN_PASSWORD یا مقدار پیش‌فرض توسعه)');
  }
  if (config.otpDebugReturnCode && config.smsProvider === 'console') {
    console.warn('[otp] حالت آزمایشی فعال است: کد ورود در پاسخ API برگردانده می‌شود. در محیط واقعی SMS_PROVIDER را تنظیم کنید.');
  }
});

const cleanup = setInterval(cleanupExpired, 6 * 3_600_000);
cleanup.unref();

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  clearInterval(cleanup);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('unhandledRejection', reason));
