import { showCopyToast, startSelectionOverlay } from "@shotext/core";
import type { ExtensionMessage, SelectionRect } from "@shotext/core";

// トースト表示位置を決めるため、直近の選択範囲を覚えておく
let lastRect: SelectionRect | null = null;

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "START_SELECTION") {
    handleSelection();
  }
  if (message.type === "COPY_TO_CLIPBOARD") {
    // OCRで認識されたテキスト（message.text）を、ユーザーのクリップボードにコピーする処理
    navigator.clipboard.writeText(message.text);
    if (lastRect) {
      showCopyToast(lastRect, "コピーしました！");
    }
  }
});

async function handleSelection() {
  const rect = await startSelectionOverlay();
  if (rect === null) {
    return;
  }
  lastRect = rect;

  const message: ExtensionMessage = {
    type: "OCR_SELECTION_DONE",
    rect,
    devicePixelRatio: window.devicePixelRatio,
  };
  chrome.runtime.sendMessage(message);
}
