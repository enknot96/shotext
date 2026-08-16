import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { viteStaticCopy } from "vite-plugin-static-copy";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [
    crx({ manifest }),
    viteStaticCopy({
      targets: [
        { src: "node_modules/tesseract.js/dist/worker.min.js", dest: "." },
        { src: "node_modules/tesseract.js-core/tesseract-core*.wasm.js", dest: "." },
        { src: "node_modules/@tesseract.js-data/jpn/4.0.0/jpn.traineddata.gz", dest: "tessdata" },
      ],
    }),
  ],
});
