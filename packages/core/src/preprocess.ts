// OCRの精度を上げるため、切り抜いた画像を補正する
// TODO(v1.1-B): 拡大・グレースケール化・暗い背景の反転を実装する。現時点では何もしない
export async function preprocessImage(blob: Blob): Promise<Blob> {
  return blob;
}
