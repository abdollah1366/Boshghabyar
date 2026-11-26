# بشقاب‌یار — Backlog بهبودها (برای اجرا توسط مدل‌های بالاتر)

این سند لیست **اولویت‌بندی‌شده**ی بهبودهای پیشنهادی است. هر بخش شامل «هدف»، «تغییرات لازم»، «قرارداد (API/DB/UI)» و «نکات امنیتی» است تا یک مدل قوی بتواند بدون ابهام آن را پیاده‌سازی کند. بخش ۱ (تشخیص غذا با دوربین) درخواست اصلی کاربر است.

---

## ۰. اولویت‌بندی کلی

| اولویت | دسته | دلیل |
|---|---|---|
| P0 | تشخیص غذا با دوربین (بخش ۱) | درخواست کاربر؛ ارزش محصول را چند برابر میکند |
| P0 | HTTPS + دامنه + service manager | پیش‌نیاز انتشار واقعی |
| P1 | درگاه پرداخت واقعی (Pro) | درآمدزایی |
| P1 | اعلان‌ها / یادآوری وعده | بازگشت کاربر |
| P1 | آفلاین / کش محلی | تجربهٔ گوشی |
| P2 | بارکد / برچسب تغذیه | دقت بیشتر |
| P2 | داشبورد ادمین پیشرفته | عملیات |
| P3 | پوشیدنی / اشتراک‌گذاری / چندزبانه | رشد |

---

## ۱. تشخیص غذا با دوربین (Food Recognition)

### ۱.۱ هدف کاربر

کاربر در صفحهٔ «ثبت وعده» دکمهٔ 📷 را میزند → دوربین باز میشود → عکس میگیرد → اپ غذا را تشخیص میدهد و **خودکار** غذا + مقدار پیشنهادی را در فرم ثبت وعده پر میکند → کاربر تأیید/ویرایش میکند → وعده ثبت میشود.

### ۱.۲ معماری پیشنهادی

```
[Camera Screen] --capture--> [Image compress] --multipart--> [API /api/recognize]
                                                              │
                                                              ▼
                                                       [Vision Model]
                                                       (OpenAI gpt-4o /
                                                        Gemini 2.0 flash /
                                                        Claude 3.5 sonnet)
                                                              │
                                                              ▼
                                              { foodId, confidence, grams, alternatives[] }
                                                              │
                                                              ▼
                                                  [Log screen prefill]
```

**مهم:** تشخیص باید با **لیست غذاهای موجود** (`FOODS`) محدود شود تا خروجی قابل map به DB باشد. مدل vision فقط `id` غذای تشخیص‌داده‌شده را برمیگرداند.

### ۱.۳ تغییرات Backend (`apps/api`)

#### الف) متغیرهای محیطی (`.env.example`)

```
AI_PROVIDER=openai            # openai | gemini | anthropic | none
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=15000
MAX_IMAGE_BYTES=4194304        # 4MB
RECOGNITION_DAILY_LIMIT_FREE=5
RECOGNITION_DAILY_LIMIT_PRO=50
IMAGE_STORAGE_DIR=./data/images
IMAGE_RETENTION_DAYS=7
```

#### ب) وابستگی‌ها

- `openai` (یا `@google/generative-ai` / `@anthropic-ai/sdk`)
- `sharp` (resize/compress/validation)
- `multer` یا `busboy` برای multipart
- `file-type` برای اعتبارسنجی magic bytes

#### ج) DB Schema (`db.ts`)

جدول جدید:

```sql
CREATE TABLE IF NOT EXISTS meal_photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meal_photos_user ON meal_photos(user_id);
```

ستون جدید در `meals`:

```sql
ALTER TABLE meals ADD COLUMN photo_id TEXT REFERENCES meal_photos(id);
```

(مهاجرت idempotent: چک کنید ستون وجود دارد.)

#### د) Endpoint جدید

```
POST /api/recognize
Content-Type: multipart/form-data
Field: image (file)
Auth: Bearer
```

پاسخ:

```json
{
  "photoId": "uuid",
  "detection": {
    "foodId": "ghormeh-sabzi",
    "foodNameFa": "قورمه‌سبزی",
    "confidence": 0.87,
    "suggestedGrams": 250,
    "alternatives": [
      { "foodId": "gheyme", "confidence": 0.41 }
    ]
  },
  "prompt": "..."   // فقط Pro (aiExplanations)
}
```

خطاها:
- 400 `تصویر معتبر نیست`
- 413 `حجم تصویر بیش از حد مجاز است`
- 429 `سهمیهٔ روزانهٔ تشخیص تمام شده`
- 503 `سرویس تشخیص موقتاً در دسترس نیست`

#### هـ) منطق سرور

