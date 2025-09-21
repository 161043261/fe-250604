import {
  Android,
  ExcelOne,
  FilePdf,
  FileQuestion,
  FileTxt,
  Powerpoint,
  Terminal,
  VideoOne,
  Word,
  Zip,
} from '@icon-park/react';

export function getFileType(filename: string) {
  const extName = filename!.split('.').at(-1)?.toLowerCase();
  switch (extName) {
    case 'avi':
    case 'flv':
    case 'mov':
    case 'mp4':
    case 'mpeg':
    case 'wmv':
      return 'video';
    case 'gif':
    case 'jpeg':
    case 'jpg':
    case 'png':
    case 'svg':
    case 'webp':
      return 'image';
    default:
      return 'file';
  }
}

export function getFileIcon(filename: string) {
  const extName = filename!.split('.').at(-1)?.toLowerCase();
  switch (extName) {
    case 'doc':
    case 'docx':
      return Word;

    case 'xls':
    case 'xlsx':
      return ExcelOne;

    case 'ppt':
    case 'pptx':
      return Powerpoint;

    case 'pdf':
      return FilePdf;

    case 'apk':
      return Android;

    case 'exe':
      return Terminal;

    case '7z':
    case 'bz2':
    case 'gz':
    case 'rar':
    case 'tar':
    case 'zip':
      return Zip;

    case 'avi':
    case 'flv':
    case 'mov':
    case 'mp4':
    case 'mpeg':
    case 'wmv':
      return VideoOne;

    case 'txt':
      return FileTxt;

    default:
      return FileQuestion;
  }
}

export async function calcMediaRawSize(
  mediaUrl: string,
  mediaType: 'image' | 'video',
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (mediaType === 'image') {
      const imgElem = document.createElement('img');
      imgElem.src = mediaUrl;
      imgElem.onload = () => {
        resolve({ width: imgElem.width, height: imgElem.height });
      };
      imgElem.onerror = () => {
        reject('图片加载失败');
      };
    } else {
      const videoElem = document.createElement('video');
      videoElem.src = mediaUrl;
      videoElem.addEventListener('canplay', () => {
        resolve({ width: videoElem.videoWidth, height: videoElem.videoHeight });
      });
    }
  });
}

export function calcMediaWidth(
  size: { width: number; height: number },
  mediaType: 'image' | 'video',
): string {
  if (mediaType === 'image') {
    const rem = size.width / 1000;
    return rem < 1 ? `${rem + 0.2}rem` : `${Math.min(rem, 3)}rem`;
  } else {
    return size.width > size.height ? '2.5rem' : '1rem';
  }
}

export function downloadFile(url: string) {
  try {
    const anchorElem = document.createElement('a');
    anchorElem.href = url;
    anchorElem.download = '';
    document.body.appendChild(anchorElem);
    anchorElem.click();
    document.body.removeChild(anchorElem);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  try {
    const anchorElem = document.createElement('a');
    const url = URL.createObjectURL(blob);
    anchorElem.href = url;
    anchorElem.download = filename;
    document.body.appendChild(anchorElem);
    anchorElem.click();
    document.body.removeChild(anchorElem);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
  }
}

export async function checkUrlExist(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch (err) {
    console.error(err);
    return false;
  }
}
