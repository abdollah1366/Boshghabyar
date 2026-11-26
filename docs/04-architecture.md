# بشقاب‌یار — معماری فنی

**نسخه:** 1.0 | **تاریخ:** ۱۴۰۵/۰۸/۰۴ | **مالک:** عبدالله براتی

## ۱. اصول معماری

1. **منطق واحد، رابط‌های متعدد:** تمام محاسبات تغذیه‌ای، قواعد پیشنهاد و محدودیت‌های طرح در `packages/core` پیادهمیشوند. وب و موبایل فقط نمایشدهندهاند.
2. **عددها قطعیاند:** `kcal`, `protein`, `fat`, `carbs`, `cost` همیشه توسط توابع خالص core محاسبه می‌شوند. مدل زبان فقط متن توضیحی تولید می‌کند و عددها را به‌عنوان ورودی دریافت می‌کند، نه به‌عنوان خروجی.
3. **درگاه واحد:** `/api` تنها مرز ارتباط کلاینت‌ها با داده است.
4. **پیشرفت تدریجی:** SQLite با `node:sqlite` برای MVP کافی است؛ جدول events بهگون‌های طراحی می‌شود که بعداً قابل مهاجرت به سرویس تحلیلی باشد.

## ۲. ساختار مخزن

```text
boshghabyar/
├── packages/core/     # انواع، food DB، محاسبات تغذیه، قواعد پیشنهاد، plan limits
├── apps/api/          # Node 24 + Express + TypeScript + node:sqlite + JWT + bcryptjs + zod
├── apps/web/          # React + Vite + TypeScript، RTL
├── apps/mobile/       # Expo React Native + TypeScript، اندروید
└── docs/              # همین مستندات
```

## ۳. نمای کانتکست

```text
                       ┌──────────────────────┐
   ┌───────────────┐   │  کاربر نهایی         │
   │ موبایل        │◄─►│  (دانشجو / جوان)     │
   │ Expo Android  │   └──────────┬───────────┘
   └───────┬───────┘              │
           │ HTTPS                │ HTTPS
           ▼                      ▼
   ┌─────────────────────────────────────────────┐
   │              apps/api  (/api)               │
   │  auth · JWT · zod validation · rate limit   │
   │  CORS · assertPlan · audit events           │
   └───────┬───────────────────────┬─────────────┘
           │                       │
           ▼                       ▼
   ┌────────────────┐      ┌────────────────────┐
   │ packages/core  │      │ node:sqlite        │
   │ food DB        │      │ users · foods ·    │
   │ nutrition math │      │ meals · events     │
   │ recommend rules│      └────────────────────┘
   │ plan limits    │
   └───────┬────────┘
           │ متن توضیحی (فقط Pro)
           ▼
   ┌─────────────────────────────────────────────┐
   │ سرویس مدل زبان (اختیاری، خارج از MVP)       │
   │ ورودی: عددهای محاسبه‌شده + هدف + محدودیت     │
   │ خروجی: فقط توضیح فارسی، بدون عدد جد جدید    │
   └─────────────────────────────────────────────┘

   ┌───────────────┐        ┌────────────────────┐
   │ وب RTL        │◄──────►│ ادمین (همان API)    │
   │ React + Vite  │        │ admin/overview/events│
   └───────────────┘        └────────────────────┘
```

> یادداشت: تمام دسترسی‌ها از طریق API است؛ هیچ کلاینتی مستقیماً به SQLite متصل نمی‌شود.

## ۴. مدل داده (پیادهسازی فعلی)

> غذاهای پایه در `packages/core/src/foods.ts` تعریفاند (۲۰ غذای رایگان + ۵ غذای Pro)، نه در جدول SQL. تنها غذاهای سفارشی کاربران در دیتابیس ذخیره می‌شوند. تمام گزارش‌ها به موقع محاسبه می‌شوند و جدول جداگان‌های برای خلاصهٔ روزانه وجود ندارد.

### جدول `users`

