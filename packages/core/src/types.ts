export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrEngine {
  readonly name: string;
  recognize(imageBlob: Blob): Promise<OcrResult>;
}

export interface OcrResult {
  text: string;
  elapsedMs: number;
  engineName: string;
}

export type ExtensionMessage =
  | { type: "OCR_SELECTION_DONE"; rect: SelectionRect; devicePixelRatio: number }
  | { type: "COPY_TO_CLIPBOARD"; text: string }
  | { type: "OCR_ERROR"; message: string };
