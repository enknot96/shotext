import type { SelectionRect } from "./types";

export async function captureAndCrop(
  // "data:image/png;base64,iVBOR..."のような、画像データが文字列になっている
  dataUrl: string,
  rect: SelectionRect,
  devicePixelRatio: number,
): Promise<Blob> {
  // 文字列になっている画像データを格納
  const response = await fetch(dataUrl);
  // 文字列を生のバイナリデータ（0と1）に変換
  const fullBlob = await response.blob();
  // 実際に描画できる状態までデコード
  const fullBitmap = await createImageBitmap(fullBlob);

  // 「実際の画像データ上での座標」に変換
  const cropX = rect.x * devicePixelRatio;
  const cropY = rect.y * devicePixelRatio;
  const cropWidth = rect.width * devicePixelRatio;
  const cropHeight = rect.height * devicePixelRatio;

  // 切り抜きたいサイズのキャンバスをメモリ上だけに存在させる
  // ただの「サイズだけ決まった空の板」 / この板自体には、描画機能は無い
  const canvas = new OffscreenCanvas(cropWidth, cropHeight);
  // そのキャンバスに対して使用できる2D描画用の道具（drawImageなど）をctxに格納
  const ctx = canvas.getContext("2d");

  // 画像切り抜き
  if (!ctx) {
    throw new Error("Failed to get 2d context");
  }

  // 最初1つ目の引数=元の画像（どの画像から切り取るか）
  // 次の4つ=その画像の、どの範囲を切り取るか（切り取り元の座標とサイズ）
  // 最後の4つ=切り取った部分を、新しいキャンバスのどこに、どのサイズで貼り付けるか
  ctx.drawImage(fullBitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  return canvas.convertToBlob({ type: "image/png" });
}
