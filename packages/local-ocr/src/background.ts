import type { ExtensionMessage, SelectionRect } from "@shotext/core";

// どのタブがOCRを依頼したかを記録
let activeTabId: number | null = null;

chrome.commands.onCommand.addListener((command) => {
  // manifest.jsonで登録済み
  if (command === "take-screenshot") {
    startSelection();
  }
});

async function startSelection() {
  // 条件に合うタブを探して、配列（複数の可能性があるので）で返す関数 / 今回は必ず一つ
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    return;
  }
  activeTabId = tab.id;

  const message: ExtensionMessage = { type: "START_SELECTION" };
  // 送信元（tab.id）を指定 / 受信側は必要ない
  chrome.tabs.sendMessage(tab.id, message);
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "OCR_SELECTION_DONE") {
    handleSelectionDone(message.rect, message.devicePixelRatio);
  }
  if (message.type === "OCR_RESULT") {
    handleOcrResult(message.text);
  }
});

async function handleSelectionDone(rect: SelectionRect, devicePixelRatio: number) {
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
  await ensureOffscreenDocument();

  const message: ExtensionMessage = {
    type: "RUN_OCR",
    dataUrl,
    rect,
    devicePixelRatio,
  };
  chrome.runtime.sendMessage(message);
}

async function ensureOffscreenDocument() {
  const hasDocument = await chrome.offscreen.hasDocument();
  if (hasDocument) {
    return;
  }
  await chrome.offscreen.createDocument({
    url: "src/offscreen.html",
    reasons: ["WORKERS"],
    justification: "Tesseract.jsのWeb WorkerをOCR実行のために動かす",
  });
}

function handleOcrResult(text: string) {
  if (!activeTabId) {
    return;
  }
  const message: ExtensionMessage = { type: "COPY_TO_CLIPBOARD", text };
  chrome.tabs.sendMessage(activeTabId, message);
}
