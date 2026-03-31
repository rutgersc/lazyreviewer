import { buildTreeSitterWorker } from "./build-treesitter-worker";

await buildTreeSitterWorker("./dist");

const result = await Bun.build({
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  minify: process.env.NODE_ENV === "production",
  sourcemap: process.env.NODE_ENV !== "production" ? "external" : "none",
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) console.error(message);
  process.exit(1);
}

const indexPath = "./dist/index.js";
const content = await Bun.file(indexPath).text();
if (!content.startsWith("#!/")) {
  await Bun.write(indexPath, `#!/usr/bin/env bun\n${content}`);
}

console.log("✅ Build completed");
