import SparkMd5 from 'spark-md5';

// 浏览器 worker 线程中, 没有 window 对象, this === undefined, globalThis === self
// console.log(this); // undefined
// console.log(globalThis); // DedicatedWorkerGlobalScope
// console.log(self); // DedicatedWorkerGlobalScope

self.onmessage = async (ev) => {
  const { file, chunkSize } = ev.data;
  try {
    await sliceFile(file, chunkSize);
  } catch (err) {
    console.error(err);
  }
};

/**
 *
 * @param file 上传的文件
 * @param baseChunkSize 分块大小, 单位 Mb
 */
async function sliceFile(file: File, baseChunkSize: number) {
  return new Promise((resolve, reject) => {
    const fileSlice = File.prototype.slice;
    // 分块大小
    const chunkSize = baseChunkSize * 1024 * 1024;
    // 分块数量
    const chunkCnt = file && Math.ceil(file.size / chunkSize);
    // 已分块的数量
    let doneCnt = 0;
    // 创建 SparkMd5 对象
    const sparkMd5arrBuf = new SparkMd5.ArrayBuffer();
    // 创建读文件对象
    const fileReader = new FileReader();
    // 分块数组
    const chunkList: ArrayBuffer[] = [];

    const workerMsg: {
      chunkList: ArrayBuffer[];
      msgType: 'progress' | 'ok' | 'err';
      fileHash: string;
    } = {
      chunkList,
      msgType: 'progress',
      fileHash: '',
    };

    const loadNext = () => {
      const start = chunkSize * doneCnt;
      const end = Math.min(start + chunkSize, file.size);
      //! const fileSlice = File.prototype.slice;
      fileReader.readAsArrayBuffer(fileSlice.call(file /** this */, start, end));
    };

    // 读取文件成功时触发
    fileReader.onload = async (ev) => {
      const curChunk = ev.target?.result as ArrayBuffer;
      chunkList.push(curChunk);
      sparkMd5arrBuf.append(curChunk);
      doneCnt++;

      if (chunkList.length >= 10) {
        workerMsg.msgType = 'progress';
        self.postMessage(workerMsg);
        // 清空数组
        chunkList.length = 0;
        //// chunkList.splice(0, chunkList.length);
      }

      if (doneCnt >= chunkCnt) {
        workerMsg.msgType = 'ok';
        workerMsg.fileHash = sparkMd5arrBuf.end(); // hexHash
        self.postMessage(workerMsg);
        resolve(null);
      } else {
        loadNext();
      }
    };

    fileReader.onerror = (ev: ProgressEvent) => {
      workerMsg.msgType = 'err';
      self.postMessage(workerMsg);
      console.error(ev);
      reject(null);
    };

    loadNext();
  });
}
