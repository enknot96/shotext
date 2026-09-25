import {
  captureAndCrop,
  preprocessImage,
  type ExtensionMessage,
  type SelectionRect,
} from "@shotext/core";
import { TesseractEngine } from "./engines/tesseractEngine";

const engine = new TesseractEngine();

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "RUN_OCR") {
    handleRunOcr(message.tabId, message.dataUrl, message.rect, message.devicePixelRatio);
  }
});

async function handleRunOcr(
  tabId: number,
  dataUrl: string,
  rect: SelectionRect,
  devicePixelRatio: number,
) {
  const cropped = await captureAndCrop(dataUrl, rect, devicePixelRatio);
  const blob = await preprocessImage(cropped);
  const output = await engine.recognize(blob);
  console.log(`[shotext] OCR完了: ${Math.round(output.elapsedMs)}ms`);

  const resultMessage: ExtensionMessage = {
    type: "OCR_RESULT",
    tabId,
    output,
  };
  chrome.runtime.sendMessage(resultMessage);
}
