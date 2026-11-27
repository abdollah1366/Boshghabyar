// تست دودی سراسری API در حال اجرا. اجرا: node scripts/smoke.mjs
// پیش‌نیاز: سرور با AI_PROVIDER=mock و (در صورت نیاز) ADMIN_PASSWORD اجرا شده باشد.
const BASE = process.env.API_BASE ?? 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@boshghabyar.ir';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@12345';
const results = [];

async function call(path, { method = 'GET', token, body, raw, headers: extra = {} } = {}) {
  const headers = { Accept: 'application/json', ...extra };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed, text, hasBom };
}

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const randomPhone = () => `09${String(Math.floor(100000000 + Math.random() * 899999999))}`;

async function otpLogin(phone, extra = {}) {
  const requested = await call('/api/auth/otp/request', { method: 'POST', body: { phone } });
  if (requested.status !== 200 || !requested.body.devCode) {
    throw new Error(`otp request failed: ${requested.status} ${requested.text}`);
  }
  const verified = await call('/api/auth/otp/verify', { method: 'POST', body: { phone, code: requested.body.devCode, ...extra } });
  return { requested, verified };
}

// کوچک‌ترین JPEG معتبر از نظر امضا؛ برای تست تشخیص با ارائه‌دهندهٔ آزمایشی کافی است
const fakeJpeg = (seed) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]), Buffer.from(String(seed).padEnd(32, 'x'))]);

