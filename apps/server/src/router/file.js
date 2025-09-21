import express from "express";
import multer from "multer";
import { verifyFile, uploadChunk, mergeChunks } from "../service/file.js";
import auth from "../utils/auth.js";

const router = express.Router();

export default function createFileRouter() {
  //! /api/v1/file/verify
  router.post("/verify", auth, verifyFile);
  //! /api/v1/file/upload
  router.post(
    "/upload",
    auth,
    multer({
      limits: { fileSize: 10 * 1024 * 1024 },
    }).single("chunk"),
    uploadChunk,
  );
  //! /api/v1/file/merge
  router.post("/merge", auth, mergeChunks);
  return router;
}
