// بررسی و اصلاح نیم‌فاصله (ZWNJ) و نویسه‌های آلوده در متن‌های فارسی.
// اجرا:  node scripts/fix-zwnj.mjs --check [مسیرها…]   فقط گزارش می‌دهد
//         node scripts/fix-zwnj.mjs --write [مسیرها…]   اصلاح می‌کند
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ZW = '\u200c';
const args = process.argv.slice(2);
const write = args.includes('--write');
const roots = args.filter((a) => !a.startsWith('--'));
const targets = roots.length ? roots : ['.'];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.gradle', '.expo', '.cxx', 'data']);
const EXTS = new Set(['.ts', '.tsx', '.kt', '.md', '.html', '.xml', '.mjs', '.json', '.css', '.ps1']);
const SKIP_FILES = new Set(['package-lock.json', 'fix-zwnj.mjs']);

const L = '\\u0621-\\u063A\\u0641-\\u064A\\u067E\\u0686\\u0698\\u06A9\\u06AF\\u06CC';
const JOIN = 'بپتثجچحخسشصضطظعغفقکگلمنهیئ';
const notLetterAfter = `(?![${L}${ZW}])`;
const notLetterBefore = `(?<![${L}${ZW}])`;

// واژه‌های مرکب و صفت‌های «ه‌ای» که نیم‌فاصله می‌خواهند
const WORDS = [
  ['ثبتنام', 'ثبت‌نام'], ['میانوعده', 'میان‌وعده'], ['راستچین', 'راست‌چین'], ['تعیینپذیر', 'تعیین‌پذیر'],
  ['ذخیرهسازی', 'ذخیره‌سازی'], ['صرفهجویی', 'صرفه‌جویی'], ['پایگاهداده', 'پایگاه‌داده'],
  ['بهصورت', 'به‌صورت'], ['بهدست', 'به‌دست'], ['بهروز', 'به‌روز'], ['بهزودی', 'به‌زودی'], ['بهطور', 'به‌طور'],
  ['بهخوبی', 'به‌خوبی'], ['بهتدریج', 'به‌تدریج'], ['بهویژه', 'به‌ویژه'], ['بهعنوان', 'به‌عنوان'],
  ['بهمنظور', 'به‌منظور'], ['بهوسیله', 'به‌وسیله'], ['بههنگام', 'به‌هنگام'], ['بهسرعت', 'به‌سرعت'],
  ['ارزانتر', 'ارزان‌تر'], ['متعادلتر', 'متعادل‌تر'], ['اقتصادیتر', 'اقتصادی‌تر'], ['سادهتر', 'ساده‌تر'],
  ['برنامهریزی', 'برنامه‌ریزی'], ['دستکم', 'دست‌کم'], ['همزمان', 'هم‌زمان'],
  ['وبسایت', 'وب‌سایت'], ['وباپ', 'وب‌اپ'], ['پیشفرض', 'پیش‌فرض'], ['پیشنیاز', 'پیش‌نیاز'],
  ['پرمصرفترین', 'پرمصرف‌ترین'], ['دسترسپذیری', 'دسترس‌پذیری'], ['شبهناشناس', 'شبه‌ناشناس'],
  ['حرفهای', 'حرفه‌ای'], ['نمونهای', 'نمونه‌ای'], ['هستهای', 'هسته‌ای'], ['تغذیهای', 'تغذیه‌ای'],
  ['مرحلهای', 'مرحله‌ای'], ['آینهای', 'آینه‌ای'], ['خانهای', 'خانه‌ای'], ['نسخهای', 'نسخه‌ای'],
  ['دورهای', 'دوره‌ای'], ['نقطهای', 'نقطه‌ای'], ['جلسهای', 'جلسه‌ای'], ['وعدهای', 'وعده‌ای'],
  ['لحظهای', 'لحظه‌ای'], ['کلمهای', 'کلمه‌ای'], ['مجموعهای', 'مجموعه‌ای'], ['نتیجهای', 'نتیجه‌ای'],
  ['رایانهای', 'رایانه‌ای'], ['سادهای', 'ساده‌ای'], ['برنامهای', 'برنامه‌ای'], ['دقیقهای', 'دقیقه‌ای'],
  ['ماهانهای', 'ماهانه‌ای'], ['هفتهای', 'هفته‌ای'], ['روزانهای', 'روزانه‌ای'], ['بودجهای', 'بودجه‌ای'],
  ['گزینهای', 'گزینه‌ای'], ['مقایسهای', 'مقایسه‌ای'], ['مشاورهای', 'مشاوره‌ای'], ['تجربهای', 'تجربه‌ای'],
  ['پروندهای', 'پرونده‌ای'], ['شبکهای', 'شبکه‌ای'], ['سلیقهای', 'سلیقه‌ای'], ['اندازهای', 'اندازه‌ای'],
  ['مطالعهای', 'مطالعه‌ای'],
];

