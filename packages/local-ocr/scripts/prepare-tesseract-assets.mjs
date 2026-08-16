import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public");
const tessdataDir = join(publicDir, "tessdata");

mkdirSync(publicDir, { recursive: true });
mkdirSync(tessdataDir, { recursive: true });

function copy(src, dest) {
  copyFileSync(src, dest);
  console.log(`copied: ${src} -> ${dest}`);
}

// worker.min.js
copy(
  join(root, "node_modules/tesseract.js/dist/worker.min.js"),
  join(publicDir, "worker.min.js"),
);

// 6種類のcoreファイル(*.wasm.js)を全部コピー
const coreDir = join(root, "node_modules/tesseract.js-core");
for (const file of readdirSync(coreDir)) {
  if (file.endsWith(".wasm.js")) {
    copy(join(coreDir, file), join(publicDir, file));
  }
}

// 日本語学習データ（legacy+LSTM合体版の4.0.0ではなく、LSTM専用の高精度・軽量版を使う）
copy(
  join(root, "node_modules/@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz"),
  join(tessdataDir, "jpn.traineddata.gz"),
);
