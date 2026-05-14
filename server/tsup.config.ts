import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/app.ts",
  },
  format: ["esm"],
  target: "es2022",
  outDir: "dist",
  sourcemap: true,
  dts: true,
  clean: true,
  splitting: false,
});