1. اعتبارسنجی: mime `image/jpeg|png|webp`, size ≤ `MAX_IMAGE_BYTES`, magic bytes با `file-type`
2. ذخیرهٔ فایل در `IMAGE_STORAGE_DIR/{userId}/{uuid}.jpg` (با `sharp` resize به max 1024px + JPEG quality 80)
3. ثبت در `meal_photos` با `expires_at = now + IMAGE_RETENTION_DAYS`
4. چک سهمیهٔ روزانه (count meals_photos created today by user)
5. فراخوانی Vision Model با prompt:

```
You are a food recognition assistant for an Iranian nutrition app.
Given an image of a meal, identify the single best matching food from this list:
<JSON list of {id, nameFa, category}>
Return ONLY JSON: {"foodId": "...", "confidence": 0.0-1.0, "suggestedGrams": number, "alternatives": [{"foodId":"...","confidence":0.0-1.0}]}
If none match, foodId=null.
```

6. Parse + validate output with zod (اگر invalid → 503)
7. map `foodId` به `FOODS` (اگر null → error `غذا شناسایی نشد`)
8. Pro gating: `prompt` فقط اگر `hasFeature(plan, 'aiExplanations')`
9. رویداد: `trackEvent('food.recognized', ...)`

#### و) پاکسازی دوره‌ای

- Cron روزانه (یا при запуске): حذف فایل‌های منقضی از دیسک + DB.

#### ز) ارتقای `/api/meals`

- `POST /api/meals` باید `photoId` (اختیاری) را بپذیرد و در `meals.photo_id` ذخیره کند.
- `GET /api/meals` و `/api/reports/daily` باید `photoUrl` (مسیر نسبی یا signed URL) را برگردانند (فقط برای صاحب وعده).

### ۱.۴ تغییرات Android (`apps/android`)

#### الف) وابستگی‌ها (`app/build.gradle`)

```groovy
implementation 'androidx.camera:camera-core:1.4.0'
implementation 'androidx.camera:camera-camera2:1.4.0'
implementation 'androidx.camera:camera-lifecycle:1.4.0'
implementation 'androidx.camera:camera-view:1.4.0'
implementation 'androidx.exifinterface:exifinterface:1.3.7'
```

#### ب) مجوزها (`AndroidManifest.xml`)

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

#### ج) جریان UI

1. در `LogScreen` یک دکمهٔ «📷 ثبت با عکس» اضافه شود.
2. کلیک → `ActivityResultContracts.RequestPermission()` برای `CAMERA`.
3. اگر مجوز داده شد → navigate به `CameraScreen`.
4. `CameraScreen`: `PreviewView` + دکمهٔ شاتر + دکمهٔ بستن.
5. شاتر → `ImageCapture.takePicture()` → `File` در `cacheDir`.
6. فشرده‌سازی: `BitmapFactory` → resize به 1024px → `compress(JPEG, 80)` → `ByteArray`.
7. نمایش پیش‌نمایش + «تأیید / گرفتن مجدد».
8. تأیید → `api.recognize(imageBytes)` → loading spinner.
9. نتیجه → navigate back to `LogScreen` با `foodId` + `grams` prefill (via NavBackStackEntry savedStateHandle یا shared ViewModel).
10. کاربر تأیید/ویرایش → submit.

#### د) ApiClient

```kotlin
suspend fun recognize(imageBytes: ByteArray): RecognizeResult
// multipart/form-data با OkHttp MultipartBody
```

#### هـ) مدل‌ها (`Models.kt`)

```kotlin
data class RecognizeResult(
  val photoId: String,
  val foodId: String?,
  val foodNameFa: String?,
  val confidence: Double,
  val suggestedGrams: Int,
  val alternatives: List<RecognizeAlternative>,
  val prompt: String?
)
```

#### و) دقت UX

- نمایش confidence به صورت badge (≥0.8 سبز، ۰.۵–۰.۸ زرد، <0.۵ قرمز)
- اگر confidence < 0.5 → پیام «تشخیص نامطمئن؛ لطفاً غذا را دستی انتخاب کنید»
- دکمهٔ «گرفتن مجدد» همیشه در دسترس

### ۱.۵ تغییرات وب (`apps/web`)

- دکمهٔ «📷» در `LogMeal` → `<input type="file" accept="image/*" capture="environment">`
- پیش‌نمایش با `URL.createObjectURL`
- آپلود با `FormData` → `api.recognize(file)`
- همان prefill

### ۱.۶ امنیت و حریم خصوصی

- تصاویر ممکن است چهره/اطلاعات شخصی داشته باشند → ذخیرهٔ محدود (۷ روز) + حذف خودکار
- URL تصویر نباید public باشد → endpoint `GET /api/photos/:id` با احراز هویت + owner check
- اعتبارسنجی magic bytes (نه فقط mime)
- Rate limit per user (free 5/day, pro 50/day)
- لاگ نکردن بایت‌های تصویر
- رضایت کاربر (consent) قبل از اولین استفاده

### ۱.۷ تست‌ها

- Unit: parse output زد، اعتبارسنجی تصویر، سهمیه
- Integration: mock vision provider → endpoint test
- E2E (اختیاری): تصویر نمونه → تشخیص

