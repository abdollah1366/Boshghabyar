# بشقاب‌یار (BeshqabYar)

> ثبت سریع وعدهٔ غذا، محاسبهٔ ارزش تغذیهای و ارائهٔ پیشنهاد متعادل و مقرونبهصرفه — با رابط فارسی و راستچین برای وب و اندروید.

بشقاب‌یار نمونۀ اولیۀ کامل (MVP) است که از نیازسنجی تا ارزیابی فنی، امنیتی و شناختی را پوشش میدهد و در جریان **استارتاپ ویکند غذا و تغذیهٔ تبریز ۱۴۰۵** (از ۲۲ طرح منتخب) شکل گرفت. نویسنده: **عبدالله براتی** — دانشگاه علوم پزشکی تبریز، دانشکدهٔ مدیریت و انفورماتیک پزشکی.

## ویژگیها

- **ثبت وعده** با انتخاب غذا و سهم (کفگیر، قاشق، بشقاب، گرم) و محاسبهٔ آنی کالری، پروتئین، کربوهیدرات و چربی.
- **گزارش روزانه و هفتگی** با نوار پیشروی هدف و روند مصرف.
- **پیشنهاد هوشمند** بر اساس هدف تغذیهای و بودجهٔ باقیمانده — قواعد کاملاً تعیینپذیر (deterministic) و قابل توضیح.
- **دو طرح آزاد و حرفهای**: طرح آزاد شامل ۲۰ غذای رایج، ۷ روز تاریخچه و گزارش سادۀ هفتگی است؛ طرح حرفهای تمام غذاها، غذای سفارشی، تاریخچۀ نامحدود، تحلیل پیشرفته و متن توضیحی AI را فعال میکند. **تمام محدودیتها در سرور اعمال میشوند.**
- **پنل ادمین** برای مشاهدهٔ تعداد کاربران، وعدهها و رویدادها.
- **RTL کامل**: اعداد فارسی (`fa-IR`)، فونت Vazirmatn بهصورت self-hosted، راستچین اجباری در مشتری بومی اندروید و آیکونهای جهتدار آینهای.

> **اعداد تغذیهای و قیمتها تخمیناند.** محاسبات توسط کد انجام میشوند و هیچ مدل زبانی عددی تولید نمیکند؛ AI در صورت اتصال تنها متن توضیحی تولید میکند.

## ساختار مخزن

| مسیر | توضیح |
|---|---|
| `packages/core` | منطق خالص و تعیینپذیر: جدول غذاها، محاسبات تغذیهای، قواعد پیشنهاد، محدودیت طرح + تست واحد |
| `apps/api` | Express + TypeScript + `node:sqlite` + JWT + zod؛ تمام endpointها و گیتینگ سمت سرور |
| `apps/web` | وباپ React + Vite، راستچین و واکنشگرا |
| `apps/android` | **مشتری اصلی اندروید: Kotlin بومی + Jetpack Compose** (بدون React Native / Metro) |
| `apps/mobile` | پیادهسازی قدیمی Expo Router / React Native (SDK 58) — صرفاً برای مرجع نگه داشته شده |
| `docs` | نیازسنجی، سیستم طراحی، وایرفریمها، معماری، ارزیابیها و سند پورت بومی |
| `scripts/smoke.mjs` | تست دود ۲۲ مرحلهای API |

## شروع سریع

پیشنیاز: **Node.js 24** و npm 11 (حداقل Node 22.5).

```bash
npm install                 # نصب تمام workspaceها
npm run api:dev             # API روی http://localhost:3001
npm run web:dev             # وباپ روی http://localhost:5173
npm run mobile:start        # Expo Dev Server
```

### حسابهای نمایشی

| نقش | ایمیل | رمز |
|---|---|---|
| کاربر آزاد | `demo@boshghabyar.ir` | `Demo@12345` |
| ادمین | `admin@boshghabyar.ir` | `Admin@12345` |

ارتقا به طرح حرفهای در محیط نمایشی **شبیهسازی است و هیچ پرداختی انجام نمیدهد**. در استقرار واقعی باید `JWT_SECRET` تنظیم شود؛ بدون آن سرور در حالت production راهاندازی نمیشود (الگوی متغیرها در `apps/api/.env.example`).

## دستورهای تأیید کیفیت

```bash
npm run typecheck   # 4 workspace — 0 خطا
npm test            # 7/7 تست core
npm run build       # core + api + web
npm run smoke       # 22/22 بررسی API (SERVER باید در حال اجرا باشد)
```

