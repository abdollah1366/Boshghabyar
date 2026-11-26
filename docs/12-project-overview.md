# بشقاب‌یار — توضیح کامل پروژه (Overview)

این سند یک بررسی جامع از **کل مخزن** بشقاب‌یار است: ساختار، معماری، پکیج‌ها، API، کلاینت‌ها (وب، Expo، Kotlin بومی)، امنیت، داده، تست‌ها و دستورهای ساخت. برای جزئیات هر بخش، به سند مربوطه در `docs/` مراجعه کنید.

---

## ۱. محصول چیست؟

**بشقاب‌یار** یک MVP کامل (از نیازسنجی تا ارزیابی فنی/امنیتی/شناختی) است که ثبت سریع وعدهٔ غذا، محاسبهٔ ارزش تغذیهای (کالری، پروتئین، کربوهیدرات، چربی، فیبر) و ارائهٔ پیشنهاد جایگزین متعادل/اقتصادی را با **رابط فارسی و راستچین** برای وب و اندروید فراهم میکند.

- نویسنده: **عبدالله براتی** — دانشگاه علوم پزشکی تبریز، دانشکدهٔ مدیریت و انفورماتیک پزشکی
- برگزیدهٔ **استارتاپ ویکند غذا و تغذیهٔ تبریز ۱۴۰۵** (از ۲۲ طرح منتخب)
- اصل کلیدی: **تمام محاسبات تعیینپذیر (deterministic) و قابل توضیح** هستند؛ هیچ مدل زبانی عددی تولید نمیکند. AI (در صورت اتصال) فقط متن توضیحی تولید میکند.
- محدودیت‌ها (طرح آزاد vs حرفهای) **صرفاً در سرور** اعمال میشوند.
- اعداد تغذیهای و قیمتها تخمینی‌اند.

مخزن عمومی: `https://github.com/abdollah1366/Boshghabyar`

---

## ۲. ساختار کلی مخزن (Monorepo)

مخزن با **npm workspaces** مدیریت میشود:

```json
"workspaces": ["packages/*", "apps/*"]
```

پکیج‌ها:

| مسیر | نام | نوع | توضیح |
|---|---|---|---|
| `packages/core` | `@boshghabyar/core` | کتابخانهٔ خالص (TS) | منطق تعیینپذیر: غذاها، محاسبات، پیشنهاد، قواعد طرح |
| `apps/api` | `@boshghabyar/api` | سرویس Node/Express | API REST + SQLite + JWT + zod |
| `apps/web` | `@boshghabyar/web` | وباپ React + Vite | رابط وب راستچین |
| `apps/mobile` | `@boshghabyar/mobile` | Expo / React Native SDK 58 | پیادهسازی قدیمی (صرفاً مرجع) |
| `apps/android` | — | Gradle / Kotlin | **مشتری اصلی اندروید (Kotlin + Compose)** |
| `docs/` | — | مستندات | نیازسنجی، طراحی، وایرفریم، معماری، ارزیابی‌ها |
| `scripts/smoke.mjs` | — | تست دود | ۲۲ مرحله API |

---

## ۳. معماری کلی (High-Level)