async function main() {
  const health = await call('/api/health');
  check('health', health.status === 200 && health.body.ok === true);

  // ---------- ورود آسان با کد پیامکی ----------
  const phoneA = randomPhone();
  const badPhone = await call('/api/auth/otp/request', { method: 'POST', body: { phone: '12345' } });
  check('otp rejects invalid phone', badPhone.status === 400, `status=${badPhone.status}`);

  const a = await otpLogin(phoneA, { name: 'کاربر الف', researchConsent: true });
  check('otp login creates new user', a.verified.status === 200 && a.verified.body.isNew === true && a.verified.body.user.plan === 'free');
  check('welcome tokens granted', a.verified.body.user.tokenBalance === 30, `balance=${a.verified.body.user.tokenBalance}`);
  const tokenA = a.verified.body.token;
  const codeA = a.verified.body.user.referralCode;
  check('referral code issued', typeof codeA === 'string' && codeA.length === 7);

  const again = await call('/api/auth/otp/request', { method: 'POST', body: { phone: phoneA } });
  check('otp resend throttled', again.status === 429, `status=${again.status}`);

  const wrong = await call('/api/auth/otp/verify', { method: 'POST', body: { phone: phoneA, code: '00000' } });
  check('wrong or consumed otp rejected', wrong.status === 400, `status=${wrong.status}`);

  const persianDigits = await call('/api/auth/otp/request', { method: 'POST', body: { phone: '۰۹۱۴۰۰۰۰۰۰۰' } });
  check('persian digits phone accepted', persianDigits.status === 200 || persianDigits.status === 429, `status=${persianDigits.status}`);

  const demo = await call('/api/auth/demo', { method: 'POST' });
  check('one-tap demo login', demo.status === 200 && demo.body.user.email === 'demo@boshghabyar.ir');

  // ---------- معرفی به دوستان ----------
  const phoneB = randomPhone();
  const b = await otpLogin(phoneB, { referralCode: codeA.toLowerCase() });
  check('referred user gets invitee bonus', b.verified.body.user.tokenBalance === 40, `balance=${b.verified.body.user.tokenBalance}`);
  const tokenB = b.verified.body.token;

  const clubA0 = await call('/api/club', { token: tokenA });
  check('inviter has pending referral', clubA0.status === 200 && clubA0.body.invitedCount === 1 && clubA0.body.balance === 30);

  const mealB = await call('/api/meals', { method: 'POST', token: tokenB, body: { foodId: 'ghormeh-sabzi', grams: 200, mealType: 'lunch' } });
  check('meal created and first-meal tokens', mealB.status === 201 && mealB.body.tokensEarned === 3, `earned=${mealB.body.tokensEarned}`);
  const clubA1 = await call('/api/club', { token: tokenA });
  check('inviter rewarded after first meal', clubA1.body.balance === 80 && clubA1.body.rewardedCount === 1, `balance=${clubA1.body.balance}`);
  await call('/api/meals', { method: 'POST', token: tokenB, body: { foodId: 'sib', grams: 100, mealType: 'snack' } });
  const clubA2 = await call('/api/club', { token: tokenA });
  check('referral reward is idempotent', clubA2.body.balance === 80, `balance=${clubA2.body.balance}`);

  // ---------- باشگاه: ورود روزانه و جایزه ----------
  const c1 = await call('/api/club/checkin', { method: 'POST', token: tokenA });
  check('daily check-in awards tokens', c1.status === 200 && c1.body.awarded === 2 && c1.body.streak === 1);
  const c2 = await call('/api/club/checkin', { method: 'POST', token: tokenA });
  check('second check-in same day blocked', c2.body.alreadyDone === true && c2.body.awarded === 0);
  const poor = await call('/api/club/redeem', { method: 'POST', token: tokenA, body: { rewardId: 'pro-3d' } });
  check('redeem blocked without enough tokens', poor.status === 400, `status=${poor.status}`);
  const noReward = await call('/api/club/redeem', { method: 'POST', token: tokenA, body: { rewardId: 'nope' } });
  check('unknown reward rejected', noReward.status === 400);

  // ---------- گزارش‌های رایگان و پولی ----------
  const weekly = await call('/api/reports/weekly?days=7', { token: tokenB });
  check('free weekly report available', weekly.status === 200 && weekly.body.trend.length === 7 && weekly.body.advanced === false);
  const lockedDetailed = await call('/api/reports/detailed?days=30', { token: tokenB });
  check('detailed report locked for free', lockedDetailed.body.locked === true && !('report' in lockedDetailed.body));
  const lockedCsv = await call('/api/reports/export.csv', { token: tokenB });
  check('csv export locked for free', lockedCsv.status === 403 && lockedCsv.body.upgradeRequired === true);

  // ---------- ادمین ----------
  const adminLogin = await call('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  check('admin password login', adminLogin.status === 200 && adminLogin.body.user.role === 'admin', `status=${adminLogin.status}`);
  const admin = { token: adminLogin.body.token };
  const userForbidden = await call('/api/admin/overview', { token: tokenB });
  check('admin panel forbidden for user', userForbidden.status === 403);

  const idA = a.verified.body.user.id;
  const grant = await call(`/api/admin/users/${idA}/tokens`, { method: 'POST', token: admin.token, body: { delta: 500, note: 'smoke' } });
  check('admin can grant tokens', grant.status === 200 && grant.body.balance === 582, `balance=${grant.body.balance}`);

  const redeem = await call('/api/club/redeem', { method: 'POST', token: tokenA, body: { rewardId: 'pro-3d' } });
  check('redeem unlocks temporary pro', redeem.status === 200 && redeem.body.user.plan === 'pro' && Boolean(redeem.body.proUntil), `status=${redeem.status}`);
  const detailed = await call('/api/reports/detailed?days=30', { token: tokenA });
  check('detailed report unlocked on pro', detailed.status === 200 && detailed.body.locked === false && detailed.body.report.trend.length === 30);
  const csv = await call('/api/reports/export.csv?days=30', { token: tokenA });
  check('csv export works on pro (BOM + header)', csv.status === 200 && csv.hasBom && csv.text.includes('کیلوکالری'));

  const overview = await call('/api/admin/overview', { token: admin.token });
  check('admin overview has club stats', overview.status === 200 && overview.body.club.tokensIssued > 0 && overview.body.users >= 4);
  const users = await call('/api/admin/users?q=' + encodeURIComponent(phoneA.slice(0, 7)), { token: admin.token });
  check('admin can search users', users.status === 200 && users.body.users.some((u) => u.id === idA));
  const detail = await call(`/api/admin/users/${idA}`, { token: admin.token });
  check('admin can inspect user data', detail.status === 200 && detail.body.user.id === idA);

  const summary = await call('/api/admin/research/summary?minGroup=1', { token: admin.token });
  check('research summary returns aggregates', summary.status === 200 && summary.body.users >= 0 && Array.isArray(summary.body.byMealType));
  const exportCsv = await call('/api/admin/research/export?format=csv', { token: admin.token });
  check('research export is pseudonymized', exportCsv.status === 200 && !exportCsv.text.includes('@') && exportCsv.text.includes('pseudo_user'));
  const rawNoReason = await call('/api/admin/research/export?anonymize=false', { token: admin.token });
  check('raw export requires a reason', rawNoReason.status === 400);
  const rawWithReason = await call('/api/admin/research/export?anonymize=false&scope=all&format=json&reason=' + encodeURIComponent('بررسی کیفیت داده برای گزارش پژوهشی'), { token: admin.token });
  check('raw export allowed with reason', rawWithReason.status === 200);
  const auditLog = await call('/api/admin/audit?limit=20', { token: admin.token });
  check('admin data access is audited', auditLog.status === 200 && auditLog.body.audit.some((r) => r.action === 'admin.research.export'));
  const patch = await call(`/api/admin/users/${a.verified.body.user.id}`, { method: 'PATCH', token: admin.token, body: { name: 'کاربر الف ویرایش‌شده' } });
  check('admin can edit user', patch.status === 200 && patch.body.user.name.includes('ویرایش'));

  // ---------- تشخیص غذا با عکس ----------
  const statusR = await call('/api/recognize/status', { token: tokenB });
  check('recognition status endpoint', statusR.status === 200 && statusR.body.limit === 5);
  const noAuth = await call('/api/recognize', { method: 'POST', raw: fakeJpeg(1), headers: { 'Content-Type': 'image/jpeg' } });
  check('recognition requires auth', noAuth.status === 401);
  const badImage = await call('/api/recognize', { method: 'POST', token: tokenB, raw: Buffer.from('this is not an image at all'), headers: { 'Content-Type': 'image/jpeg' } });
  check('recognition rejects fake image bytes', badImage.status === 400, `status=${badImage.status}`);
  if (statusR.body.available) {
    const ok = await call('/api/recognize', { method: 'POST', token: tokenB, raw: fakeJpeg(2), headers: { 'Content-Type': 'image/jpeg' } });
    check('recognition maps to a known food', ok.status === 200 && ok.body.detection && typeof ok.body.detection.foodId === 'string' && ok.body.remaining === 4, `status=${ok.status}`);
    let last = ok;
    for (let i = 3; i < 8; i += 1) {
      last = await call('/api/recognize', { method: 'POST', token: tokenB, raw: fakeJpeg(i), headers: { 'Content-Type': 'image/jpeg' } });
    }
    check('recognition daily quota enforced for free', last.status === 429, `status=${last.status}`);
  } else {
    check('recognition unavailable returns manual fallback', badImage.status === 503 || badImage.status === 400);
  }

  // ---------- ورود قدیمی با ایمیل/رمز غیرفعال است؛ فقط مدیر ----------
  const registered = await call('/api/auth/register', { method: 'POST', body: {
    name: 'کاربر آزمایشی', email: `smoke-${crypto.randomUUID()}@example.com`, password: 'Smoke@12345',
  } });
  check('email register disabled', registered.status === 404, `status=${registered.status}`);
  const userLoginBlocked = await call('/api/auth/login', { method: 'POST', body: { email: 'demo@boshghabyar.ir', password: 'Demo@12345' } });
  check('email login blocked for non-admin', userLoginBlocked.status === 403, `status=${userLoginBlocked.status}`);

  // کاربر رایگان تازه با OTP برای قواعد طرح
  const phoneC = randomPhone();
  const c = await otpLogin(phoneC);
  const legacy = c.verified.body.token;
  const foods = await call('/api/foods', { token: legacy });
  check('free food list = 20', foods.status === 200 && foods.body.count === 20, `count=${foods.body.count}`);
  check('pro foods hidden from free', !foods.body.foods.some((f) => f.id === 'kashke-bademjan'));
  const custom = await call('/api/foods/custom', { method: 'POST', token: legacy, body: {
    nameFa: 'غذای آزمایشی', category: 'main', per100g: { kcal: 100, protein: 5, carbs: 10, fat: 2, fiber: 1 },
    servingGrams: 100, servingLabel: 'بشقاب', priceIRR: 1000,
  } });
  check('custom food blocked on free', custom.status === 403 && custom.body.upgradeRequired === true);
  const badMeal = await call('/api/meals', { method: 'POST', token: legacy, body: { foodId: 'nope', grams: 0, mealType: 'lunch' } });
  check('validation rejects invalid meal', badMeal.status === 400);
  const futureMeal = await call('/api/meals', { method: 'POST', token: legacy, body: { foodId: 'sib', grams: 100, mealType: 'snack', date: '2999-01-01' } });
  check('far-future meal date rejected', futureMeal.status === 400);
  const meal = await call('/api/meals', { method: 'POST', token: legacy, body: { foodId: 'ghormeh-sabzi', grams: 150, mealType: 'lunch', source: 'camera' } });
  check('camera-sourced meal accepted', meal.status === 201);
  const rec = await call(`/api/recommendations/${meal.body.id}`, { token: legacy });
  check('deterministic recommendations', rec.status === 200 && rec.body.deterministic === true && rec.body.suggestions.length > 0);
  check('AI prompt locked on free', rec.body.suggestions.every((s) => s.prompt === null));
  const old = await call('/api/meals', { method: 'POST', token: legacy, body: { foodId: 'sib', grams: 100, mealType: 'snack', date: addDaysIso(-30) } });
  const filtered = await call('/api/meals', { token: legacy });
  check('free history limited to 7 days', !filtered.body.meals.some((m) => m.id === old.body.id) && filtered.body.historyLimited === true);
  const idor = await call(`/api/meals/${meal.body.id}`, { method: 'DELETE', token: admin.token });
  check('IDOR blocked on delete', idor.status === 404);
  const badJson = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  check('malformed JSON returns 400', badJson.status === 400);

  // ---------- برنامهٔ غذایی و جمع‌سپاری بارکد ----------
  const plan = await call('/api/mealplan?days=7', { token: legacy });
  check('meal plan returns 7 days', plan.status === 200 && plan.body.plan.days.length === 7 && plan.body.plan.days[0].meals.length === 4, `days=${plan.body.plan?.days?.length}`);

  const scanBarcode = String(Math.floor(1000000000000 + Math.random() * 8999999999999));
  const scan = await call('/api/foods/scan', { method: 'POST', token: legacy, body: {
    barcode: scanBarcode, nameFa: 'بیسکویت آزمایشی', kcalPer100g: 450, servingGrams: 30, servingLabel: 'عدد', priceIRR: 5000,
  } });
  check('barcode contribution creates shared food', scan.status === 201 && scan.body.alreadyExists === false && scan.body.tokensEarned === 5, `status=${scan.status}`);
  const scanDup = await call('/api/foods/scan', { method: 'POST', token: legacy, body: {
    barcode: scanBarcode, nameFa: 'بیسکویت آزمایشی', kcalPer100g: 450, servingGrams: 30, servingLabel: 'عدد',
  } });
  check('duplicate barcode returns existing without reward', scanDup.status === 200 && scanDup.body.alreadyExists === true && !('tokensEarned' in scanDup.body));
  const barcodeLookup = await call(`/api/foods/barcode/${scanBarcode}`, { token: legacy });
  check('barcode lookup works', barcodeLookup.status === 200 && barcodeLookup.body.nameFa === 'بیسکویت آزمایشی');
  const foodsAfterScan = await call('/api/foods', { token: legacy });
  check('shared food available to everyone', foodsAfterScan.body.foods.some((f) => f.id === scan.body.id), `count=${foodsAfterScan.body.count}`);
  const badBarcode = await call('/api/foods/scan', { method: 'POST', token: legacy, body: { barcode: 'abc', nameFa: 'بد', kcalPer100g: 450 } });
  check('invalid barcode rejected', badBarcode.status === 400);

  // ---------- نشست و حریم خصوصی ----------
  const out = await call('/api/auth/logout', { method: 'POST', token: legacy });
  const after = await call('/api/me', { token: legacy });
  check('logout revokes the session', out.status === 204 && after.status === 401);
  const del = await call('/api/me', { method: 'DELETE', token: tokenB, body: { confirm: true } });
  const gone = await call('/api/me', { token: tokenB });
  check('account deletion works', del.status === 204 && gone.status === 401);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

function addDaysIso(delta) {
  return new Date(Date.now() + delta * 86_400_000).toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

