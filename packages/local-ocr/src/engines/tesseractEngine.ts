import type { OcrEngine, OcrResult } from "@shotext/core";
import { createWorker } from "tesseract.js";

// Tesseractを使うOCRエンジンは、
// こういう形（nameはこれ、recognizeはこう動く）という設計図を宣言しているだけ
// implements OcrEngine = このクラスは、指定した型をちゃんと満たしているか、コンパイル時にチェックしてという指示
// class（設計図）は関数と異なり、「何かを返す」ものではないため、戻り値の型を定義しているわけではない
export class TesseractEngine implements OcrEngine {
  readonly name = "tesseract-local";
  async recognize(imageBlob: Blob): Promise<OcrResult> {
    // 今の時刻をミリ秒単位で取得
    const start = performance.now();

    // tesseract.js側の関数 / 日本語OCR用の実行環境を1つ用意
    // 引数：言語コード, OCRモード, 設定
    const worker = await createWorker("jpn", 1, {
      workerPath: chrome.runtime.getURL("worker.min.js"),
      corePath: chrome.runtime.getURL("."),
      langPath: chrome.runtime.getURL("tessdata"),
    });

    // 渡されたBlobを画像として解析し、文字を認識するアルゴリズムにかける
    // dataに認識結果が入る
    const { data } = await worker.recognize(imageBlob);
    await worker.terminate();

    return {
      text: data.text.trim(),
      elapsedMs: performance.now() - start,
      engineName: this.name,
    };
  }
}