```
┌─────────────────────────────────────────────────────────────┐
│  Clients                                                    │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Web (React)│  │ Expo/RN (legacy)│ │ Android (Kotlin)   │  │
│  └─────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
│        │                │                   │              │
│        └────────────────┼───────────────────┘              │
│                         ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express API (Node 24) — JWT + zod + helmet + CORS  │   │
│  │  /api/auth/* /api/me /api/foods /api/meals /api/reports│   │
│  │  /api/recommendations /api/upgrade /api/events /api/admin│   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SQLite (node:sqlite) — users, meals, custom_foods,   │   │
│  │  events, subscriptions                                │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  @boshghabyar/core — FOODS, nutrition math, plan rules│   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- **@boshghabyar/core** مرجع واحد محاسبات است؛ هم سرور و هم کلاینت‌ها از آن استفاده میکنند.
- **سرویس AI** متصل نیست؛ `/api/upgrade` شبیهسازی است؛ هیچ درگاه پرداخت نیست.

---

## ۴. پکیج `@boshghabyar/core`

### فایل‌ها

| فایل | محتوا |
|---|---|
| `src/types.ts` | تایپ‌های دامنه: `Plan`, `GoalType`, `MealType`, `Macros`, `Serving`, `Food`, `MealEntry`, `UserGoal`, `DaySummary`, `SuggestionKind`, `Suggestion`, `MealLogInput` + ثابتهای `EMPTY_MACROS`, `DEFAULT_GOAL` |
| `src/foods.ts` | `FOODS: Food[]` (۲۵ غذا)، `FOODS_BY_ID`, `FREE_FOODS` (۲۰ غذای رایگان) |
| `src/nutrition.ts` | محاسبات: `scaleMacros`, `entryNutrition`, `entryPrice`, `summarizeDay`, `buildTrend`, `suggestAlternatives`, `reasonFor`, `buildExplanationPrompt` |
| `src/plan.ts` | `Feature`, `PlanLimits`, `PLAN_LIMITS`, `hasFeature`, `historyCutoffDate`, `isPlan` |
| `src/nutrition.test.ts` | تست واحد (۷ تست) |
| `src/index.ts` | re-export همه |

### قواعد طرح

- **free**: `maxFoods: 20`, `maxHistoryDays: 7`, همهٔ featureها `false`
- **pro**: نامحدود، همهٔ featureها `true` (غذای سفارشی، تاریخچۀ نامحدود، تحلیل پیشرفته، AI prompt)

Featureها: `extendedFoods`, `customFoods`, `unlimitedHistory`, `advancedAnalytics`, `aiExplanations`.

### تست

```bash
npm run core:build && npm run core:test   # 7/7
```

---

## ۵. API (apps/api)

### تکنولوژی

- Node 24 + Express 4 + TypeScript + **`node:sqlite`** (`DatabaseSync`) + JWT (jsonwebtoken) + bcryptjs + zod 4
- امنیت: `helmet`, `cors`, `express-rate-limit`
- پورت پیشفرض: `3001`

### متغیرهای محیطی (`.env.example`)

```
PORT=3001
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
DATABASE_PATH=./data/boshghabyar.db
```

- در `production` بدون `JWT_SECRET` سرور راه‌اندازی نمیشود.
- DB پیشفرض: `apps/api/data/boshghabyar.db` (gitignored).

### دیتابیس (SQLite)

جداول: `users`, `meals`, `custom_foods`, `events`, `subscriptions`  
ایندکس‌ها: `idx_meals_user_date`, `idx_events_type`

Seed هنگام خالی بودن جدول `users`:

| id | نام | ایمیل | نقش | طرح | رمز |
|---|---|---|---|---|---|
| `admin-boshghabyar` | مدیر بشقاب‌یار | `admin@boshghabyar.ir` | admin | pro | `Admin@12345` |
| (uuid) | کاربر نمونه | `demo@boshghabyar.ir` | user | free | `Demo@12345` |

### میان‌افزارها

- `app.disable('x-powered-by')`
- `helmet()`
- `cors({ origin: allowedOrigins })` (از `CORS_ORIGIN`)
- `express.json({ limit: '64kb' })`
- ریت‌لیمیت کلی: ۱۵ دقیقه / ۵۰۰ درخواست
- ریت‌لیمیت احراز هویت: ۱۵ دقیقه / ۳۰ درخواست (پیام فارسی)

### Endpointها

| متد | مسیر | احراز | توضیح |
|---|---|---|---|
| GET | `/api/health` | — | سلامت سرویس |
| POST | `/api/auth/register` | authLimiter | ثبتنام |
| POST | `/api/auth/login` | authLimiter | ورود |
| GET | `/api/me` | authRequired | پروفایل کاربر |
| PATCH | `/api/me/goal` | authRequired | ذخیرهٔ اهداف |
| GET | `/api/foods` | authRequired | لیست غذاها (فیلتر طرح) |
| POST | `/api/foods/custom` | authRequired | غذای سفارشی (Pro) |
| GET | `/api/meals` | authRequired | وعدهها (فیلتر تاریخچه) |
| POST | `/api/meals` | authRequired | ثبت وعده |
| DELETE | `/api/meals/:id` | authRequired | حذف وعده |
| GET | `/api/reports/daily` | authRequired | خلاصهٔ روز |
| GET | `/api/reports/weekly` | authRequired | روند ۷ روزه |
| GET | `/api/recommendations/:mealId` | authRequired | پیشنهادها |
| POST | `/api/upgrade` | authRequired | ارتقا (شبیهسازی) |
| POST | `/api/events` | authRequired | رویداد تحلیلی |
| GET | `/api/admin/overview` | adminRequired | پنل ادمین |
| GET | `/api/admin/events` | adminRequired | رویدادهای ادمین |

### احراز هویت (JWT)

- `signToken()`: payload `{ sub, role }`, انقضا `7d`
- بدون refresh/rotation
- `DEFAULT_SECRET = 'dev-only-change-me-boshghabyar'` (فقط dev)
- `publicUser()` فیلدهای `phone` و `createdAt` را هم برمیگرداند.

---

## ۶. وباپ (apps/web)

### تکنولوژی

- React 19 + Vite 7 + TypeScript + `react-router-dom` v7
- فونت Vazirmatn از `@fontsource/vazirmatn`
- RTL: CSS tokens + `direction: rtl` در `tokens.css`

### صفحهها

| مسیر | کامپوننت | توضیح |
|---|---|---|
| `/` | `Landing` / `Dashboard` | لندینگ یا داشبورد (بر اساس لاگین) |
| `/login` | `Login` | ورود/ثبتنام |
| `/log` | `LogMeal` | ثبت وعده |
| `/suggestions` | `Suggestions` | پیشنهادها |
| `/reports` | `Reports` | گزارش هفتگی |
| `/profile` | `Profile` | نمایه و اهداف |
| `/admin` | `Admin` | پنل ادمین (فقط admin) |

### API base

```ts
const API_BASE = import.meta.env.VITE_API_URL ?? '';
```
توکن در `localStorage` با کلید `boshghabyar_token`.

---

## ۷. کلاینت قدیمی Expo (apps/mobile) — مرجع

- Expo SDK 58، React Native 0.88.1، Expo Router
- صفحهها: `login`, `(app)/index`, `log`, `profile`, `reports`, `suggestions`
- ذخیرهٔ توکن: `expo-secure-store` (کلید `boshghabyar_session`)
- RTL: پلاگین `expo-localization` با `forcesRTL: true`
- API base: `http://10.0.2.2:3001` (شبیهساز) یا `EXPO_PUBLIC_API_URL`
- آیکون‌ها: `@expo/vector-icons` Ionicons
- **این ماژول فقط برای مرجع نگه داشته شده**؛ مسیر اصلی `apps/android` است.

