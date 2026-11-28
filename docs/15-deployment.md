# استقرار بشقاب‌یار روی سرور لینوکس

این راهنما کل برنامه (وب + API + دیتابیس) را روی یک سرور لینوکس (Ubuntu) با Docker اجرا می‌کند. آدرس نمونه: `130.185.75.111`.

## ۱. پیش‌نیازها

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # بعد: خروج و ورود مجدد
```

## ۲. گرفتن کد

```bash
git clone https://github.com/abdollah1366/Boshghabyar.git
cd Boshghabyar
```

## ۳. تنظیم متغیرهای محیطی

یک فایل `.env` کنار `docker-compose.yml` بسازید:

```bash
cd deploy
nano .env
```

محتوا (مقادیر را عوض کنید):

```bash
# رمز سرور را با دستور زیر تولید کنید: openssl rand -base64 48
JWT_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_STRING
ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
CORS_ORIGIN=http://130.185.75.111
```

## ۴. ساخت و اجرا

```bash
cd deploy
docker compose up -d --build
```

بررسی:

```bash
docker compose ps
curl http://localhost/api/health
```

## ۵. آدرس‌ها

| سرویس | آدرس |
|---|---|
| وب | `http://130.185.75.111` |
| API | `http://130.185.75.111/api` |

## ۶. HTTPS (پیشنهادی)

```bash
sudo apt install -y certbot python3-certbot-nginx
# ابتدا یک دامنه به سرور وصل کنید (مثلاً app.boshghabyar.ir)
# سپس:
sudo certbot --nginx -d app.boshghabyar.ir
```

بعد از HTTPS، در `.env` مقدار `CORS_ORIGIN=https://app.boshghabyar.ir` بگذارید و در اپ اندروید `usesCleartextTraffic=false` شود.

## ۷. پشتیبان‌گیری از دیتابیس

دیتابیس SQLite داخل volume `boshghabyar-data` است. برای پشتیبان‌گیری:

```bash
# هر شب با cron
docker compose exec api node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/data/boshghabyar.db');db.exec('VACUUM INTO \'/data/backup.db\'')"
docker compose cp api:/data/backup.db ./backups/backup-$(date +%F).db
```

## ۸. به‌روزرسانی

```bash
cd Boshghabyar && git pull
cd deploy && docker compose up -d --build
```

## ۹. عیب‌یابی

```bash
docker compose logs -f api     # لاگ API
docker compose logs -f web     # لاگ وب
docker compose restart api
```

## ۱۰. نکتهٔ امنیتی مهم

قبل از انتشار واقعی، این موارد را در `.env` غیرفعال کنید:

```bash
ENABLE_DEMO=false
ALLOW_MOCK_UPGRADE=false
OTP_DEBUG_RETURN_CODE=false
BAZAAR_TEST_MODE=false
SMS_PROVIDER=kavenegar
KAVENEGAR_API_KEY=...
```
