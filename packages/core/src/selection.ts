import type { SelectionRect } from "./types";

export function startSelectionOverlay(): Promise<SelectionRect | null> {
  return new Promise((resolve) => {
    // RAMにdivタグを生成
    const overlay = document.createElement("div");
    // divタグにスタイルを追加していく
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(0, 0, 0, 0.3)";
    overlay.style.cursor = "crosshair";
    overlay.style.zIndex = "2147483647";

    // 現時点のoverflow設定を保存。後で安全に戻すため
    const originalOverflow = document.body.style.overflow;
    // ページ全体のスクロールを禁止
    document.body.style.overflow = "hidden";
    // bodyタグ直下に上記で設定したdivタグを追加。ブラウザが「新しい要素がDOMツリーに追加された」と認識
    document.body.appendChild(overlay);

    // ドラッグの開始位置など設定
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    // mousedownが起きた時に実行する処理
    function onMouseDown(event: MouseEvent) {
      startX = event.clientX;
      startY = event.clientY;
      isDragging = true;
    }

    // mousemoveが起きた時に実行する処理
    function onMouseMove(event: MouseEvent) {
      if (!isDragging) return;
    }

    // mouseupが起きた時に実行する処理
    function onMouseUp(event: MouseEvent) {
      if (!isDragging) return;
      isDragging = false;

      // クリックを離した瞬間の座標を記録
      const endX = event.clientX;
      const endY = event.clientY;

      const rect: SelectionRect = {
        // 「左上から右下」だけでなく「右下から左上」にもドラッグされる
        // 開始点と終了点の小さい方を「四角形の左上」として使う必要がある = Math.min()
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        // マイナスにならないよう、幅は「差の絶対値」 = Math.abs()
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
      };

      // ここでpendingだったPromiseがfullfilledに変わり、中身がrectになり、
      // await startSelectionOverlay()で待っていた側にデータ=rectが届く
      cleanup();
      resolve(rect);
    }

    // addEventListenerの削除
    function cleanup() {
      overlay.removeEventListener("mousedown", onMouseDown);
      overlay.removeEventListener("mousemove", onMouseMove);
      overlay.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      document.body.style.overflow = originalOverflow;
    }

    // escボタンが押された時に解除
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cleanup();
        resolve(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    // 生成したdivに各mouseイベントが発生したら、それに応じた関数を実行
    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);
  });
}
