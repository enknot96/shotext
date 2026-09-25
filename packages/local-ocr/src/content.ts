import { classifyText, formatText, showCopyToast, startSelectionOverlay } from "@shotext/core";
import type { ExtensionMessage, SelectionRect } from "@shotext/core";

// トースト表示位置を決めるため、直近の選択範囲を覚えておく
let lastRect: SelectionRect | null = null;

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "START_SELECTION") {
    handleSelection();
  }
  if (message.type === "OCR_RESULT") {
    // 生テキストのタイプを判定して整形し、ユーザーのクリップボードにコピーする
    const { output } = message;
    const text = formatText(output, classifyText(output.rawText));
    navigator.clipboard.writeText(text);
    if (lastRect) {
      showCopyToast(lastRect, "Copied!");
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
    type: "SELECTION_DONE",
    rect,
    devicePixelRatio: window.devicePixelRatio,
  };
  chrome.runtime.sendMessage(message);
}
