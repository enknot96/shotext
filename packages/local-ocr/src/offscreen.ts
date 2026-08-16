import { captureAndCrop, type ExtensionMessage, type SelectionRect } from "@shotext/core";
import { TesseractEngine } from "./engines/tesseractEngine";

const engine = new TesseractEngine();

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "RUN_OCR") {
    handleRunOcr(message.dataUrl, message.rect, message.devicePixelRatio);
  }
});

async function handleRunOcr(dataUrl: string, rect: SelectionRect, devicePixelRatio: number) {
  const blob = await captureAndCrop(dataUrl, rect, devicePixelRatio);
  const result = await engine.recognize(blob);
  console.log(`[shotext] OCR完了: ${Math.round(result.elapsedMs)}ms`);

  const resultMessage: ExtensionMessage = {
    type: "OCR_RESULT",
    text: result.text,
  };
  chrome.runtime.sendMessage(resultMessage);
}