| ستون | نوع | محدودیت | توضیح |
|---|---|---|---|
| `id` | TEXT | PK | UUID |
| `name` | TEXT | NOT NULL | نام نمایشی |
| `email` | TEXT | UNIQUE, NOT NULL | شناسهٔ ورود (پایین نگارشده) |
| `phone` | TEXT | nullable | شماره تماس اختیاری |
| `password_hash` | TEXT | NOT NULL | bcryptjs با factor 10 |
| `role` | TEXT | `user` \| `admin` | نقش دسترسی |
| `plan` | TEXT | `free` \| `pro`, default `free` | طرح فعلی |
| `calorie_target`, `protein_target`, `carbs_target`, `fat_target`, `fiber_target` | INTEGER | مقادیر عددی | اهداف تغذیه‌ای |
| `daily_budget_irr` | INTEGER | default 250000 | بودجهٔ تقریبی روزانه (ریال) |
| `goal_type` | TEXT | `balance` \| `weight-loss` \| `muscle-gain` \| `budget` | نوع هدف |
| `created_at` | TEXT (ISO) | NOT NULL | زمان ثبت‌نام |

### جدول `meals`

| ستون | نوع | توضیح |
|---|---|---|
| `id` | TEXT | UUID، کلید اصلی |
| `user_id` | TEXT | FK → users، حذف آبشاری |
| `food_id` | TEXT | شناسهٔ غذا در core یا `custom-*` |
| `grams` | INTEGER | وزن سهم (>0)، مبنای محاسبه |
| `meal_type` | TEXT | `breakfast` \| `lunch` \| `dinner` \| `snack` |
| `date` | TEXT | `YYYY-MM-DD`، تاریخ وعده |
| `created_at` | TEXT | timestamp ISO |

> ارزش غذایی و هزینه در لحظهٔ خواندن توسط `packages/core` محاسبه می‌شود، ذخیرهٔ مقدار محاسبه‌شده در جدول وعده‌ها در نسخهٔ فعلی وجود ندارد (از انحراف عددها جلوگیری می‌کند).

### جدول `custom_foods` (Pro)

| ستون | نوع | توضیح |
|---|---|---|
| `id` | TEXT | UUID با پیشوند `custom-` |
| `user_id` | TEXT | FK → users |
| `name_fa`, `category`, `serving_label` | TEXT | اطلاعات غذا |
| `per100g` | TEXT (JSON) | `{kcal, protein, carbs, fat, fiber}` |
| `serving_grams`, `price_irr` | INTEGER | سهم معمولی و قیمت تخمینی |

### جدول `events`

| ستون | نوع | توضیح |
|---|---|---|
| `id` | TEXT | UUID |
| `user_id` | TEXT | nullable؛ از JWT گرفته می‌شود |
| `type` | TEXT | نام رویداد (رشتهٔ آزاد کوتاه) |
| `payload` | TEXT (JSON) | خواص محدود، بدون اطلاعات حساس |
| `created_at` | TEXT | timestamp ISO، تنظیم‌شده توسط سرور |

### جدول `subscriptions`

| ستون | نوع | توضیح |
|---|---|---|
| `id` | TEXT | UUID |
| `user_id` | TEXT | FK → users |
| `plan` | TEXT | `pro` |
| `provider` | TEXT | فعلاً `mock` |
| `reference` | TEXT | شمارهٔ مرجع شبیهسازی |
| `amount_irr` | INTEGER | مبلغ ثبت‌شده (فعلاً ۰) |
| `created_at` | TEXT | timestamp ISO |

### نمای `daily_report` (محاسبه‌شده، ذخیره نمی‌شود)

| فیلد | منبع |
|---|---|
| `date` | پارامتر `?date=` یا تاریخ سرور |
| `totals` | `summarizeDay()` از core |
| `ratio` | نسبت مصرف به اهداف و بودجه |
| `status` | `over` \| `below` \| `balanced` |
| `meals` | ردیف‌های وعده همان روز |

## ۵. قرارداد API (پیادهسازی فعلی)

پایه: `/api`. تمام بدنه‌ها و پاسخ‌ها `application/json` و UTF-8اند. احراز هویت با `Authorization: Bearer <JWT>` است مگر endpointهای عمومی.

