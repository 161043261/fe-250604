import { IMergeChunksParams, IUploadChunkParams, IVerifyFileParams } from '@/types/file';
import request from '@/utils/request';

export async function verifyFileApi(params: IVerifyFileParams) {
  const res = await request.post('/file/verify', params);
  return res.data;
}

export async function mergeChunksApi(params: IMergeChunksParams) {
  const res = await request.post('/file/merge', params);
  return res.data;
}

export async function uploadChunkApi(params: IUploadChunkParams) {
  const formData = new FormData();
  formData.append('chunk', new Blob([params.chunk]));
  formData.append('chunkIdx', params.chunkIdx.toString());
  formData.append('fileHash', params.fileHash);
  formData.append('extName', params.extName);
  const res = await request.post('/file/upload', formData);
  return res.data;
}