نتایج اجرای نهایی (۱۴۰۵/۰۹/۰۴ — ۲۵ نوامبر ۲۰۲۶): typecheck ✅، ۷/۷ تست ✅، build ✅ (gzip وب ۹۵.۲KB)، smoke ۲۲/۲۲ ✅، `expo-doctor` ۲۰/۲۰ ✅، `npm audit` صفر critical/high ✅.

## ساخت APK بومی اندروید (Kotlin + Compose) — توصیهشده

ماژول `apps/android` جایگزین کامل نسخهٔ React Native است: تمام صفحهها، ناوبری، ذخیرهٔ امن JWT و RTL به Kotlin/Compose نوشته شدهاند و هیچ باندلر JS/Metroای لازم ندارد. جزئیات در [`docs/11-native-kotlin.md`](docs/11-native-kotlin.md).

```powershell
cd apps/android
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"

.\gradlew.bat :app:assembleDebug --console=plain
.\gradlew.bat :app:assembleRelease -PapiBaseUrl=http://82.115.17.7:3001 --console=plain
```

- خروجی release: `apps/android/app/build/outputs/apk/release/app-release.apk` — self-contained و مناسب گوشی فیزیکی/VPS.
- آدرس API پیشفرض `http://82.115.17.7:3001` است و با `-PapiBaseUrl` قابل تغییر است. چون API فعلی HTTP است، `usesCleartextTraffic=true` تنظیم شده است.
- release با **debug keystore** امضا میشود (پایلوت)؛ `applicationId` برابر `ir.boshghabyar.app` است، پس قبل از نصب، نسخهٔ قدیمی RN را از گوشی پاک کنید.
- Gradle wrapper 9.4.1 + AGP 9.2.1 + Kotlin 2.2.10 + Compose BOM 2026.11.01؛ JVM target 17.

## ساخت APK قدیمی Expo / React Native (فقط مرجع)

پوشهٔ `android/` به‌صورت خودکار از روی `app.json` ساخته می‌شود (Continuous Native Generation) و در gitignore است؛ آن را دستی ویرایش نکنید.

```bash
# ۱) تولید پروژهٔ native اندروید
cd apps/mobile
npx expo prebuild --platform android
```

۲) Android Studio → **Open** → پوشهٔ `apps/mobile/android` را باز کنید و منتظر پایان Gradle Sync بمانید.

۳) اتصال Git: Android Studio ریشهٔ مخزن (`Boshghabyar`) را از پوشهٔ والد به‌طور خودکار تشخیص می‌دهد؛ از منوی **Git / VCS** می‌توانید تغییرات را ببینید و commit کنید. پوشهٔ `android/` عمداً در gitignore است.

۴) ساخت فایل APK (بدون نیاز به شبیه‌ساز): **Build → Build Bundle(s)/APK(s) → Build APK(s)**؛ خروجی در `android/app/build/outputs/apk/debug/app-debug.apk` ساخته می‌شود.

۵) اجرا روی شبیه‌ساز: **Device Manager → Create Virtual Device** (ایمیج نصب‌شدهٔ `android-37`)، سپس **Run 'app'**. پیش از Run این دو را در ترمینال جدا اجرا کنید:

```bash
npm run api:dev        # API روی پورت 3001
npm run mobile:start   # Metro (باندلر JS)
```

> آدرس API برای شبیه‌ساز اندروید `http://10.0.2.2:3001` است (از قبل در `apps/mobile/src/lib/api.ts` تنظیم شده). برای گوشی واقعی، `EXPO_PUBLIC_API_URL=http://<IP-شبکهٔ-لپ‌تاپ>:3001` را تنظیم کنید. Gradle 9.4.1 با JDK 25 (همان JBR اندروید استودیو) سازگار است.

### عیب‌یابی بیلد محلی اندروید

- خطای `ninja: error: mkdir(...) No such file or directory`: علت عبور مسیر از سقف ۲۶۰ کاراکتری ویندوز است. راه‌حل: ارتقای `ninja.exe` داخل SDK (مسیر `<SDK>\cmake\3.22.1\bin\ninja.exe`) به نسخهٔ ۱.۱۲ یا بالاتر.
- قطع‌شدن ناگهانی `Kotlin daemon`: کمبود رم است. در `apps/mobile/android/gradle.properties` مقادیر `org.gradle.parallel=false`، `org.gradle.workers.max=2` و `kotlin.daemon.jvmargs=-Xmx1024m` را تنظیم کنید و هنگام بیلد سنگین، برنامه‌های پرمصرف را ببندید.
- خروجی `app-debug.apk` پیش‌فرض برای شبیه‌ساز `x86_64` است. برای گوشی واقعی از `-PreactNativeArchitectures=arm64-v8a` استفاده کنید.