---

## ۸. کلاینت بومی اندروید (apps/android) — مسیر اصلی

### تکنولوژی

- Kotlin 2.2.10 + AGP 9.2.1 + Gradle wrapper 9.4.1
- Jetpack Compose BOM 2026.11.01 + Material3
- OkHttp 4.12.0 + Navigation Compose 2.10.2 + activity-compose 1.13.0
- EncryptedSharedPreferences 1.1.0 (AndroidX Security Crypto)
- JVM target 17
- minSdk 24 / targetSdk 36 / compileSdk 37

### ساختار فایل‌ها

| فایل | مسئولیت |
|---|---|
| `ApiClient.kt` | OkHttp، Bearer token، `ApiException`، `track` |
| `MainActivity.kt` | نقطهٔ ورود Compose + MaterialTheme (فونت Vazirmatn) |
| `Models.kt` | مدل‌های JSON + برچسب‌های فارسی + `MEAL_LABELS` + `GOAL_LABELS` |
| `Navigation.kt` | `NavHost`، محافظت مسیرها، نوار پایین RTL، `BoshghabYarApp` |
| `Screens.kt` | تمام صفحهها |
| `SessionStore.kt` | ذخیرهٔ JWT در EncryptedSharedPreferences |
| `Theme.kt` | رنگ‌ها، فونت، کامپوننت‌های مشترک (Card, Button, Metric, ProgressRow, Field, …) |