// پیشوند «می/نمی» + ستاک فعل
const VERB_STEMS = [
  'کن', 'شو', 'ده(?=م|ی|د|ن|ید|یم)', 'دان(?=م|ی|د|ند|ید|یم)', 'توان', 'خوا', 'باش', 'رو(?=د|م|ی|ند|ید|یم)',
  'گیر', 'بین', 'گوی', 'آی', 'آور', 'افت', 'ماند', 'خور(?=د|م|ی|ند|ید|یم)', 'پذیر', 'ریز(?=د|م|ی|ند|ید|یم)',
  'رس(?=د|م|ی|ند|ید|یم)', 'نویس', 'یاب', 'گرد(?=د|م|ی|ند|ید|یم)', 'سنج', 'پرداز', 'سپار', 'شناس',
  'ساز(?=د|م|ی|ند|ید|یم)', 'نمای', 'گذار', 'کوش', 'فرست', 'خواه',
];

const rules = [];
for (const [bad, good] of WORDS) {
  const tail = good.endsWith('ای') ? notLetterAfter : '';
  rules.push({ name: `word:${bad}`, re: new RegExp(`${notLetterBefore}${bad}${tail}`, 'gu'), fn: () => good });
}
rules.push({
  name: 'mi-prefix',
  re: new RegExp(`${notLetterBefore}(ن?می)(?=(?:${VERB_STEMS.join('|')}))`, 'gu'),
  fn: (m) => `${m}${ZW}`,
});
// «ها/های/هایی» بعد از حرف چسبان
rules.push({
  name: 'plural-ha',
  re: new RegExp(`(?<=[${JOIN}])(ها|های|هایی)${notLetterAfter}`, 'gu'),
  fn: (m) => `${ZW}${m}`,
});
// «شده/شدهاند» بعد از ستاک
rules.push({
  name: 'shode',
  re: new RegExp(`(?<=[${L}]{2}[${JOIN}])(شده|شدهاند|شدهای)${notLetterAfter}`, 'gu'),
  fn: (m) => `${ZW}${m}`,
});
// پسوند تر/ترین بعد از صفت‌های رایج
rules.push({
  name: 'tar',
  re: new RegExp(`${notLetterBefore}(ساده|دقیق|سریع|کامل|جامع|مناسب|متعادل|سالم|ارزان|گران|بهینه|پرمصرف|قوی|ضعیف|مهم|مفید|آسان|مقرون)(تر|ترین)${notLetterAfter}`, 'gu'),
  fn: (_m, g) => `${g[0]}${ZW}${g[1]}`,
});

const PLURAL_SKIP_WORDS = new Set(['نهایی', 'نهایت', 'تنها', 'ایها', 'بهایی', 'گوهایی']);

const wordAround = (s, i, n) => {
  const re = /[\u0600-\u06FF\u200c]/;
  let a = i;
  let b = i + n;
  while (a > 0 && re.test(s[a - 1])) a -= 1;
  while (b < s.length && re.test(s[b])) b += 1;
  return s.slice(a, b);
};

function listFiles(path, out = []) {
  const stat = statSync(path);
  if (stat.isFile()) {
    if (EXTS.has(extname(path)) && !SKIP_FILES.has(path.split(/[\\/]/).pop())) out.push(path);
    return out;
  }
  for (const name of readdirSync(path)) {
    if (SKIP_DIRS.has(name)) continue;
    listFiles(join(path, name), out);
  }
  return out;
}

const cyrillic = /[\u0400-\u04FF]/;
let total = 0;
const report = [];

for (const target of targets) {
  for (const file of listFiles(target)) {
    const original = readFileSync(file, 'utf8');
    if (!/[\u0600-\u06FF]/.test(original)) continue;
    let text = original;
    for (const rule of rules) {
      text = text.replace(rule.re, (match, ...rest) => {
        const hasGroups = typeof rest.at(-1) === 'string';
        const full = hasGroups ? rest.at(-1) : '';
        const offset = hasGroups ? rest.at(-2) : rest.at(-1);
        const groups = rest.slice(0, rest.length - 2);
        if (rule.name === 'plural-ha') {
          const word = wordAround(full, offset, match.length).replace(/[،؛.:!؟)]+$/u, '');
          if (PLURAL_SKIP_WORDS.has(word)) return match;
        }
        total += 1;
        report.push(`${relative('.', file)}  [${rule.name}]  ${wordAround(full, offset, match.length)}`);
        return rule.fn(match, groups);
      });
    }
    original.split(/\r?\n/).forEach((line, i) => {
      if (cyrillic.test(line)) report.push(`${relative('.', file)}:${i + 1}  [cyrillic]  ${line.trim().slice(0, 80)}`);
    });
    if (write && text !== original) writeFileSync(file, text, 'utf8');
  }
}

const unique = [...new Set(report)];
for (const line of unique.slice(0, 400)) console.log(line);
console.log(`\n${total} مورد ${write ? 'اصلاح شد' : 'نیاز به اصلاح دارد'} (${unique.length} خط یکتا)`);
if (!write && unique.length) process.exitCode = 1;
