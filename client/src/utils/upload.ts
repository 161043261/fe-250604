import { mergeChunksApi, uploadChunkApi, verifyFileApi } from '@/apis/file';
import { BaseState, Code2Msg, FileState } from './constants';
import { IUploadChunkParams } from '@/types/file';

// 1. 使用 spark-md5 + webworker 对文件分片, 并计算 hash 值, 得到 chunkList
// 2. 携带 fileHash 请求服务器, 判断文件上传状态 verifyFile: 文件重复上传? 分块全部上传, 等待合并? 部分分块未上传? 服务器返回 pendingChunkIdxArr 等待上传的分块序号数组
// 3. 发送分块上传/合并请求

/**
 *
 * @param targetFile 上传的文件
 * @param chunkSize 分块大小, 单位 Mb
 * @param maxRetries 最大重试次数
 * @param retryDelay 重试间隔
 * @param onProgress 更新上传进度的回调函数
 */
export function uploadFile(
  file: File,
  chunkSize: number,
  maxRetries?: number,
  retryDelay?: number,
  onProgress?: (progress: number) => void,
): Promise<{
  done: boolean;
  filePath?: string;
  msg?: string;
}> {
  return new Promise((resolve, reject) => {
    const chunkList: ArrayBuffer[] = [];
    const sliceWorker = new Worker(new URL('./slice-worker.ts', import.meta.url), {
      type: 'module',
    });
    let fileHash = '';
    sliceWorker.postMessage(
      {
        file,
        chunkSize,
      },
      { transfer: [file] }, // 转移所有权
    );
    sliceWorker.onmessage = async (ev) => {
      switch (ev.data.msgType) {
        case 'progress':
          chunkList.push(...ev.data.chunkList);
          break;
        case 'ok':
          chunkList.push(...ev.data.chunkList);
          fileHash = ev.data.fileHash;
          try {
            const res = await verifyThenMergeOrUpload(
              file,
              chunkList,
              fileHash,
              maxRetries,
              retryDelay,
              onProgress,
            );
            if (res.done) {
              resolve(res);
            } else {
              reject('文件分块失败');
            }
          } catch (err) {
            console.error(err);
            reject(err);
          }
          break;
        case 'err':
          reject('文件分块失败');
      }
    };
  });
}

async function verifyThenMergeOrUpload(
  file: File,
  chunkList: ArrayBuffer[],
  fileHash: string,
  maxRetries?: number,
  retryDelay?: number,
  onProgress?: (progress: number) => void,
): Promise<{
  done: boolean;
  filePath?: string;
  msg?: string;
}> {
  // chunkList.length >= 1
  if (chunkList.length === 0) {
    throw 'chunkList.length === 0';
  }

  const filename = file.name;
  const extName = filename.split('.').at(-1) ?? '';
  let pendingChunkIdxArr: number[] = [];
  let progress = 0;

  try {
    const params = {
      fileHash,
      extName,
      chunkCnt: chunkList.length,
    };
    const res = await verifyFileApi(params);
    // 文件重复上传
    if (res.code === FileState.FileUploaded) {
      return {
        done: true,
        filePath: res.data.filePath,
        msg: Code2Msg.get(res.code),
      }; //! resolve
    }

    // 分块全部上传, 等待合并
    if (res.code === FileState.ChunksUploaded) {
      const params = {
        fileHash,
        extName,
      };
      try {
        const res = await mergeChunksApi(params);
        if (res.code === BaseState.Ok) {
          return {
            done: true,
            filePath: res.data.filePath,
            msg: Code2Msg.get(res.code),
          }; //! resolve
        } else {
          throw Code2Msg.get(res.code); //! reject
        }
      } catch (err) {
        console.error(err);
        throw err; //! reject
      }
    }

    // 部分分块未上传
    if (res.code === BaseState.Ok) {
      const { pendingChunkIdxArr: idxArr } = res.data;
      if (idxArr.length === 0) {
        return {
          done: true,
          filePath: res.data.filePath,
          msg: Code2Msg.get(res.code),
        };
      }
      pendingChunkIdxArr = idxArr;
    } else {
      throw Code2Msg.get(res.code); //! reject
    }
  } catch (err) {
    console.error(err);
    throw err; //! reject
  }

  progress = ((chunkList.length - pendingChunkIdxArr.length) / chunkList.length) * 100;
  const asyncUploadReqList = chunkList.map(async (chunk, idx) => {
    if (pendingChunkIdxArr.includes(idx)) {
      const params = {
        chunk,
        chunkIdx: idx,
        fileHash,
        extName,
      };
      try {
        await retryUploadChunk(params, maxRetries, retryDelay);
        progress += Math.ceil(100 / chunkList.length);
        if (progress >= 100) {
          progress = 100;
        }
        if (onProgress) {
          onProgress(progress);
        }
      } catch (err) {
        console.error(err);
        throw err; //! reject
      }
    }
  });

  try {
    await Promise.all(asyncUploadReqList);
    try {
      const params = {
        fileHash,
        extName,
      };
      const res = await mergeChunksApi(params);
      if (res.code === BaseState.Ok) {
        return {
          done: true,
          filePath: res.data.filePath,
          msg: Code2Msg.get(res.code),
        }; //! resolve
      } else {
        throw Code2Msg.get(res.code); //! reject
      }
    } catch (err) {
      console.error(err);
      throw err; //! reject
    }
  } catch (err) {
    console.error(err);
    throw err; //! reject
  }
}

async function retryUploadChunk(params: IUploadChunkParams, maxRetries = 3, retryDelay = 1000) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const res = await uploadChunkApi(params);
      if (res.code === BaseState.Ok) {
        return res;
      } else {
        throw Code2Msg.get(res.code);
      }
    } catch (err) {
      console.error(err);
      retries++;
      if (retries >= maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay)); // sleep(retryDelay)
    }
  }
  throw 'retries >= maxRetries';
}
