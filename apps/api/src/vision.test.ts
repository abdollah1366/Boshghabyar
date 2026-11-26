import assert from 'node:assert/strict';
import test from 'node:test';

import { FOODS } from '@boshghabyar/core';

import { parseDetection, sniffImageMime } from './vision.js';

const foods = FOODS.filter((f) => f.free);

test('خروجی معتبر مدل به غذای شناخته‌شده تبدیل می‌شود', () => {
  const id = foods[0]!.id;
  const other = foods[1]!.id;
  const result = parseDetection(
    `Here is the answer: {"foodId":"${id}","confidence":0.91,"suggestedGrams":240,"alternatives":[{"foodId":"${other}","confidence":0.3}]}`,
    foods,
  );
  assert.equal(result?.foodId, id);
  assert.equal(result?.confidence, 0.91);
  assert.equal(result?.suggestedGrams, 240);
  assert.equal(result?.alternatives[0]?.foodId, other);
});

test('غذای خارج از فهرست یا خروجی خراب رد می‌شود', () => {
  assert.equal(parseDetection('{"foodId":"pizza","confidence":0.9}', foods), null);
  assert.equal(parseDetection('{"foodId":null,"confidence":0.1}', foods), null);
  assert.equal(parseDetection('not json', foods), null);
  assert.equal(parseDetection('{"foodId":', foods), null);
});

test('اطمینان و وزن در بازهٔ مجاز محدود می‌شوند و گزینهٔ تکراری حذف می‌شود', () => {
  const id = foods[0]!.id;
  const result = parseDetection(
    `{"foodId":"${id}","confidence":7,"suggestedGrams":99999,"alternatives":[{"foodId":"${id}","confidence":0.5},{"foodId":"unknown","confidence":0.5}]}`,
    foods,
  );
  assert.equal(result?.confidence, 1);
  assert.equal(result?.suggestedGrams, 1500);
  assert.equal(result?.alternatives.length, 0);
});

test('نوع تصویر از روی بایت‌ها تشخیص داده می‌شود نه از روی هدر', () => {
  assert.equal(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(sniffImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'image/png');
  assert.equal(sniffImageMime(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), 'image/webp');
  assert.equal(sniffImageMime(Buffer.from('MZ this is an exe pretending to be a jpeg')), null);
  assert.equal(sniffImageMime(Buffer.alloc(4)), null);
});