### اجرا روی گوشی فیزیکی (وقتی سرور/VPS است)

APK دیباگ **به Metro نیاز دارد** و روی گوشی فیزیکی پیغام `Unable to load script` میدهد مگر اینکه گوشی از طریق USB و با `adb reverse tcp:8081 tcp:8081` به کامپیوتر وصل باشد. روی VPS چنین ارتباطی وجود ندارد؛ از **APK release** استفاده کن:

```powershell
# 1) API را production روی IP عمومی VPS اجرا کن
# apps/api/.env : NODE_ENV=production , JWT_SECRET=<راندوم> , CORS_ORIGIN=http://<VPS-IP>:3001
npm run api:dev

# 2) پورت 3001 را هم در Windows Firewall و هم در Security Group ارائهٔ VPS باز کن

# 3) APK release شامل باندل JS (بدون نیاز به Metro) بساز
$env:EXPO_PUBLIC_API_URL='http://<VPS-IP>:3001'
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
```

خروجی: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

- چون API از طریق HTTP است، `android.usesCleartextTraffic: true` در `app.json` تنظیم شده است. برای محیط واقعی از HTTPS/دامنه استفاده کن.
- APK release فعلی با **debug keystore** امضا میشود؛ برای انتشار در فروشگاه باید keystore اختصاصی ساخته شود.
- IP عمومی را در `EXPO_PUBLIC_API_URL` قرار بده، نه `10.0.2.2` (مخصوص شبیهساز) و نه `localhost` (مخصوص همان دستگاه).

## مستندات

- [`docs/00-roadmap.md`](docs/00-roadmap.md) — نقشۀ مراحل P0–P7
- [`docs/01-needs-assessment.md`](docs/01-needs-assessment.md) — تحلیل نیازها و پرسوناها
- [`docs/02-design-system.md`](docs/02-design-system.md) — رنگ، تایپوگرافی، فاصلهها و قواعد RTL
- [`docs/03-wireframes/`](docs/03-wireframes/) — وایرفریمهای موبایل و وب
- [`docs/04-architecture.md`](docs/04-architecture.md) — معماری، قرارداد API و الزامات غیرعملکردی
- [`docs/07-technical-evaluation.md`](docs/07-technical-evaluation.md) — ارزیابی فنی و benchmark
- [`docs/08-security-evaluation.md`](docs/08-security-evaluation.md) — ارزیابی امنیتی و نتایج اسکن
- [`docs/09-cognitive-evaluation.md`](docs/09-cognitive-evaluation.md) — ارزیابی شناختی و دسترسپذیری
- [`docs/12-project-overview.md`](docs/12-project-overview.md) — نمای کلی جامع پروژه (معماری، API، کلاینت‌ها، امنیت، تست)
- [`docs/13-improvement-backlog.md`](docs/13-improvement-backlog.md) — Backlog بهبودها (تشخیص غذا با دوربین، HTTPS، پرداخت، اعلان، آفلاین، …)

## محدودیتهای صریح

- مشتری بومی `apps/android` (Kotlin/Compose) مسیر اصلی است؛ نسخهٔ Expo/RN تنها برای مرجع نگه داشته شده و APK release آن (arm64-v8a، ۳۱.۱MB) روی گوشی فیزیکی تأیید نشده است.
- نسخهٔ release بومی با debug keystore امضا میشود و هنوز برای انتشار در فروشگاه مناسب نیست.
- هیچ کاربر آزمایشی، فروش واقعی، درگاه پرداخت یا سرویس AI متصل وجود ندارد؛ بنابراین شاخصهای SUS و نرخ موفقیت اندازهگیری نشدهاند.
- `/api/upgrade` تنها شبیهسازی است و `plan_limit_hit` و چرخش نشانه در backlogاند.
- ESLint تنظیم نشده؛ `typecheck` بهعنوان جایگزین موقت استفاده میشود.
- سه هشدار `moderate` در زنجیرۀ ابزار ساخت Expo (`minimatch` ← `@expo/fingerprint`) باقیاند؛ رفع آنها مستلزم downgrade شکنندۀ Expo است و آسیبپذیری critical/high وجود ندارد.

---

**تماس:** Abdollahbarati66@gmail.com · 09141199762
