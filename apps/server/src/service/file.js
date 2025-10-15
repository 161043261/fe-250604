import { getFileType } from "../utils/fmt.js";
import { BaseState, FileState } from "../utils/state.js";
import { response, resOk, resErr } from "../utils/res.js";
import { promises as fs, createWriteStream, createReadStream } from "node:fs";
import { join } from "node:path";

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function verifyFile(req, res) {
  const { fileHash, chunkCnt, extName: rawExtName } = req.body;
  if (!fileHash || !chunkCnt || !rawExtName) {
    return resErr(res, BaseState.ParamErr);
  }
  const extName = rawExtName.split(".").at(-1)?.toLowerCase();
  const fileType = getFileType(extName);
  const chunkDirAbsPath = join(process.cwd(), `uploads/${fileType}/${fileHash}`);
  const fileAbsPath = chunkDirAbsPath + "." + extName;
  const filePath = `uploads/${fileType}/${fileHash}.${extName}`; // relative
  let pendingChunkIdxArr = new Array(chunkCnt).fill(0).map((_val, idx) => idx);

  try {
    await fs.stat(fileAbsPath);
    return response(
      res,
      FileState.FileUploaded, // code
      { filePath }, // data
    );
  } catch {
    try {
      await fs.stat(chunkDirAbsPath);
      const chunks = await fs.readdir(chunkDirAbsPath);
      if (chunks.length < chunkCnt) {
        pendingChunkIdxArr = pendingChunkIdxArr.filter(
          (chunkIdx) => !chunks.includes(`chunk-${chunkIdx}`),
        );
        // 部分分块未上传
        return resOk(res, { pendingChunkIdxArr, filePath } /** data */);
      } else {
        // 分块全部上传, 等待合并
        return response(res, FileState.ChunksUploaded /** code */);
      }
    } catch /** (err) */ {
      // console.error(err);
      //// await fs.mkdir(chunkDirAbsPath, { recursive: true });
      // 全部分块未上传
      return resOk(res, { pendingChunkIdxArr, filePath } /** data */);
    }
  }
}

// todo: Complete description JSDoc
/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function uploadChunk(req, res) {
  const chunk = req.file.buffer;
  const chunkIdx = Number.parseInt(req.body.chunkIdx /** 10 */);
  const { fileHash, extName: rawExtName } = req.body;
  if (/** !chunk || */ !fileHash || Number.isNaN(chunkIdx) || !rawExtName) {
    return resErr(res, BaseState.ParamErr);
  }

  const extName = rawExtName.split(".").at(-1)?.toLowerCase();
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
    return resOk(res);
  } catch (err) {
    console.error(err);
    return resErr(res, BaseState.ServerErr);
  }
}

/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function mergeChunks(req, res) {
  const { fileHash, extName: rawExtName } = req.body;
  if (!fileHash || !rawExtName) {
    return resErr(res, BaseState.ParamErr);
  }

  const extName = rawExtName.split(".").at(-1)?.toLowerCase();
  const fileType = getFileType(extName);

  // e.g.
  // extName = 'jpg'
  // dirAbsPath = '/path/to/uploads/image/161043261'
  // fileAbsPath = '/path/to/uploads/image/161043261.jpg'
  // filePath = 'uploads/image/161043261.jpg'

  const chunkDirAbsPath = join(process.cwd(), `uploads/${fileType}/${fileHash}`);
  const fileAbsPath = chunkDirAbsPath + "." + extName;
  const filePath = `uploads/${fileType}/${fileHash}.${extName}`;

  try {
    await fs.access(fileAbsPath);
    return resOk(res, { filePath });
  } catch /** (err) */ {
    // console.error(err);
  }
  const writeStream = createWriteStream(fileAbsPath);

  try {
    // merge chunks
    const chunks = await fs.readdir(chunkDirAbsPath);
    chunks.sort((a, b) => {
      const idxA = Number.parseInt(a.split("-").at(-1));
      const idxB = Number.parseInt(b.split("-")).at(-1);
      return idxA - idxB;
    });

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunkName = chunks[idx];
      const isLastChunk = idx === chunks.length - 1;
      const chunkAbsPath = join(chunkDirAbsPath, chunkName);
      const readStream = createReadStream(chunkAbsPath);

      //////////////////////////////////////////////////
      await new Promise((resolve, reject) => {
        readStream.pipe(writeStream, { end: isLastChunk });
        readStream.on("end", resolve);
        readStream.on("error", reject);
      });
      //////////////////////////////////////////////////
    }
  } catch (err) {
    console.error(err);
    return resErr(err, BaseState.ServerErr);
  }

  try {
    await rmDir(chunkDirAbsPath);
  } catch (err) {
    console.error(err);
    // resErr(res, 'mergeChunkErr');
  }
  return resOk(res, { filePath });
}

/**
 *
 * @param {string} dirPath
 */
async function rmDir(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.error(err);
  }
}
