import Router from "@koa/router";
import multer from "@koa/multer";
import { verifyFile, uploadChunk, mergeChunks } from "../service/file.js";
import auth from "../utils/auth.js";
import type { AppContext } from "../types.js";

const router = new Router<unknown, AppContext>();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
});

export default function createFileRouter(): Router<unknown, AppContext> {
  // /api/v1/file/verify
  router.post("/verify", auth, verifyFile);
  // /api/v1/file/upload
  router.post("/upload", auth, upload.single("chunk"), uploadChunk);
  // /api/v1/file/merge
  router.post("/merge", auth, mergeChunks);
  return router;
}
