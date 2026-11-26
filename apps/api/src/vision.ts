import { createHash } from 'node:crypto';

import type { Food } from '@boshghabyar/core';

import { config } from './config.js';

export interface Detection {
  foodId: string;
  confidence: number;
  suggestedGrams: number | null;
  alternatives: Array<{ foodId: string; confidence: number }>;
}

export class VisionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export interface VisionProvider {
  readonly name: string;
  recognize(image: Buffer, mime: string, foods: Food[]): Promise<Detection | null>;
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

function buildPrompt(foods: Food[]): string {
  const list = foods.map((f) => ({ id: f.id, nameFa: f.nameFa, category: f.category }));
  return [
    'You identify Iranian dishes in a photo for a nutrition app.',
    'Choose the single best match ONLY from this list of foods (use the id exactly):',
    JSON.stringify(list),
    'Reply with JSON only, no prose:',
    '{"foodId": string|null, "confidence": number 0..1, "suggestedGrams": integer|null, "alternatives": [{"foodId": string, "confidence": number}]}',
    'If the photo has no food or nothing in the list fits, set foodId to null.',
    'suggestedGrams is your visual estimate of the portion in grams (20..1500). Never invent foods outside the list.',
  ].join('\n');
}

/** خروجی مدل را به قالب مطمئن تبدیل می‌کند و غذاهای خارج از فهرست را حذف می‌کند */
export function parseDetection(raw: string, foods: Food[]): Detection | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let data: unknown;
  try {
    data = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as Record<string, unknown>;
  const ids = new Set(foods.map((f) => f.id));
  const foodId = typeof obj.foodId === 'string' && ids.has(obj.foodId) ? obj.foodId : null;
  if (!foodId) return null;
  const confidence = typeof obj.confidence === 'number' ? clamp(obj.confidence, 0, 1) : 0.5;
  const grams = typeof obj.suggestedGrams === 'number' && Number.isFinite(obj.suggestedGrams)
    ? clamp(Math.round(obj.suggestedGrams), 20, 1500)
    : null;
  const alternatives = Array.isArray(obj.alternatives)
    ? obj.alternatives
        .filter((a): a is { foodId: string; confidence: number } =>
          typeof a === 'object' && a !== null && typeof (a as { foodId?: unknown }).foodId === 'string' && ids.has((a as { foodId: string }).foodId))
        .map((a) => ({
          foodId: a.foodId,
          confidence: clamp(typeof a.confidence === 'number' ? a.confidence : 0.2, 0, 1),
        }))
        .filter((a) => a.foodId !== foodId)
        .slice(0, 3)
    : [];
  return { foodId, confidence, suggestedGrams: grams, alternatives };
}

class OpenAiProvider implements VisionProvider {
  readonly name = 'openai';
  async recognize(image: Buffer, mime: string, foods: Food[]): Promise<Detection | null> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(config.aiTimeoutMs),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.aiKey}` },
      body: JSON.stringify({
        model: config.aiModel || 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildPrompt(foods) },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${image.toString('base64')}`, detail: 'low' } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) throw new VisionError('سرویس تشخیص موقتاً در دسترس نیست', 503);
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return parseDetection(json.choices?.[0]?.message?.content ?? '', foods);
  }
}

class AnthropicProvider implements VisionProvider {
  readonly name = 'anthropic';
  async recognize(image: Buffer, mime: string, foods: Food[]): Promise<Detection | null> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(config.aiTimeoutMs),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.aiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.aiModel || 'claude-3-5-haiku-latest',
        max_tokens: 300,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mime, data: image.toString('base64') } },
              { type: 'text', text: buildPrompt(foods) },
            ],
          },
        ],
      }),
    });
    if (!response.ok) throw new VisionError('سرویس تشخیص موقتاً در دسترس نیست', 503);
    const json = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
    return parseDetection(text, foods);
  }
}

/** فقط برای تست و نمایش (AI_PROVIDER=mock): انتخاب قطعی بر اساس هش تصویر؛ نتیجه واقعی نیست */
class MockProvider implements VisionProvider {
  readonly name = 'mock';
  async recognize(image: Buffer, _mime: string, foods: Food[]): Promise<Detection | null> {
    if (foods.length === 0) return null;
    const digest = createHash('sha256').update(image).digest();
    const pick = foods[digest[0]! % foods.length]!;
    const other = foods[(digest[1]! + 1) % foods.length]!;
    return {
      foodId: pick.id,
      confidence: 0.55 + (digest[2]! % 40) / 100,
      suggestedGrams: pick.serving.grams,
      alternatives: other.id === pick.id ? [] : [{ foodId: other.id, confidence: 0.2 }],
    };
  }
}

export function getVisionProvider(): VisionProvider | null {
  switch (config.aiProvider) {
    case 'openai':
      return config.aiKey ? new OpenAiProvider() : null;
    case 'anthropic':
      return config.aiKey ? new AnthropicProvider() : null;
    case 'mock':
      return new MockProvider();
    default:
      return null;
  }
}

/** بررسی نوع واقعی تصویر از روی بایت‌های ابتدایی (نه فقط هدر Content-Type) */
export function sniffImageMime(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
