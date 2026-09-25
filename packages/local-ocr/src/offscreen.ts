import {
  captureAndCrop,
  langsForUiLanguage,
  preprocessImage,
  type ExtensionMessage,
  type SelectionRect,
} from "@shotext/core";
import { TesseractEngine } from "./engines/tesseractEngine";

// Workerの作成（wasmコア・辞書データのロード）は重いため、最初のRUN_OCRで作って使い回す
let engine: TesseractEngine | null = null;

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "RUN_OCR") {
    handleRunOcr(message.tabId, message.dataUrl, message.rect, message.devicePixelRatio, message.uiLanguage);
  }
});

async function handleRunOcr(
  tabId: number,
  dataUrl: string,
  rect: SelectionRect,
  devicePixelRatio: number,
  uiLanguage: string,
) {
  try {
    if (!engine) {
      engine = new TesseractEngine(langsForUiLanguage(uiLanguage));
    }

    const cropped = await captureAndCrop(dataUrl, rect, devicePixelRatio);
    const preprocessed = await preprocessImage(cropped);
    const output = await engine.recognize(preprocessed);
    console.log(`[shotext] OCR完了: ${Math.round(output.elapsedMs)}ms`);

    const resultMessage: ExtensionMessage = {
      type: "OCR_RESULT",
      tabId,
      output,
    };
    chrome.runtime.sendMessage(resultMessage);
  } catch (error) {
    console.error("[shotext] OCR failed", error);

    const errorMessage: ExtensionMessage = {
      type: "OCR_ERROR",
      tabId,
      reason: "ocr_failed",
    };
    chrome.runtime.sendMessage(errorMessage);
  }
}