---

## ۲. HTTPS + دامنه + Service Manager (P0)

### هدف

API روی `https://api.boshghabyar.ir` (یا subdomain) با گواهی Let's Encrypt، و اجرای دائمی با systemd/pm2.

### تغییرات

- Nginx reverse proxy: `location / { proxy_pass http://127.0.0.1:3001; }`
- Certbot: `certbot --nginx -d api.boshghabyar.ir`
- `usesCleartextTraffic=false` در Android (بعد از HTTPS)
- `CORS_ORIGIN=https://app.boshghabyar.ir,https://...`
- systemd unit یا pm2 ecosystem file
- `local.properties`/`apiBaseUrl` به HTTPS

---

## ۳. درگاه پرداخت واقعی (P1)

### هدف

`/api/upgrade` از mock به پرداخت واقعی (زرین‌پال/IDPay/NextPay).

### تغییرات

- Endpoint `POST /api/payments/initiate` → redirect به gateway
- Webhook `POST /api/payments/callback` → verify + upgrade
- جدول `payments` (id, user_id, amount, status, gateway, ref, created_at)
- Android: WebView یا Custom Tabs برای پرداخت
- Pro activation فقط بعد از تأیید gateway

---

## ۴. اعلان‌ها / یادآوری وعده (P1)

### Android

- WorkManager برای یادآوری روزانه (مثلاً ۱۲:۰۰ و ۱۹:۰۰)
- Notification channel + deep link به Log screen
- تنظیمات در Profile (toggle)

### Web

- Web Push (اختیاری) یا فقط ایمیل

---

## ۵. آفلاین / کش محلی (P1)

### Android

- Room DB برای cache غذاها و وعده‌های اخیر
- Repository pattern: network-first با fallback به cache
- WorkManager برای sync وعده‌های pending

### Web

- Service Worker + IndexedDB (اختیاری)

---

## ۶. بارکد / برچسب تغذیه (P2)

- Android: ML Kit Barcode Scanning → lookup در Open Food Facts API
- Fallback به تشخیص عکس (بخش ۱)
- افزودن غذای جدید از بارکد به `custom_foods`

---

## ۷. داشبورد ادمین پیشرفته (P2)

- چارت‌ها (recharts) برای ثبت‌های روزانه، کاربران فعال
- فیلتر تاریخ، export CSV
- مدیریت کاربران (block/unblock, plan override)

---

## ۸. بهبودهای UX/دسترس‌پذیری (P2)

- Dark mode (Material3 dynamic color + CSS tokens)
- TalkBack labels روی همهٔ کامپوننت‌ها
- اندازهٔ فونت پویا (sp)
- onboarding (۳ اسلاید)
- empty states با تصویر
- pull-to-refresh در صفحه‌های لیست
- swipe-to-delete وعده

---

## ۹. تست و CI/CD (P2)

- GitHub Actions: `npm run typecheck`, `npm test`, `npm run build`, smoke (با API mock)
- Android: Gradle build در CI (ubuntu + setup-java + sdk)
- E2E: Playwright (web) + Maestro (android)
- Coverage reporting

---

## ۱۰. سایر بهبودهای پیشنهادی (P3)

- صادرات داده (CSV/PDF)
- اشتراک‌گذاری گزارش (تصویر)
- یکپارچگی با Google Fit / Apple Health
- پشتیبانی چندزبانه (en/ar)
- یادگیری شخصی‌سازی پیشنهادها (بر اساس تاریخچه)
- Recipe builder (ترکیب چند غذا)
- جستجو/فیلتر غذا
- favorite foods

---

## ۱۱. قراردادهایی که باید پایدار بمانند

- همهٔ محاسبات تغذیهای در `@boshghabyar/core` انجام میشوند (نه در AI).
- AI فقط متن توضیحی یا تشخیص عکس — هرگز عدد.
- محدودیت‌های طرح فقط در سرور.
- API base URL از `BuildConfig`/env، هرگز hardcode در کد کلاینت.
- تمام endpointهای جدید باید `authRequired` داشته باشند (مگر health).

---

## ۱۲. ترتیب پیشنهادی اجرا

1. بخش ۲ (HTTPS) — پیش‌نیاز همه
2. بخش ۱ (تشخیص عکس) — ارزش اصلی
3. بخش ۳ (پرداخت) — درآمد
4. بخش ۴ + ۵ (اعلان + آفلاین)
5. بخش ۶–۱۰ (رشد و کیفیت)

---

**نکتهٔ کلیدی برای مدل‌های بالاتر:** هنگام پیاده‌سازی بخش ۱، ابتدا یک **abstraction layer** برای vision provider بسازید (`VisionProvider` interface) تا بتوان provider را بدون تغییر کد عوض کرد. همچنین تصاویر را **هرگز** در پاسخ JSON برنگردانید؛ فقط `photoId` و URL احراز‌شده.

**تماس:** Abdollahbarati66@gmail.com · 09141199762
