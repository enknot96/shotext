import { startSelectionOverlay } from "@shotext/core";
import type { ExtensionMessage } from "@shotext/core";

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "START_SELECTION") {
    handleSelection();
  }
  if (message.type === "COPY_TO_CLIPBOARD") {
    // OCRで認識されたテキスト（message.text）を、ユーザーのクリップボードにコピーする処理
    navigator.clipboard.writeText(message.text);
  }
});

async function handleSelection() {
  const rect = await startSelectionOverlay();
  if (rect === null) {
    return;
  }

  const message: ExtensionMessage = {
    type: "OCR_SELECTION_DONE",
    rect,
    devicePixelRatio: window.devicePixelRatio,
  };
  chrome.runtime.sendMessage(message);
}