| Method | Path | احراز | هدف | گیت طرح |
|---|---|---|---|---|
| GET | `/api/health` | خیر | بررسی سلامت سرویس | — |
| POST | `/api/auth/register` | خیر | ایجاد حساب (`name`, `email`, `password`, `phone?`) | — |
| POST | `/api/auth/login` | خیر | دریافت JWT (`email`, `password`) | — |
| GET | `/api/me` | بله | نمایه و اهداف فعلی | — |
| PATCH | `/api/me/goal` | بله | به‌روزرسانی اهداف و بودجه | — |
| GET | `/api/foods` | بله | فهرست غذاها بههمراه `count`, `plan` | free: ۲۰ غذای عمومی |
| POST | `/api/foods/custom` | بله | غذای سفارشی | pro فقط (403 + `upgradeRequired`) |
| GET | `/api/meals` | بله | لیست وعده‌ها + غذاهای دردسترس | free: ۷ روز اخیر |
| POST | `/api/meals` | بله | ثبت وعده (`foodId`, `grams`, `mealType`, `date?`) | فقط غذای دردسترس طرح |
| DELETE | `/api/meals/:id` | بله | حذف وعده | مالکیت کاربر |
| GET | `/api/reports/daily?date=` | بله | خلاصهٔ روز + وعده‌ها | عمومی |
| GET | `/api/reports/weekly?days=&from=` | بله | روند و میانگین‌ها | رایگان: متن ساده؛ Pro: تحلیل پیشرفته |
| GET | `/api/recommendations/:mealId` | بله | جایگزین قطعی بههمراه `prompt` | Pro: پرامپت توضیح AI |
| POST | `/api/upgrade` | بله | ارتقای شبیهسازی (`plan: "pro"`) | آزمایشی |
| POST | `/api/events` | بله | ثبت رویداد تحلیلی | — |
| GET | `/api/admin/overview` | بله + نقش ادمین | شمارش کاربران، وعده‌ها، رویدادها | ادمین |
| GET | `/api/admin/events?limit=` | بله + نقش ادمین | آخرین رویدادها | ادمین |

### شکل پاسخ‌ها (خلاصه)

- ورود/ثبت‌نام: `{ token, user: { id, name, email, role, plan, goal, createdAt } }`
- فهرست غذا: `{ foods: Food[], count, plan }` که در آن `Food` شامل `nameFa`, `category`, `per100g`, `serving`, `estimatedPriceIRR`, `tags`, `free` است.
- ثبت وعده: `{ id, date }` (عددها هنگام خواندن محاسبه می‌شوند).
- پیشنهادها: `{ suggestions: Array<Suggestion & { prompt: string | null }>, deterministic: true }`.
- گزارش هفتگی: `{ trend: TrendPoint[], summary, insight, advanced }`.

### خطاها

قالب فعلی: `{ "error": "پیام فارسی", "details"?: [{ path, message }] }`.

| وضعیت HTTP | معنی |
|---|---|
| 400 | دادهٔ نامعتبر (zod) یا غذای خارج از طرح |
| 401 | نشست غایب/منقضی یا رمز اشتباه |
| 403 | دسترسی ادمین یا قابلیت Pro وجود ندارد (`upgradeRequired: true`) |
| 404 | وعده یافت نشد |
| 429 | محدودیت نرخ (ورود ۳۰ در ۱۵ دقیقه، عمومی ۵۰۰ در ۱۵ دقیقه) |
| 500 | خطای داخلی (ثبت‌شده در لاگ سرور) |

## ۶. طرح رویدادهای تحلیلی

همهٔ رویدادها از طریق `POST /api/events` (یا مستقیماً توسط سرور) در جدول `events` ذخیره می‌شوند.

| فیلد | نوع | الزام | توضیح |
|---|---|---|---|
| `type` | string (≤80) | بله | نام رویداد |
| `payload` | object | خیر | خواص محدود، بدون اطلاعات حساس |
| `created_at` | ISO string | سرور | زمان receipt سرور |
| `user_id` | TEXT | سرور | از JWT استخراج می‌شود، نه از بدنه |

**نمونهٔ رویدادهای استفاده‌شده:** `user.registered`, `user.logged_in`, `meal.created`, `meal.deleted`, `recommendation.viewed`, `goal.updated`, `custom_food.created`, `plan.upgraded`, `page.viewed`, `ui.login_completed`.

**قواعد حریم خصوصی رویداد:** ذخیرهٔ ایمیل، رمز، شماره موبایل یا متن آزاد در `payload` ممنوع است. طول `type` توسط zod محدود شده است؛ فیلتر دقیق کلیدها در نسخهٔ بعدی اضافه می‌شود.

## ۷. ماتریس گیتing طرح‌ها (پیادهسازی فعلی)

