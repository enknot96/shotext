export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// OCR結果をどう整形するか（文章 / コード / ターミナル）
export type TextType = "prose" | "code" | "terminal";

export interface OcrBbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  bbox: OcrBbox;
}

export interface OcrLine {
  text: string;
  bbox: OcrBbox;
  words: OcrWord[];
}

// OCRエンジンの出力
// 整形はcontent側で行うため、整形前の生テキストと、インデント推定用の行ごとの座標を持たせる
export interface OcrOutput {
  rawText: string;
  lines: OcrLine[];
  elapsedMs: number;
  engineName: string;
}

export interface OcrEngine {
  readonly name: string;
  recognize(imageBlob: Blob): Promise<OcrOutput>;
}

// tabIdはservice workerのグローバル変数に持たず、メッセージで受け渡す
// （service workerは停止されることがあり、グローバル変数の値が消えるため）
export type ExtensionMessage =
  // background → content
  | { type: "START_SELECTION" }
  // content → background（tabIdはsender.tab.idから取る）
  | { type: "SELECTION_DONE"; rect: SelectionRect; devicePixelRatio: number }
  // background → offscreen（offscreenではchrome.i18nが使えないため、UIの言語をここで渡す）
  | {
      type: "RUN_OCR";
      tabId: number;
      dataUrl: string;
      rect: SelectionRect;
      devicePixelRatio: number;
      uiLanguage: string;
    }
  // offscreen → background → content
  | { type: "OCR_RESULT"; tabId: number; output: OcrOutput }
  // offscreen → background → content
  | { type: "OCR_ERROR"; tabId: number; reason: "ocr_failed" };
