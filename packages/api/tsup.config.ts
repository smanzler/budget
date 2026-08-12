import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  target: "node20",
  clean: true,
  sourcemap: true,
  noExternal: ["@template/shared"],
});