### نگاشت صفحهها

| صفحه | مسیر | رفتار حفظشده |
|---|---|---|
| ورود/ثبتنام/ورود آزمایشی | `login` | متون، اعتبارسنجی سرور، رویداد `ui.login_completed` / `ui.register_completed` |
| خانه | `home` | خلاصهٔ روز، ۴ شاخص، ۵ نوار پیشرفت، وعدههای اخیر، اعداد فارسی برای هزینه |
| ثبت وعده | `log` | انتخاب غذا، وزن، نوع وعده، تخمین کالری، ارسال + جایگزین‌ها |
| گزارش‌ها | `reports` | روند ۷ روزه، میانگین، روزهای فعال، دکمهٔ ارتقای Pro |
| نمایه | `profile` | ویرایش ۶ هدف تغذیهای، نوع هدف، اشتراک، خروج |
| پیشنهادها | `suggestions` | لیست وعده‌ها + محاسبهٔ جایگزین با کلیک |

رویدادهای `page.viewed` دقیقاً همان مقادیر (`home`, `log_meal`, `reports`, `suggestions`).

### پیکربندی بیلد

- `applicationId`: `ir.boshghabyar.app` (همان نسخهٔ RN — قبل از نصب باید نسخهٔ قدیمی پاک شود)
- `apiBaseUrl` پیشفرض: `http://82.115.17.7:3001` (قابل override با `-PapiBaseUrl`)
- `usesCleartextTraffic=true` (چون API روی HTTP است)
- Release با **debug keystore** امضا میشود (پایلوت)
- فونت Vazirmatn محلی: `res/font/vazirmatn_regular.ttf`, `vazirmatn_bold.ttf`
- چک متادیتای AAR غیرفعال شده (Compose 1.13 نیاز به API 37.1 دارد، SDK محلی فقط 37.0)

### دستورهای ساخت

```powershell
cd apps/android
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"

.\gradlew.bat :app:assembleDebug --console=plain
.\gradlew.bat :app:assembleRelease -PapiBaseUrl=http://82.115.17.7:3001 --console=plain
```

خروجی release: `apps/android/app/build/outputs/apk/release/app-release.apk` (≈۱۴.۵MB، universal ABI)

---

## ۹. RTL و تایپوگرافی

- **وب**: CSS tokens + `direction: rtl`، فونت Vazirmatn self-hosted
- **اندروید (Kotlin)**: `CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl)` + فونت Vazirmatn از `res/font`
- **اندروید (Expo)**: پلاگین `expo-localization` با `forcesRTL: true`
- اعداد فارسی: فقط در چند نقطه (مثلاً هزینهٔ روز در home) با `toLocaleString('fa-IR')` / `faNumber`
- آیکون‌های جهتدار آینهای (AutoMirrored)

---

## ۱۰. امنیت

- **JWT**: امضا با `JWT_SECRET` (حداقل در production الزامی)، انقضا ۷ روز، بدون refresh
- **رمز عبور**: bcryptjs
- **ذخیرهٔ توکن**:
  - وب: `localStorage` (`boshghabyar_token`)
  - Expo: `expo-secure-store` (`boshghabyar_session`)
  - Kotlin: `EncryptedSharedPreferences` (Android Keystore)
- **سرور**: helmet, CORS محدود, rate-limit (کلی ۵۰۰/۱۵min، auth ۳۰/۱۵min), zod validation, 64kb body limit
- **محدودیت‌های طرح**: سمت سرور (client فقط دکمهٔ ارتقا نمایش میدهد)
- **SQL**: پارامتریزه (بدون string concat)
- **گزارش امنیت**: `docs/08-security-evaluation.md`

---

## ۱۱. تحلیل و رویدادها (Analytics)

رویدادهای کلاینت (`track` → `POST /api/events`):

