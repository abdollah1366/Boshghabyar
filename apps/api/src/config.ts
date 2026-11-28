import 'dotenv/config';

const flag = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const env = process.env.NODE_ENV ?? 'development';
const isProd = env === 'production';

export type SmsProviderName = 'console' | 'kavenegar';
export type AiProviderName = 'none' | 'mock' | 'openai' | 'anthropic';

export const config = {
  env,
  isProd,
  port: Number(process.env.PORT ?? 3001),
  timezone: process.env.APP_TIMEZONE ?? 'Asia/Tehran',
  trustProxy: process.env.TRUST_PROXY ?? (isProd ? 'loopback' : 'false'),
  corsOrigins:
    process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ?? ['http://localhost:5173', 'http://127.0.0.1:5173'],

  /** نشست ورود به‌صورت پیش‌فرض ۳۰ روز اعتبار دارد تا کاربر مدام وارد نشود */
  sessionDays: Number(process.env.SESSION_DAYS ?? 30),

  /** ورود با کد پیامکی */
  smsProvider: (process.env.SMS_PROVIDER ?? 'console') as SmsProviderName,
  kavenegarKey: process.env.KAVENEGAR_API_KEY ?? '',
  kavenegarTemplate: process.env.KAVENEGAR_TEMPLATE ?? 'boshghabyar-otp',
  /** فقط برای پایلوت/توسعه: کد در پاسخ API برگردانده می‌شود. در محیط واقعی خاموش باشد. */
  otpDebugReturnCode: flag(process.env.OTP_DEBUG_RETURN_CODE, !isProd),

  enableDemo: flag(process.env.ENABLE_DEMO, true),
  allowMockUpgrade: flag(process.env.ALLOW_MOCK_UPGRADE, !isProd),

  /** پرداخت درون‌برنامه‌ای بازار */
  bazaarRsaPublicKey: process.env.BAZAAR_RSA_PUBLIC_KEY ?? '',
  bazaarTestMode: flag(process.env.BAZAAR_TEST_MODE, !isProd),

  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@boshghabyar.ir',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',

  /** تشخیص غذا با عکس */
  aiProvider: (process.env.AI_PROVIDER ?? 'none') as AiProviderName,
  aiKey: process.env.AI_API_KEY ?? '',
  aiModel: process.env.AI_MODEL ?? '',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 15_000),
  maxImageBytes: Number(process.env.MAX_IMAGE_BYTES ?? 4 * 1024 * 1024),

  /** کلید شبه‌ناشناس‌سازی داده‌های پژوهشی؛ پیش‌فرض همان JWT_SECRET است */
  researchSecret: process.env.RESEARCH_SECRET ?? process.env.JWT_SECRET ?? 'dev-only-change-me-boshghabyar',
} as const;

export const DEFAULT_ADMIN_PASSWORD = 'Admin@12345';
export const DEFAULT_DEMO_PASSWORD = 'Demo@12345';
