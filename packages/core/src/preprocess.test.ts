import { describe, expect, it } from "vitest";
import { computeScale, grayscaleAndNormalize } from "./preprocess";

// preprocessImage本体は、vitest（Node）ではOffscreenCanvasが使えないためテストしない

describe("computeScale", () => {
  it("通常サイズなら指定した倍率のまま", () => {
    expect(computeScale(1200, 800, { scale: 2, maxPixels: 4_000_000 })).toBe(2);
  });

  it("上限画素数を超える場合は上限に収まる倍率まで下げる", () => {
    const width = 1500;
    const height = 1000;
    const scale = computeScale(width, height, { scale: 2, maxPixels: 4_000_000 });
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeLessThan(2);
    expect(width * height * scale * scale).toBeCloseTo(4_000_000, 0);
  });

  it("とても大きい画像でも倍率は1未満にならない", () => {
    const scale = computeScale(5000, 5000, { scale: 2, maxPixels: 4_000_000 });
    expect(scale).toBe(1);
  });
});

describe("grayscaleAndNormalize", () => {
  it("白背景（明るい）は反転しない", () => {
    // 0.299*240 + 0.587*240 + 0.114*240 = 240（平均輝度240 >= 128）
    const data = new Uint8ClampedArray([240, 240, 240, 255, 230, 230, 230, 200]);
    const inverted = grayscaleAndNormalize(data, 128);

    expect(inverted).toBe(false);
    expect(data[0]).toBeCloseTo(240, 0);
    expect(data[3]).toBe(255);
    expect(data[7]).toBe(200);
  });

  it("黒背景（暗い）は反転する", () => {
    // 平均輝度10 < 128 のため反転し、255-10=245になる
    const data = new Uint8ClampedArray([10, 10, 10, 255, 20, 20, 20, 100]);
    const inverted = grayscaleAndNormalize(data, 128);

    expect(inverted).toBe(true);
    expect(data[0]).toBeCloseTo(245, 0);
    expect(data[1]).toBeCloseTo(245, 0);
    expect(data[2]).toBeCloseTo(245, 0);
    expect(data[3]).toBe(255);
    expect(data[7]).toBe(100);
  });

  it("RGBが異なる場合も輝度の式どおりに変換する", () => {
    // 0.299*255 + 0.587*0 + 0.114*0 = 76.245 → 反転しない画素として輝度76に揃う
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    grayscaleAndNormalize(data, 0);

    expect(data[0]).toBeCloseTo(76, 0);
    expect(data[1]).toBeCloseTo(76, 0);
    expect(data[2]).toBeCloseTo(76, 0);
  });
});