| رویداد | مکان | payload |
|---|---|---|
| `page.viewed` | home, log, reports, suggestions | `{ page: '...' }` |
| `ui.login_completed` | login (ورود) | `{}` |
| `ui.register_completed` | login (ثبتنام) | `{}` |

رویدادهای سرور: `user.registered`, `user.logged_in`, `goal.updated`, `meal.created`, `custom_food.created`, `meal.deleted`, `recommendation.viewed`, `plan.upgraded`, `system.seeded`.

---

## ۱۲. تست‌ها و دستورهای تأیید کیفیت

```bash
npm install                 # نصب workspaceها
npm run api:dev             # API روی http://localhost:3001
npm run web:dev             # وباپ روی http://localhost:5173
npm run mobile:start        # Expo Dev Server

npm run typecheck           # 4 workspace — 0 خطا
npm test                    # 7/7 تست core
npm run build               # core + api + web
npm run smoke               # 22/22 بررسی API (SERVER باید در حال اجرا باشد)
```

نتایج نهایی (۱۴۰۵/۰۹/۰۴ — ۲۵ نوامبر ۲۰۲۶): typecheck ✅، ۷/۷ تست ✅، build ✅ (gzip وب ۹۵.۲KB)، smoke ۲۲/۲۲ ✅، `expo-doctor` ۲۰/۲۰ ✅، `npm audit` صفر critical/high ✅.

---

## ۱۳. استقرار (VPS)

- سرور: `82.115.17.7`، API روی پورت `3001`
- `apps/api/.env` (gitignored) با `NODE_ENV=production`, `JWT_SECRET` (۶۴ کاراکتر), `CORS_ORIGIN=http://82.115.17.7:3001,http://82.115.17.7:5173`
- فایروال: قانون `BoshghabYar API 3001`
- API از طریق `npm run api:dev` در حالت production اجرا میشود (برای persistence نیاز به service manager مثل pm2/NSSM)
- `http://82.115.17.7:3001/api/health` قابل دسترسی خارجی است

---

## ۱۴. محدودیت‌های صریح

- APK release بومی با **debug keystore** امضا شده؛ برای فروشگاه keystore اختصاصی لازم است.
- هیچ کاربر آزمایشی، فروش واقعی، درگاه پرداخت یا سرویس AI متصل وجود ندارد.
- `/api/upgrade` تنها شبیهسازی است.
- رابط ادمین و غذای سفارشی در کلاینت‌های موبایل وجود ندارد (فقط وب/API).
- ESLint تنظیم نشده؛ `typecheck` جایگزین موقت است.
- سه هشدار `moderate` در زنجیرهٔ ابزار Expo (`minimatch` ← `@expo/fingerprint`) باقیاند.
- چک متادیتای AAR در بیلد اندروید غیرفعال است (SDK محلی فقط 37.0 دارد).
- `EncryptedSharedPreferences` و `MasterKey` در AndroidX Security Crypto deprecated هستند (ولی کار میکنند).

---

## ۱۵. مستندات

| فایل | توضیح |
|---|---|
| `docs/00-roadmap.md` | نقشهٔ مراحل P0–P7 |
| `docs/01-needs-assessment.md` | تحلیل نیازها و پرسوناها |
| `docs/02-design-system.md` | رنگ، تایپوگرافی، فاصله‌ها، قواعد RTL |
| `docs/03-wireframes/` | وایرفریم‌های موبایل و وب |
| `docs/04-architecture.md` | معماری، قرارداد API، الزامات غیرعملکردی |
| `docs/07-technical-evaluation.md` | ارزیابی فنی و benchmark |
| `docs/08-security-evaluation.md` | ارزیابی امنیتی و نتایج اسکن |
| `docs/09-cognitive-evaluation.md` | ارزیابی شناختی و دسترس‌پذیری |
| `docs/11-native-kotlin.md` | پورت بومی اندروید (Kotlin/Compose) |
| `docs/12-project-overview.md` | این سند (نمای کلی) |

---

## ۱۶. تماس

**Abdollahbarati66@gmail.com · 09141199762**
