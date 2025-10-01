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
  for (const message of result.logs) {
    console.error(message);
  }
  process.exit(1);
}

console.log("✅ Build completed successfully!");
console.log("Files generated:");
result.outputs.forEach((output) => {
  console.log(`  ${output.path}`);
});
