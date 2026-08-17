import type { SelectionRect } from "./types";

const FADE_MS = 200;
const VISIBLE_MS = 1500;

export function showCopyToast(rect: SelectionRect, message: string): void {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.left = `${rect.x}px`;
  toast.style.top = `${rect.y + rect.height + 8}px`;
  toast.style.padding = "6px 12px";
  toast.style.borderRadius = "6px";
  toast.style.background = "#4da3ff";
  toast.style.color = "#fff";
  toast.style.fontSize = "13px";
  toast.style.fontFamily = "sans-serif";
  toast.style.zIndex = "2147483647";
  toast.style.opacity = "0";
  toast.style.transition = `opacity ${FADE_MS}ms ease`;
  document.body.appendChild(toast);

  // 追加直後にstyleを変えても即座反映されないよう、1フレーム待ってからフェードイン
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), FADE_MS);
  }, VISIBLE_MS);
}
