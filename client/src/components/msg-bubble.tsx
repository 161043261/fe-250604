import useUserInfoStore from '@/store/user-info';
import { IMsg } from '@/types/chat';
import { IMediaItem } from '@/types/file';
import {
  calcMediaRawSize,
  calcMediaWidth,
  checkUrlExist,
  downloadFile,
  getFileIcon,
} from '@/utils/file';
import { DeleteFive, Play } from '@icon-park/react';
import { useEffect, useState } from 'react';
import { Image, Modal } from 'antd';
import { fmtTime4chat } from '@/utils/fmt';
import ImgContainer from './img-container';

interface IProps {
  isTimeDisplay: boolean;
  msg: IMsg;
}

interface IProps2 {
  mediaType: 'text' | 'image' | 'video' | 'file';
  content: string;
  fileSize?: string;
}

const MsgBubble: React.FC<IProps> = (props: IProps) => {
  const { isTimeDisplay, msg } = props;
  const userInfoStore = useUserInfoStore();
  const userInfo = userInfoStore.userInfo;
  const { senderId, content, avatar, mediaType, fileSize, createdAt } = msg;

  const FallbackContent = () => (
    <div className="flex">
      <DeleteFive theme="filled" size="48" fill="#4a90e2" strokeWidth={3} />
      <div>消息已被删除或清理</div>
    </div>
  );

  const MsgContent = (props2: IProps2) => {
    const { mediaType, content, fileSize } = props2;
    const [curMedia, setCurMedia] = useState<IMediaItem | null>(null);
    // todo
    const [mediaUrl, setMediaUrl] = useState<string>(
      `${import.meta.env.VITE_SERVER_URL}/${content}`,
    );
    const [isVideoPlay, setIsVideoPlay] = useState<boolean>(false);
    const [isFileExist, setIsFileExist] = useState<boolean>(true);

    useEffect(() => {
      const newMediaUrl = `${import.meta.env.VITE_SERVER_URL}/${content}`;
      setMediaUrl(newMediaUrl); // 异步
      if (mediaType !== 'text') {
        checkUrlExist(newMediaUrl).then((res) => setIsFileExist(res));
      }
      if (mediaType === 'image' || mediaType === 'video') {
        calcMediaRawSize(newMediaUrl, mediaType)
          .then((size) => {
            setCurMedia({ type: mediaType, url: newMediaUrl, size });
          })
          .catch(console.error);
      }
    }, [mediaType, content]);

    if (!isFileExist) {
      return <FallbackContent />;
    }
    const filename = mediaUrl.split('/').at(-1)!;
    const FileIcon = getFileIcon(filename);
    switch (mediaType) {
      case 'text':
        return <div>{content}</div>;
      case 'image':
        return (
          curMedia && <Image width={calcMediaWidth(curMedia.size, 'image')} src={curMedia.url} />
        );
      case 'video':
        return (
          curMedia && (
            <div>
              <video src={mediaUrl} muted></video>
              <Play theme="filled" size="48" fill="#4a90e2" strokeWidth={3} />
              <Modal
                open={isVideoPlay}
                footer={null}
                title="视频"
                onCancel={() => setIsVideoPlay(false)}
                destroyOnClose
                width={800}
              >
                <video src={mediaUrl} muted controls autoPlay width={750} />
              </Modal>
            </div>
          )
        );
      case 'file':
        return (
          <div onClick={() => downloadFile(mediaUrl)}>
            <div>文件名: {filename}</div>
            {fileSize && <div>文件大小: {fileSize}</div>}
            <FileIcon />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      {isTimeDisplay && createdAt && <div>{fmtTime4chat(createdAt)}</div>}
      {senderId === userInfo.id ? (
        <div className="flex justify-end gap-3">
          <MsgContent mediaType={mediaType} content={content} fileSize={fileSize} />
          <ImgContainer src={avatar} />
        </div>
      ) : (
        <div className="flex gap-3">
          <ImgContainer src={avatar} />
          <MsgContent mediaType={mediaType} content={content} fileSize={fileSize} />
        </div>
      )}
    </div>
  );
};

export default MsgBubble;
