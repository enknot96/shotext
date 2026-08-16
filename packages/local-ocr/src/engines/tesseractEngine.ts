import type { OcrEngine, OcrResult } from "@shotext/core";
import { createWorker, type Worker } from "tesseract.js";

// Tesseractを使うOCRエンジンは、
// こういう形（nameはこれ、recognizeはこう動く）という設計図を宣言しているだけ
// implements OcrEngine = このクラスは、指定した型をちゃんと満たしているか、コンパイル時にチェックしてという指示
// class（設計図）は関数と異なり、「何かを返す」ものではないため、戻り値の型を定義しているわけではない
export class TesseractEngine implements OcrEngine {
  readonly name = "tesseract-local";
  private workerPromise: Promise<Worker> | null = null;

  // ワーカーの作成（wasmコア・辞書データのロード）は重いため、初回のみ行い使い回す
  private async getWorker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker("jpn", 1, {
        workerPath: chrome.runtime.getURL("worker.min.js"),
        corePath: chrome.runtime.getURL("."),
        langPath: chrome.runtime.getURL("tessdata"),
        workerBlobURL: false,
        // Promiseが完了したらこの関数を実行して = .then(...)
        // createWorker(...)が完了した時の中身=作られたWorkerを引数(worker)で受け取っている
      }).then(async (worker) => {
        // 日本語は単語区切りがないため、デフォルトだと文字ごとに半角スペースが入ることがある
        await worker.setParameters({ preserve_interword_spaces: "1" });
        return worker;
      });
    }
    return this.workerPromise;
  }

  async recognize(imageBlob: Blob): Promise<OcrResult> {
    // 今の時刻をミリ秒単位で取得
    const start = performance.now();

    // 実際のWorkerインスタンスが入る
    const worker = await this.getWorker();

    // 渡されたBlobを画像として解析し、文字を認識するアルゴリズムにかける
    // dataに認識結果が入る
    const { data } = await worker.recognize(imageBlob);

    return {
      text: data.text.trim(),
      elapsedMs: performance.now() - start,
      engineName: this.name,
    };
  }
}
