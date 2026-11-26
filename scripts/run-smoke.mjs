// اجرای تست دود روی یک سرور موقت با پایگاه‌دادهٔ تازه (بدون دست زدن به داده‌های واقعی).
// اجرا: node scripts/run-smoke.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.SMOKE_PORT ?? '3099';
const ADMIN_PASSWORD = 'Smoke-Admin-Pass-1';
const dir = mkdtempSync(join(tmpdir(), 'boshghabyar-smoke-'));

const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT,
  DATABASE_PATH: join(dir, 'smoke.db'),
  ADMIN_PASSWORD,
  AI_PROVIDER: 'mock',
  OTP_DEBUG_RETURN_CODE: 'true',
};

const server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  cwd: join(import.meta.dirname, '..', 'apps', 'api'),
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://localhost:${PORT}/api/health`);
      if (response.ok) return true;
    } catch {
      /* سرور هنوز بالا نیامده است */
    }
    await sleep(500);
  }
  return false;
}

let code = 1;
try {
  if (!(await waitForServer())) throw new Error(`API did not start:\n${log}`);
  code = await new Promise((resolve) => {
    const smoke = spawn(process.execPath, [join(import.meta.dirname, 'smoke.mjs')], {
      env: { ...env, API_BASE: `http://localhost:${PORT}`, ADMIN_PASSWORD },
      stdio: 'inherit',
    });
    smoke.on('exit', (c) => resolve(c ?? 1));
  });
} catch (error) {
  console.error(error);
} finally {
  server.kill();
  await sleep(300);
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* پاک‌سازی فایل موقت اجباری نیست */
  }
}
process.exit(code);
