import { getFileType } from "../utils/fmt.js";
import { BASE_STATE, FILE_STATE } from "../utils/state.js";
import { response, resOk, resErr } from "../utils/res.js";
import { promises as fs, createWriteStream, createReadStream } from "node:fs";
import { join } from "node:path";
import type { AppContext, VerifyFileRequest, MergeChunksRequest } from "../types.js";
import type { File } from "@koa/multer";

export async function verifyFile(ctx: AppContext): Promise<void> {
  const { fileHash, chunkCnt, extName: rawExtName } = ctx.request.body as VerifyFileRequest;
  if (!fileHash || !chunkCnt || !rawExtName) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const extName = rawExtName.split(".").at(-1)?.toLowerCase() ?? "";
  const fileType = getFileType(extName);
  const chunkDirAbsPath = join(process.cwd(), `uploads/${fileType}/${fileHash}`);
  const fileAbsPath = chunkDirAbsPath + "." + extName;
  const filePath = `uploads/${fileType}/${fileHash}.${extName}`;
  let pendingChunkIdxArr = new Array(chunkCnt).fill(0).map((_val, idx) => idx);

  try {
    await fs.stat(fileAbsPath);
    response(ctx, FILE_STATE.FileUploaded, { filePath });
  } catch {
    try {
      await fs.stat(chunkDirAbsPath);
      const chunks = await fs.readdir(chunkDirAbsPath);
      if (chunks.length < chunkCnt) {
        pendingChunkIdxArr = pendingChunkIdxArr.filter(
          (chunkIdx) => !chunks.includes(`chunk-${chunkIdx}`),
        );
        resOk(ctx, { pendingChunkIdxArr, filePath });
      } else {
        response(ctx, FILE_STATE.ChunksUploaded);
      }
    } catch {
      resOk(ctx, { pendingChunkIdxArr, filePath });
    }
  }
}

interface UploadChunkBody {
  chunkIdx: string;
  fileHash: string;
  extName: string;
}

export async function uploadChunk(ctx: AppContext): Promise<void> {
  const file = ctx.file as File | undefined;
  if (!file) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }
  const chunk = file.buffer;
  const body = ctx.request.body as UploadChunkBody;
  const chunkIdx = Number.parseInt(body.chunkIdx);
  const { fileHash, extName: rawExtName } = body;
  if (!fileHash || Number.isNaN(chunkIdx) || !rawExtName) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }

  const extName = rawExtName.split(".").at(-1)?.toLowerCase() ?? "";
  const fileType = getFileType(extName);
  const chunkDirAbsPath = join(process.cwd(), `uploads/${fileType}/${fileHash}`);
  const chunkAbsPath = join(chunkDirAbsPath, `chunk-${chunkIdx}`);

  try {
    const chunksDirExist = await fs
      .access(chunkDirAbsPath)
      .then(() => true)
      .catch(() => false);
    if (!chunksDirExist) {
      await fs.mkdir(chunkDirAbsPath, { recursive: true });
    }
    await fs.writeFile(chunkAbsPath, Buffer.from(chunk.buffer));
    resOk(ctx);
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
  }
}

export async function mergeChunks(ctx: AppContext): Promise<void> {
  const { fileHash, extName: rawExtName } = ctx.request.body as MergeChunksRequest;
  if (!fileHash || !rawExtName) {
    resErr(ctx, BASE_STATE.ParamErr);
    return;
  }

  const extName = rawExtName.split(".").at(-1)?.toLowerCase() ?? "";
  const fileType = getFileType(extName);

  const chunkDirAbsPath = join(process.cwd(), `uploads/${fileType}/${fileHash}`);
  const fileAbsPath = chunkDirAbsPath + "." + extName;
  const filePath = `uploads/${fileType}/${fileHash}.${extName}`;

  try {
    await fs.access(fileAbsPath);
    resOk(ctx, { filePath });
    return;
  } catch {
    // File doesn't exist, continue to merge
  }

  const writeStream = createWriteStream(fileAbsPath);

  try {
    const chunks = await fs.readdir(chunkDirAbsPath);
    chunks.sort((a, b) => {
      const idxA = Number.parseInt(a.split("-").at(-1) ?? "0");
      const idxB = Number.parseInt(b.split("-").at(-1) ?? "0");
      return idxA - idxB;
    });

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunkName = chunks[idx];
      const isLastChunk = idx === chunks.length - 1;
      const chunkAbsPath = join(chunkDirAbsPath, chunkName);
      const readStream = createReadStream(chunkAbsPath);

      await new Promise<void>((resolve, reject) => {
        readStream.pipe(writeStream, { end: isLastChunk });
        readStream.on("end", resolve);
        readStream.on("error", reject);
      });
    }
  } catch (err) {
    console.error(err);
    resErr(ctx, BASE_STATE.ServerErr);
    return;
  }

  try {
    await rmDir(chunkDirAbsPath);
  } catch (err) {
    console.error(err);
  }
  resOk(ctx, { filePath });
}

async function rmDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.error(err);
  }
}
