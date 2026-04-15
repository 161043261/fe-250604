import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";

export default {
  input: "src/app.ts",
  output: {
    file: "dist/index.js",
    format: "esm",
    sourcemap: true,
  },
  plugins: [
    json(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
  ],
  external: [
    "@koa/bodyparser",
    "@koa/multer",
    "@koa/router",
    "ioredis",
    "jsonwebtoken",
    "koa",
    "koa-static",
    "knex",
    "multer",
    "mysql2",
    "uuid",
    "ws",
    "node:fs",
    "node:path",
    "node:http",
    "node:crypto",
  ],
};
