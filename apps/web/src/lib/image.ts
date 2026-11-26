const MAX_SIDE = 1024;
const QUALITY = 0.8;

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* ادامه با عنصر تصویر */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** کوچک‌سازی تصویر تا حداکثر ۱۰۲۴ پیکسل و تبدیل به JPEG با کیفیت ۰٫۸ */
export async function downscaleToJpeg(file: Blob): Promise<Blob> {
  const decoded = await decode(file);
  try {
    if (!decoded.width || !decoded.height) throw new Error('empty image');
    const scale = Math.min(1, MAX_SIDE / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('encode failed');
    return blob;
  } finally {
    decoded.close();
  }
}
