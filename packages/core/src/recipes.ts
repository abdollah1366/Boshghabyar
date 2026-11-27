import type { Macros, MealType } from './types.js';

export interface RecipeIngredient {
  name: string;
  amount: string;
}

export interface Recipe {
  id: string;
  titleFa: string;
  mealType: MealType;
  /** ارزش غذایی هر سهم */
  perServing: Macros;
  /** تعداد سهم */
  servings: number;
  /** قیمت تقریبی هر سهم به تومان */
  priceIRRPerServing: number;
  /** زمان پخت به دقیقه */
  minutes: number;
  difficulty: 'آسان' | 'متوسط' | 'سخت';
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[];
}

export const RECIPES: Recipe[] = [
  {
    id: 'breakfast-omlet',
    titleFa: 'املت گوجه و تخم‌مرغ',
    mealType: 'breakfast',
    perServing: { kcal: 290, protein: 15, carbs: 6, fat: 22, fiber: 1 },
    servings: 2,
    priceIRRPerServing: 45000,
    minutes: 15,
    difficulty: 'آسان',
    ingredients: [
      { name: 'تخم‌مرغ', amount: '۲ عدد' },
      { name: 'گوجه‌فرنگی', amount: '۲ عدد' },
      { name: 'روغن', amount: '۱ قاشق' },
      { name: 'نمک و فلفل', amount: 'به میزان لازم' },
    ],
    steps: [
      'گوجه‌ها را ریز خرد کنید و در تابه با کمی روغن تفت دهید.',
      'تخم‌مرغ‌ها را اضافه کنید و هم بزنید تا ببندد.',
      'با نان سبوس‌دار سرو کنید.',
    ],
    tags: ['صبحانه', 'سریع', 'پرپروتئین'],
  },
  {
    id: 'breakfast-paneer-walnut',
    titleFa: 'پنیر و گردو با نان سبوس‌دار',
    mealType: 'breakfast',
    perServing: { kcal: 320, protein: 16, carbs: 28, fat: 16, fiber: 4 },
    servings: 1,
    priceIRRPerServing: 35000,
    minutes: 5,
    difficulty: 'آسان',
    ingredients: [
      { name: 'نان سبوس‌دار', amount: '۲ کف دست' },
      { name: 'پنیر', amount: '۴۰ گرم' },
      { name: 'گردو', amount: '۳ عدد' },
      { name: 'خیار و گوجه', amount: '۱ عدد از هر کدام' },
    ],
    steps: ['نان را برش بزنید و پنیر و گردو روی آن بگذارید.', 'با سبزیجات تازه میل کنید.'],
    tags: ['صبحانه', 'سریع', 'کلسیم'],
  },
  {
    id: 'breakfast-oat',
    titleFa: 'جو دوسر با شیر و خرما',
    mealType: 'breakfast',
    perServing: { kcal: 340, protein: 11, carbs: 58, fat: 7, fiber: 6 },
    servings: 1,
    priceIRRPerServing: 30000,
    minutes: 10,
    difficulty: 'آسان',
    ingredients: [
      { name: 'جو دوسر', amount: '۵۰ گرم' },
      { name: 'شیر', amount: '۱ لیوان' },
      { name: 'خرما', amount: '۲ عدد' },
      { name: 'دارچین', amount: 'کمی' },
    ],
    steps: ['جو را با شیر روی حرارت ملایم بپزید تا غلیظ شود.', 'خرما و دارچین را اضافه کنید.'],
    tags: ['صبحانه', 'فیبر', 'سالم'],
  },
  {
    id: 'lunch-chelow-morgh',
    titleFa: 'چلو مرغ آب‌پز',
    mealType: 'lunch',
    perServing: { kcal: 480, protein: 34, carbs: 58, fat: 10, fiber: 2 },
    servings: 2,
    priceIRRPerServing: 95000,
    minutes: 60,
    difficulty: 'متوسط',
    ingredients: [
      { name: 'سینه مرغ', amount: '۳۰۰ گرم' },
      { name: 'برنج', amount: '۲ پیمانه' },
      { name: 'پیاز و هویج', amount: '۱ عدد از هر کدام' },
      { name: 'زعفران', amount: 'کمی' },
    ],
    steps: ['مرغ را با پیاز و هویج و کمی زعفران بپزید.', 'برنج را آبکش و دم کنید.', 'با مرغ و سالاد سرو کنید.'],
    tags: ['ناهار', 'پرپروتئین', 'کم‌چرب'],
  },
  {
    id: 'lunch-adas-polo',
    titleFa: 'عدس پلو',
    mealType: 'lunch',
    perServing: { kcal: 520, protein: 18, carbs: 92, fat: 8, fiber: 9 },
    servings: 4,
    priceIRRPerServing: 45000,
    minutes: 50,
    difficulty: 'متوسط',
    ingredients: [
      { name: 'برنج', amount: '۳ پیمانه' },
      { name: 'عدس', amount: '۱ پیمانه' },
      { name: 'کشمش و خرما', amount: 'نصف پیمانه' },
      { name: 'پیاز', amount: '۲ عدد' },
    ],
    steps: ['عدس را نیم‌پز کنید.', 'برنج و عدس را لایه‌لایه دم کنید.', 'با پیاز داغ و کشمش تزیین کنید.'],
    tags: ['ناهار', 'حبوبات', 'اقتصادی'],
  },
  {
    id: 'lunch-ghormeh',
    titleFa: 'خورش قورمه‌سبزی',
    mealType: 'lunch',
    perServing: { kcal: 540, protein: 26, carbs: 42, fat: 28, fiber: 5 },
    servings: 4,
    priceIRRPerServing: 120000,
    minutes: 120,
    difficulty: 'سخت',
    ingredients: [
      { name: 'گوشت خورشتی', amount: '۴۰۰ گرم' },
      { name: 'سبزی قورمه', amount: '۴۰۰ گرم' },
      { name: 'لوبیا قرمز', amount: 'نصف پیمانه' },
      { name: 'لیمو عمانی', amount: '۴ عدد' },
    ],
    steps: ['سبزی را تفت دهید و گوشت و لوبیا را اضافه کنید.', 'با لیمو عمانی و آب بپزید تا جا بیفتد.', 'با برنج سرو کنید.'],
    tags: ['ناهار', 'سنتی', 'پروتئین'],
  },
  {
    id: 'dinner-soup',
    titleFa: 'سوپ جو',
    mealType: 'dinner',
    perServing: { kcal: 220, protein: 8, carbs: 34, fat: 6, fiber: 4 },
    servings: 4,
    priceIRRPerServing: 25000,
    minutes: 40,
    difficulty: 'آسان',
    ingredients: [
      { name: 'جو', amount: 'نصف پیمانه' },
      { name: 'هویج و کرفس', amount: '۱ عدد از هر کدام' },
      { name: 'آب مرغ', amount: '۴ پیمانه' },
      { name: 'آبلیمو', amount: 'کمی' },
    ],
    steps: ['جو را با آب مرغ و سبزیجات بپزید.', 'در پایان آبلیمو اضافه کنید.'],
    tags: ['شام', 'سبک', 'سوپ'],
  },
  {
    id: 'dinner-kotlet',
    titleFa: 'کتلت با نان و سبزی',
    mealType: 'dinner',
    perServing: { kcal: 380, protein: 20, carbs: 24, fat: 22, fiber: 2 },
    servings: 4,
    priceIRRPerServing: 60000,
    minutes: 30,
    difficulty: 'متوسط',
    ingredients: [
      { name: 'گوشت چرخ‌کرده', amount: '۳۰۰ گرم' },
      { name: 'سیب‌زمینی', amount: '۲ عدد' },
      { name: 'پیاز', amount: '۱ عدد' },
      { name: 'تخم‌مرغ', amount: '۲ عدد' },
    ],
    steps: ['سیب‌زمینی را رنده و آب‌گیری کنید.', 'با گوشت و پیاز و تخم‌مرغ مخلوط کنید.', 'به‌صورت شامی سرخ کنید.'],
    tags: ['شام', 'پروتئین'],
  },
  {
    id: 'snack-fruit',
    titleFa: 'میوهٔ فصل',
    mealType: 'snack',
    perServing: { kcal: 120, protein: 1, carbs: 30, fat: 0, fiber: 4 },
    servings: 1,
    priceIRRPerServing: 15000,
    minutes: 5,
    difficulty: 'آسان',
    ingredients: [{ name: 'سیب یا پرتقال', amount: '۱ عدد' }],
    steps: ['میوه را بشویید و میل کنید.'],
    tags: ['میان‌وعده', 'ویتامین'],
  },
  {
    id: 'snack-yogurt',
    titleFa: 'ماست کم‌چرب با خیار',
    mealType: 'snack',
    perServing: { kcal: 140, protein: 9, carbs: 12, fat: 6, fiber: 1 },
    servings: 1,
    priceIRRPerServing: 12000,
    minutes: 5,
    difficulty: 'آسان',
    ingredients: [
      { name: 'ماست کم‌چرب', amount: '۱ پیمانه' },
      { name: 'خیار', amount: '۱ عدد' },
    ],
    steps: ['خیار را خرد و با ماست مخلوط کنید.'],
    tags: ['میان‌وعده', 'کلسیم'],
  },
  {
    id: 'snack-nuts',
    titleFa: 'آجیل خام',
    mealType: 'snack',
    perServing: { kcal: 180, protein: 5, carbs: 6, fat: 15, fiber: 3 },
    servings: 1,
    priceIRRPerServing: 20000,
    minutes: 2,
    difficulty: 'آسان',
    ingredients: [{ name: 'بادام، گردو و پستهٔ خام', amount: 'یک مشت کوچک (۳۰ گرم)' }],
    steps: ['یک مشت کوچک آجیل خام میل کنید.'],
    tags: ['میان‌وعده', 'چربی سالم'],
  },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function recipesFor(mealType: MealType): Recipe[] {
  return RECIPES.filter((r) => r.mealType === mealType);
}
