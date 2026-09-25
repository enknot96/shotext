import type { OcrEngine, OcrLine, OcrOutput } from "@shotext/core";
import { createWorker, type Worker } from "tesseract.js";

// worker.recognize()の戻り値の型（data.blocks）を、追加のimportなしで取り出す
type RecognizeData = Awaited<ReturnType<Worker["recognize"]>>["data"];

// Tesseractを使うOCRエンジンは、
// こういう形（nameはこれ、recognizeはこう動く）という設計図を宣言しているだけ
// implements OcrEngine = このクラスは、指定した型をちゃんと満たしているか、コンパイル時にチェックしてという指示
// class（設計図）は関数と異なり、「何かを返す」ものではないため、戻り値の型を定義しているわけではない
export class TesseractEngine implements OcrEngine {
  readonly name = "tesseract-local";
  private workerPromise: Promise<Worker> | null = null;

  constructor(private readonly langs: string) {}

  // ワーカーの作成（wasmコア・辞書データのロード）は重いため、初回のみ行い使い回す
  private async getWorker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker(this.langs, 1, {
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

  async recognize(imageBlob: Blob): Promise<OcrOutput> {
    // 今の時刻をミリ秒単位で取得
    const start = performance.now();

    // 実際のWorkerインスタンスが入る
    const worker = await this.getWorker();

    // 渡されたBlobを画像として解析し、文字を認識するアルゴリズムにかける
    // dataに認識結果が入る。blocks: trueで、行ごとの座標（インデント推定用）も取得する
    const { data } = await worker.recognize(imageBlob, {}, { text: true, blocks: true });

    // 整形は、編集パネルでタイプを切り替えて整形し直せるようcontent側で行う。ここでは生テキストと行の座標を返す
    return {
      rawText: data.text.trim(),
      lines: flattenLines(data.blocks),
      elapsedMs: performance.now() - start,
      engineName: this.name,
    };
  }
}

// data.blocks → paragraphs → lines を平らにした配列にする
function flattenLines(blocks: RecognizeData["blocks"]): OcrLine[] {
  if (!blocks) {
    return [];
  }

  const lines: OcrLine[] = [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        lines.push({
          text: line.text.replace(/\n+$/, ""),
          bbox: line.bbox,
          words: line.words.map((word) => ({ text: word.text, bbox: word.bbox })),
        });
      }
    }
  }
  return lines;
}
