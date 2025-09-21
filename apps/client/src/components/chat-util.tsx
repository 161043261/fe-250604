import styles from './chat-util.module.scss';
import { fetchGroupMembersApi } from '@/apis/group';
import useToast from '@/hooks/use-toast';
import useUserInfoStore from '@/store/user-info';
import { ICallReceiver, IChatItem, ISendMsg } from '@/types/chat';
import { BaseState } from '@/utils/constants';
import { getFileType } from '@/utils/file';
import { uploadFile } from '@/utils/upload';
import { ChangeEvent, useRef, useState } from 'react';
import AudioModal from './audio-modal';
import VideoModal from './video-modal';
import { MsgIconKey, MsgIconList } from '@/utils/icons';
import { Button, Spin, Tooltip } from 'antd';

interface IProps {
  curChat: IChatItem;
  doSend: (msg: ISendMsg) => void;
}

const ChatUtil: React.FC<IProps> = (props: IProps) => {
  const { curChat, doSend } = props;
  const toast = useToast();
  const userInfoStore = useUserInfoStore();
  const userInfo = userInfoStore.userInfo;
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [mountAudioModal, setMountAudioModal] = useState(false);
  const [mountVideoModal, setMountVideoModal] = useState(false);
  const [callReceiverList, setCallReceiverList] = useState<ICallReceiver[]>([]);
  const imgOrVideoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const friendOrGroup = (item: IChatItem) => Boolean(item.receiverEmail);

  const changeInputValue = (ev: ChangeEvent<HTMLTextAreaElement> /** React.ChangeEvent */) => {
    setInputValue(ev.target.value);
  };

  const sendText = () => {
    if (!inputValue || inputValue.length === 0) {
      return;
    }
    const newMsg: ISendMsg = {
      senderId: userInfo.id,
      receiverId: curChat.receiverId,
      mediaType: 'text',
      content: inputValue,
      avatar: userInfo.avatar,
    };
    try {
      doSend(newMsg);
      setInputValue('');
    } catch (err) {
      console.error(err);
      toast.error('消息发送失败');
    }
  };

  const sendFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    if (!ev.target.files || ev.target.files.length === 0) {
      return;
    }
    setIsLoading(true);
    const file = ev.target.files[0];
    if (file.size > 10 * 1024 * 1024 * 1024) {
      toast.error('文件大小不能超过 2G');
      setIsLoading(false);
      return;
    }
    try {
      const ret = await uploadFile(file, 5);
      if (ret.done && ret.filePath) {
        const newMsg: ISendMsg = {
          senderId: userInfo.id,
          receiverId: curChat.receiverId,
          mediaType: getFileType(file.name),
          content: ret.filePath,
          avatar: userInfo.avatar,
          fileSize: file.size,
        };
        try {
          doSend(newMsg);
        } catch (err) {
          console.error(err);
          toast.error('消息发送失败');
        }
      } else {
        toast.error('文件上传失败');
      }
    } catch (err) {
      console.error(err);
      toast.error('文件上传失败');
    } finally {
      setIsLoading(false);
      imgOrVideoInputRef.current!.value = '';
      fileInputRef.current!.value = '';
    }
  };

  const handleClickIcon = async (key: MsgIconKey) => {
    switch (key) {
      case 'WinkingFace':
      case 'PictureAlbum':
        imgOrVideoInputRef.current?.click();
        break;
      case 'FileCode':
        fileInputRef.current?.click();
        break;
      case 'PhoneTelephone':
        await fetchCalleeList();
        setMountAudioModal(true);
        break;
      case 'VideoOne':
        await fetchCalleeList();
        setMountVideoModal(true);
    }
  };

  const fetchCalleeList = async () => {
    if (friendOrGroup(curChat)) {
      setCallReceiverList([
        {
          email: curChat.receiverEmail!,
          alias: curChat.name,
          avatar: curChat.avatar,
        },
      ]);
      return;
    }
    const params = {
      groupId: curChat.receiverId,
      roomKey: curChat.roomKey,
    };
    try {
      const res = await fetchGroupMembersApi(params);
      if (res.code === BaseState.Ok && res.data) {
        setCallReceiverList(
          res.data.map((item) => ({
            email: item.email,
            alias: item.nickname,
            avatar: item.avatar,
          })),
        );
      } else {
        toast.error('获取群聊成员列表失败');
      }
    } catch (err) {
      console.error(err);
      toast.error('获取群聊成员列表失败');
    }
  };

  return (
    <div className="flex h-[100%] flex-col">
      <div className="flex flex-1 items-center justify-between">
        <ul className="flex items-center gap-3">
          {MsgIconList.slice(0, 3).map((item, idx) => {
            return (
              <li key={item.key}>
                <Tooltip
                  placement={idx === 0 ? 'top' : 'bottomLeft'}
                  title={item.title}
                  arrow={false}
                >
                  <item.IconInst
                    onClick={() => handleClickIcon(item.key as MsgIconKey)}
                    size={'1.5rem'}
                  />
                </Tooltip>
              </li>
            );
          })}
        </ul>

        <ul className="flex items-center gap-3">
          {MsgIconList.slice(3).map((item) => (
            <li key={item.key}>
              <Tooltip placement="bottomLeft" title={item.title} arrow={false}>
                <item.IconInst
                  onClick={() => handleClickIcon(item.key as MsgIconKey)}
                  size={'1.5rem'}
                />
              </Tooltip>
            </li>
          ))}
        </ul>

        <input
          type="file"
          accept="image/*,video/*"
          ref={imgOrVideoInputRef}
          onChange={(ev) => sendFile(ev)}
          className="hidden"
        />

        <input
          type="file"
          accept="*"
          ref={fileInputRef}
          onChange={(ev) => sendFile(ev)}
          className="hidden"
        />
      </div>
      <div className={`flex-4 ${styles.textareaWrapper}`}>
        <Spin spinning={isLoading} tip="消息发送中...">
          <textarea
            onChange={(ev) => changeInputValue(ev)}
            value={inputValue}
            className="h-[100%] w-[100%] cursor-text"
          />
        </Spin>
      </div>
      <div className="flex flex-1 items-center justify-end">
        <Button type="primary" onClick={sendText}>
          发送
        </Button>
      </div>
      {mountAudioModal && callReceiverList.length && (
        <AudioModal
          mountModal={mountAudioModal}
          setMountModal={setMountAudioModal}
          type={friendOrGroup(curChat) ? 'friend' : 'group'}
          roomKey={curChat.roomKey}
          callReceiverList={callReceiverList}
          state="initial"
        />
      )}
      {mountVideoModal && callReceiverList.length && (
        <VideoModal
          mountModal={mountVideoModal}
          setMountModal={setMountVideoModal}
          type={friendOrGroup(curChat) ? 'friend' : 'group'}
          roomKey={curChat.roomKey}
          callReceiverList={callReceiverList}
          state="initial"
        />
      )}
    </div>
  );
};

export default ChatUtil;
