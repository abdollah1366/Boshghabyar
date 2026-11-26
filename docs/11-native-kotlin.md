# ۱۱) مشتری بومی اندروید — Kotlin + Jetpack Compose

این سند پورت کامل رابط اندروید از Expo/React Native به **Kotlin بومی + Jetpack Compose** را توصیف می‌کند. ماژول قدیمی (`apps/mobile`) برای مرجع باقی می‌ماند؛ ماژول جدید `apps/android` جایگزین آن است و از همان API و قواعد سمت سرور استفاده می‌کند.

## ساختار

```
apps/android/
├─ settings.gradle / build.gradle / gradle.properties
├─ app/
│  ├─ build.gradle                  # AGP 9.2.1, Kotlin 2.2.10, Compose BOM 2026.11.01
│  ├─ debug.keystore                # امضای موقت پایلوت (مانند نسخهٔ RN)
│  └─ src/main/
│     ├─ AndroidManifest.xml        # INTERNET, RTL, usesCleartextTraffic
│     ├─ res/font/                  # Vazirmatn Regular + Bold (TTF محلی)
│     ├─ res/mipmap-*/              # آیکون اپ
│     └─ java/ir/boshghabyar/app/
│        ├─ MainActivity.kt         # نقطهٔ ورود Compose + MaterialTheme
│        ├─ Navigation.kt           # NavHost، محافظت از مسیرها، نوار پایین RTL
│        ├─ ApiClient.kt            # OkHttp + Bearer token + خطای API
│        ├─ SessionStore.kt         # EncryptedSharedPreferences (ذخیرهٔ JWT)
│        ├─ Models.kt               # مدل‌های JSON و برچسب‌های فارسی
│        ├─ Theme.kt                # رنگ‌ها، فونت و کامپوننت‌های مشترک
│        └─ Screens.kt              # تمام صفحه‌ها
```

## نگاشت صفحه‌ها (تطابق با نسخهٔ Expo)

| صفحه | مسیر Compose | رفتار حفظ‌شده |
|---|---|---|
| ورود / ثبت‌نام / ورود آزمایشی | `login` | همان متون، اعتبارسنجی سرور، رویداد `ui.login_completed` / `ui.register_completed` |
| خانه | `home` | خلاصهٔ روز، ۴ شاخص، ۵ نوار پیشرفت، وعده‌های اخیر، اعداد فارسی برای هزینه |
| ثبت وعده | `log` | انتخاب غذا، وزن، نوع وعده، تخمین کالری، ارسال و نمایش جایگزین‌ها |
| گزارش‌ها | `reports` | روند ۷ روزه، میانگین، روزهای فعال، دکمهٔ ارتقای Pro |
| نمایه | `profile` | ویرایش ۶ هدف تغذیه‌ای، نوع هدف، اشتراک، خروج |
| پیشنهادها | `suggestions` | لیست وعده‌ها و محاسبهٔ جایگزین با کلیک |

رویدادهای `page.viewed` دقیقاً همان مقادیر (`home`, `log_meal`, `reports`, `suggestions`) ارسال می‌شوند. محدودیت‌های Plan (**۲۰ غذای رایگان، ۷ روز تاریخچه، عدم دسترسی به تحلیل پیشرفته و توضیح AI**) به‌صورت قاطع در سرور اعمال می‌شوند؛ رابط تنها دکمهٔ ارتقا را نمایش می‌دهد.

## تفاوت‌های عمدی / باقیمانده

- تاریخ ثبت وعده همانند نسخهٔ RN از **UTC** استفاده می‌کند (`yyyy-MM-dd`) تا رفتار تغییر نکند.
- رابط ادمین و غذای سفارشی در نسخهٔ RN هم وجود نداشت؛ در پورت بومی هم نیستند (قابل اضافه شدن در backlog).
- نسخهٔ release فعلی با **debug keystore** امضا می‌شود؛ برای انتشار در فروشگاه keystore اختصاصی لازم است.
- چون API فعلی روی HTTP و IP عمومی است، `usesCleartextTraffic=true` تنظیم شده؛ برای محیط واقعی HTTPS/دامنه توصیه می‌شود.
- `applicationId` برابر `ir.boshghabyar.app` است؛ قبل از نصب نسخهٔ بومی باید نسخهٔ قدیمی RN را از گوشی پاک کرد.
- Compose 1.13 اعلام می‌کند `minCompileMinorSdk=1` (API 37.1)، ولی SDK محلی فقط پلتفرم 37.0 را دارد و sdkmanager نصب نیست؛ بنابراین چک متادیتای AAR در `app/build.gradle` غیرفعال شد. تأثیری بر `minSdk` یا رفتار اجرایی ندارد.

## ساخت

```powershell
cd apps/android
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"

# دیباگ (برای تست سریع)
.\gradlew.bat :app:assembleDebug --console=plain

# Release برای گوشی فیزیکی / VPS
.\gradlew.bat :app:assembleRelease `
  -PapiBaseUrl=http://82.115.17.7:3001 --console=plain
```

خروجی release:

```
apps/android/app/build/outputs/apk/release/app-release.apk
```

آدرس API پیش‌فرض `http://82.115.17.7:3001` است و با پراپرتی `-PapiBaseUrl` قابلoverride است. نیازی به Metro نیست؛ باندل و کدها کاملاً بومی داخل APK قرار دارند.
