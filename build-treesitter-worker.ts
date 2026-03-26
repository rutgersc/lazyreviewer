/**
 * Workaround: Bundle openTUI's tree-sitter worker for dist/ builds.
 *
 * Bun's bundler does not automatically bundle Web Worker entrypoints.
 * When the main app is bundled to dist/, the tree-sitter client tries to
 * spawn a Worker from dist/parser.worker.js — which doesn't exist.
 * This builds the worker as a separate entrypoint into dist/.
 *
 * Additionally, the worker imports "web-tree-sitter/tree-sitter.wasm" but
 * the package only exports "web-tree-sitter/web-tree-sitter.wasm" (wrong
 * filename in openTUI). Even with the correct name, Bun emits a relative
 * path that resolves against CWD rather than the worker's directory. A
 * build plugin fixes both by resolving the import to a virtual module
 * that returns the absolute path to the real wasm file.
 *
 * Upstream: https://github.com/sst/opentui/issues/807
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
    entrypoints: [resolve(import.meta.dirname, "vendor/opentui/packages/core/src/lib/tree-sitter/parser.worker.ts")],
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
