/**
 * Workaround: Bundle openTUI's tree-sitter worker for dist/ builds.
 *
 * Bun's bundler does not automatically bundle Web Worker entrypoints.
 * When the main app is bundled to dist/, the tree-sitter client tries to
 * spawn a Worker from dist/parser.worker.js — which doesn't exist.
 * This re-bundles the pre-compiled worker from @opentui/core into dist/.
 *
 * The worker imports "web-tree-sitter/tree-sitter.wasm" but the package
 * only exports "web-tree-sitter/web-tree-sitter.wasm" (wrong filename in
 * openTUI). A build plugin fixes this by resolving the import to a virtual
 * module that returns the absolute path to the real wasm file.
 */

import { resolve } from "path";
import type { BunPlugin } from "bun";

const wasmPath = resolve(import.meta.dirname, "node_modules/web-tree-sitter/web-tree-sitter.wasm");

const fixTreeSitterWasm: BunPlugin = {
  name: "fix-tree-sitter-wasm",
  setup(build) {
    build.onResolve({ filter: /web-tree-sitter\/tree-sitter\.wasm$/ }, () => ({
      path: "tree-sitter-wasm-path",
      namespace: "virtual",
    }));
    build.onLoad({ filter: /.*/, namespace: "virtual" }, () => ({
      contents: `export default ${JSON.stringify(wasmPath)};`,
      loader: "js",
    }));
  },
};

export const buildTreeSitterWorker = async (outdir: string) => {
  const result = await Bun.build({
    entrypoints: [resolve(import.meta.dirname, "node_modules/@opentui/core/parser.worker.js")],
    outdir,
    target: "bun",
    format: "esm",
    naming: "parser.worker.js",
    plugins: [fixTreeSitterWasm],
  });

  if (!result.success) {
    console.error("Worker build failed");
    for (const message of result.logs) console.error(message);
    process.exit(1);
  }
};
