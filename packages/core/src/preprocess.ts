export interface PreprocessOptions {
  scale: number; // 拡大倍率
  maxPixels: number; // 拡大後の画素数の上限
  invertThreshold: number; // 平均輝度がこれ未満なら白黒反転する
}

const DEFAULT_OPTIONS: PreprocessOptions = {
  scale: 2,
  maxPixels: 4_000_000,
  invertThreshold: 128,
};

// 拡大後の画素数が上限を超える場合は倍率を下げる。ただし倍率が1未満になるほど小さくはしない
export function computeScale(
  width: number,
  height: number,
  options: Pick<PreprocessOptions, "scale" | "maxPixels">,
): number {
  const { scale, maxPixels } = options;
  const scaledPixels = width * height * scale * scale;
  if (scaledPixels <= maxPixels) {
    return scale;
  }
  const limitedScale = Math.sqrt(maxPixels / (width * height));
  return Math.max(1, limitedScale);
}

// RGBを輝度に変換し、平均輝度が閾値未満なら白黒を反転する（黒背景に明るい文字 → 白背景に黒文字）
// 反転したかどうかを返り値で返す（テスト用）。dataは呼び出し側の配列を直接書き換える
export function grayscaleAndNormalize(data: Uint8ClampedArray, invertThreshold: number): boolean {
  const pixelCount = data.length / 4;
  const luminances = new Float64Array(pixelCount);
  let sum = 0;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const luminance = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    luminances[i] = luminance;
    sum += luminance;
  }

  const shouldInvert = sum / pixelCount < invertThreshold;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const value = shouldInvert ? 255 - luminances[i] : luminances[i];
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    // data[offset + 3]（アルファ値）はそのまま
  }

  return shouldInvert;
}

// OCRの精度を上げるため、切り抜いた画像を補正する（拡大 → グレースケール化 → 暗い背景の反転）
// 独自の二値化はせず、Tesseract内部の処理に任せる（SPEC 4.1）
export async function preprocessImage(blob: Blob, options?: Partial<PreprocessOptions>): Promise<Blob> {
  const opts: PreprocessOptions = { ...DEFAULT_OPTIONS, ...options };

  const bitmap = await createImageBitmap(blob);
  const scale = computeScale(bitmap.width, bitmap.height, opts);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2d context");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  grayscaleAndNormalize(imageData.data, opts.invertThreshold);
  ctx.putImageData(imageData, 0, 0);

  return canvas.convertToBlob({ type: "image/png" });
}
