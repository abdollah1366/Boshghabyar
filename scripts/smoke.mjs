// تست دودی سراسری API در حال اجرا. اجرا: node scripts/smoke.mjs
const BASE = process.env.API_BASE ?? 'http://localhost:3001';
const results = [];

async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login(email, password) {
  const r = await call('/api/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed: ${JSON.stringify(r.body)}`);
  return { token: r.body.token, user: r.body.user };
}

async function main() {
  const health = await call('/api/health');
  check('health', health.status === 200 && health.body.ok === true);

  const registered = await call('/api/auth/register', { method: 'POST', body: {
    name: 'کارگر تست', email: `smoke-${crypto.randomUUID()}@example.com`, password: 'Smoke@12345',
  } });
  check('register new free user', registered.status === 201 && registered.body.user.plan === 'free');
  const demo = { token: registered.body.token, user: registered.body.user };

  const foods = await call('/api/foods', { token: demo.token });
  check('free food list = 20', foods.status === 200 && foods.body.count === 20, `count=${foods.body.count}`);
  check('pro foods hidden from free', !foods.body.foods.some((f) => f.id === 'kashke-bademjan'));

  const custom = await call('/api/foods/custom', { method: 'POST', token: demo.token, body: {
    nameFa: 'غذای آزمایشی', category: 'main', per100g: { kcal: 100, protein: 5, carbs: 10, fat: 2, fiber: 1 },
    servingGrams: 100, servingLabel: 'بشقاب', priceIRR: 1000,
  } });
  check('custom food blocked on free', custom.status === 403 && custom.body.upgradeRequired === true, `status=${custom.status}`);

  const badMeal = await call('/api/meals', { method: 'POST', token: demo.token, body: { foodId: 'nope', grams: 0, mealType: 'lunch' } });
  check('zod validation rejects invalid meal', badMeal.status === 400, `status=${badMeal.status}`);

  const meal = await call('/api/meals', { method: 'POST', token: demo.token, body: {
    foodId: 'ghormeh-sabzi', grams: 150, mealType: 'lunch',
  } });
  check('meal created', meal.status === 201, `status=${meal.status}`);

  const rec = await call(`/api/recommendations/${meal.body.id}`, { token: demo.token });
  check('deterministic recommendations', rec.status === 200 && rec.body.deterministic === true && rec.body.suggestions.length > 0,
    `suggestions=${rec.body.suggestions?.length}`);
  check('AI prompt locked on free', rec.body.suggestions.every((s) => s.prompt === null));

  const daily = await call('/api/reports/daily', { token: demo.token });
  check('daily report has totals and status', daily.status === 200 && typeof daily.body.report.totals.kcal === 'number' && Boolean(daily.body.report.status));

  const weekly = await call('/api/reports/weekly?days=7', { token: demo.token });
  check('weekly advanced analytics locked on free', weekly.status === 200 && weekly.body.advanced === false);
  check('weekly trend has 7 points', weekly.body.trend.length === 7);

  const other = await call('/api/meals', { method: 'POST', token: demo.token, body: {
    foodId: 'chelow-kebab-koobideh', grams: 200, mealType: 'dinner', date: '2000-01-01',
  } });
  const filtered = await call('/api/meals', { token: demo.token });
  check('free history limited to 7 days', !filtered.body.meals.some((m) => m.id === other.body.id) && filtered.body.historyLimited === true);

  const adminForbidden = await call('/api/admin/overview', { token: demo.token });
  check('admin panel forbidden for user', adminForbidden.status === 403, `status=${adminForbidden.status}`);

  const admin = await login('admin@boshghabyar.ir', 'Admin@12345');
  const overview = await call('/api/admin/overview', { token: admin.token });
  check('admin overview readable', overview.status === 200 && overview.body.users >= 2, `users=${overview.body.users}`);

  const events = await call('/api/admin/events?limit=5', { token: admin.token });
  check('admin events readable', events.status === 200 && events.body.events.length > 0);

  const upgrade = await call('/api/upgrade', { method: 'POST', token: demo.token, body: { plan: 'pro', reference: 'smoke' } });
  check('mock upgrade activates pro', upgrade.status === 200 && upgrade.body.user.plan === 'pro');

  const proFoods = await call('/api/foods', { token: demo.token });
  check('pro unlocks extended foods', proFoods.body.count > 20 && proFoods.body.foods.some((f) => f.id === 'kashke-bademjan'), `count=${proFoods.body.count}`);

  const proCustom = await call('/api/foods/custom', { method: 'POST', token: demo.token, body: {
    nameFa: 'غذای آزمایشی پرو', category: 'main', per100g: { kcal: 120, protein: 6, carbs: 12, fat: 3, fiber: 2 },
    servingGrams: 150, servingLabel: 'بشقاب', priceIRR: 2000,
  } });
  check('custom food allowed on pro', proCustom.status === 201, `status=${proCustom.status}`);

  const proWeekly = await call('/api/reports/weekly?days=7', { token: demo.token });
  check('pro advanced analytics enabled', proWeekly.body.advanced === true);

  const proRec = await call(`/api/recommendations/${meal.body.id}`, { token: demo.token });
  check('pro receives explanation prompt', proRec.body.suggestions.some((s) => typeof s.prompt === 'string' && s.prompt.length > 0));

  const deleted = await call(`/api/meals/${meal.body.id}`, { method: 'DELETE', token: admin.token });
  check('IDOR blocked on delete', deleted.status === 404, `status=${deleted.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