| قابلیت | Free | Pro | محل اعمال |
|---|---|---|---|
| تعداد غذای فهرست | ۲۰ غذای عمومی | تمام غذاها + غذای سفارشی | `hasFeature()` + `GET /api/foods` |
| تاریخچهٔ وعده‌ها | ۷ روز | نامحدود | `historyCutoffDate()` + `GET /api/meals` |
| تحلیل پیشرفتهٔ هفتگی | خیر (متن ساده) | بله (`advanced: true`) | `GET /api/reports/weekly` |
| پرامپت توضیح هوشمند | `prompt: null` | پرامپت فارسی قالببندی شده | `GET /api/recommendations/:mealId` |
| غذای سفارشی | 403 | بله | `POST /api/foods/custom` |
| پنل کارشناس تغذیه | خیر | آیتم رابط، کاملشدنی در نسخهٔ بعدی | `/profile` |
| ثبت رویداد | بله | بله | `POST /api/events` |
| ارتقای شبیهسازی | دکمهٔ ارتقا | وضعیت فعال (mock) | `POST /api/upgrade` |

> تمام گیت‌ها در سرور بررسی می‌شوند؛ پنهان کردن دکمه در رابط تنها جنبهٔ تجربهٔ کاربری دارد، نه امنیت.

## ۸. الزامات غیرعملکردی

| حوزه | الزام | وضعیت اندازهگیری (۱۴۰۵/۰۹/۰۴) |
|---|---|---|
| Performance | پاسخ endpointهای خواندنی < ۲۰۰ms در محیط محلی | ✅ foods 2.45ms، meals 2.76ms، daily 1.5ms (میانگین ۲۰ درخواست) |
| Performance | محاسبهٔ core برای تک وعده < ۵ms | ✅ ۰.۰۰۴ms (میانگین ۱۰۰۰ بار) |
| Performance | بار اول وب < ۲۰۰KB gzip | ✅ ۹۵.۲KB |
| مقیاسپذیری | تا ۱٬۰۰۰ کاربر و ۱۰٬۰۰۰ وعده در SQLite قابل قبول | ⛔ آزمون بار انبوه انجامن‌شده؛ طراحی ایندeksها و محدودیتhistory مناسب MVP است |
| امنیت | رمز با bcryptjs، JWT با مدت کوتاه، CORS محدود، rate limit | ✅ بررسی کامل در `docs/08` |
| کیفیت کد | Typecheck بدون خطا قبل از هر ادعا | ✅ ۴ workspace، صفر خطا؛ ESLint هنوز تنظیم نشده (backlog) |
| تست | پوشش توابع محاسباتی core | ✅ ۷ تست واحد + ۲۲ بررسی smoke؛ درصد پوشش(line) اندازهگیری نشده |
| بومیسازی | RTL کامل، اعداد فارسی در UI، خطاهای فارسی | ✅ بررسی در `docs/09`؛ RTL موبایل با `forcesRTL` تضمین شد |
| سازگاری | اندروید (Expo SDK 58) و مرورگرهای مدرن | ✅ expo-doctor 20/20، ساخت وب موفق، APK دیباگ `x86_64` و APK release `arm64-v8a` (۳۱.۱MB) ساخته شد؛ اجرا روی گوشی فیزیکی ⏳ |
| مشاهدهپذیری | خطاهای فارسی `{error, details?}` + رویدادهای تحلیلی سرور | ✅ خطاها فارسیاند؛ رویداد `plan_limit_hit` در backlog است |
| حریم خصوصی | حداقل ذخیره‌سازی داده، بدون متن آزاد در رویدادها | ✅ `docs/08`؛ حذف حساب در backlog |
| قابلیت نگهداری | جداسازی core از API و رابط‌ها؛ بدون تکرار فرمول محاسبه | ✅ بررسی در `docs/07` |

## ۹. تصمیمات باز و فهرست عقب افتاده

- جایگزینی `node:sqlite` با PostgreSQL در صورت رشد هم‌زمان کاربران.
- استقرار سرویس AI با سختگیرانهترین prompt و اعتبارسنجی خروجی؛ تا آن زمان `explanation` در Pro یک متن قالبی محاسبه‌شده است.
- پشتیبانی از منوهای سلف و غذاهای آذربایجانی در فهرست غذا به‌عنوان extension داده (بدون تغییر core).
- نسخهٔ آفلاین موبایل و همگامسازی بعد از اتصال (پس از MVP).
