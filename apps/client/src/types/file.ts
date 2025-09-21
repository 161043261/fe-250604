export interface IVerifyFileParams {
  fileHash: string;
  extName: string;
  chunkCnt: number;
}

export interface IUploadChunkParams {
  chunk: ArrayBuffer;
  chunkIdx: number;
  fileHash: string;
  extName: string;
}

export interface IMergeChunksParams {
  fileHash: string;
  extName: string;
}

export interface IMediaItem {
  type: 'image' | 'video';
  url: string;
  size: { width: number; height: number };
}
