import { fetchChatListApi } from '@/apis/chat';
import ChatMsg from '@/components/chat-msg';
import ChatUtils from '@/components/chat-utils';
import ImgContainer from '@/components/img-container';
import SearchBar from '@/components/search-bar';
import useToast from '@/hooks/use-toast';
import useUserInfoStore from '@/store/user-info';
import { IChatItem, IMsg, ISendMsg } from '@/types/chat';
import { IFriendExt } from '@/types/friend';
import { IGroupExt } from '@/types/group';
import { BaseState } from '@/utils/constants';
import { fmtTime4list } from '@/utils/fmt';
import { MessageEmoji } from '@icon-park/react';
import { Empty } from 'antd';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface IChatRef {
  fetchChatList: () => void; // 刷新消息列表
}

interface IProps {
  ref: React.Ref<IChatRef>;
  initialChat: IFriendExt | IGroupExt | null;
}

const friendOrGroup = (item: IFriendExt | IGroupExt): item is IFriendExt =>
  'friendId' in item && item.friendId !== undefined;

const friendOrGroup2 = (item: IChatItem): item is IChatItem =>
  'receiverEmail' in item && item.receiverEmail !== undefined;

const Chat: React.FC<IProps> = ({ ref, initialChat }: IProps /** props */) => {
  const toast = useToast();
  const userInfoStore = useUserInfoStore();
  const userInfo = userInfoStore.userInfo;
  const [chatList, setChatList] = useState<IChatItem[]>([]);
  const [curChat, setCurChat] = useState<IChatItem>();
  const socket = useRef<WebSocket | null>(null);
  const [historyMsgList, setHistoryMsgList] = useState<IMsg[]>([]);
  const [newMsgList, setNewMsgList] = useState<IMsg[]>([]);

  const [inputHeight, setInputHeight] = useState(200);
  const isDraggingRef = useRef(false);

  const handleMouseDown = () => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newHeight = window.innerHeight - e.clientY;
      setInputHeight(Math.min(Math.max(newHeight, 100), 500));
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const connWs = (params: { roomKey: string; senderId: number; type: string }) => {
    const { roomKey, senderId, type } = params;
    const ws = new WebSocket(
      `${import.meta.env.VITE_WS_BASE_URL}/chat/conn?roomKey=${roomKey}&id=${senderId}&type=${type}`,
    );

    ws.onmessage = (ev) => {
      const msgData = JSON.parse(ev.data);
      if (Array.isArray(msgData)) {
        setHistoryMsgList(msgData);
      } else {
        setNewMsgList((oldMsgList) => [...oldMsgList, msgData]);
      }
    };

    ws.onerror = () => toast.error('网络连接失败');
    socket.current = ws;
  };

  const fetchChatList = async () => {
    try {
      const res = await fetchChatListApi();
      if (res.code === BaseState.Ok) {
        setChatList(res.data);
      } else {
        toast.error('获取聊天列表失败');
      }
    } catch (err) {
      console.error(err);
      toast.error('获取聊天列表失败');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchChatListApi();
        if (res.code !== BaseState.Ok) {
          toast.error('获取聊天列表失败');
          return;
        }
        // res.code === BaseState.Ok
        const chatList = res.data;
        setChatList(chatList);
        if (initialChat) {
          const targetIdx = chatList.findIndex((item) => item.roomKey === initialChat.roomKey);
          if (targetIdx > -1) {
            setCurChat(chatList[targetIdx]);
          } else {
            // targetIdx === -1
            const newChat: IChatItem = {
              receiverId: 0,
              name: '',
              roomKey: initialChat.roomKey,
              updatedAt: new Date().toISOString(),
              unreadCnt: 0,
              latestMsg: '消息记录为空',
              mediaType: 'text',
              avatar: initialChat.avatar,
            };
            if (friendOrGroup(initialChat)) {
              newChat.receiverId = initialChat.friendUserId;
              newChat.name = initialChat.noteName;
              newChat.receiverEmail = initialChat.email;
            } else {
              newChat.receiverId = initialChat.id;
              newChat.name = initialChat.name;
            }
            setChatList([newChat, ...chatList]);
            setCurChat(newChat);
          }
          const params = {
            roomKey: initialChat.roomKey,
            senderId: userInfo.id,
            type: friendOrGroup(initialChat) ? 'friend' : 'group',
          };
          connWs(params);
        }
      } catch (err) {
        console.error(err);
        toast.error('获取消息列表失败');
      }
    })();

    return () => {
      socket.current?.close();
    };
  }, []); //! onMounted

  const handleClickChat = (item: IChatItem) => {
    setHistoryMsgList([]);
    setNewMsgList([]);
    setCurChat(item);
    const params = {
      roomKey: item.roomKey,
      senderId: userInfo.id,
      type: friendOrGroup2(item) ? 'friend' : 'group',
    };
    connWs(params);
    fetchChatList();
  };

  useImperativeHandle(ref, () => {
    return { fetchChatList };
  }); // defineExpose

  const doSend = (msg: ISendMsg) => {
    socket.current?.send(JSON.stringify(msg));
    fetchChatList();
  };

  return (
    <>
      <div className="flex h-dvh w-full">
        <div className="bg-theme2 border-theme3 flex w-70 shrink-0 flex-col overflow-auto border-r">
          <div className="p-3">
            <SearchBar />
          </div>
          <div className="flex-1 overflow-auto">
            {chatList.length === 0 ? (
              <Empty className="mt-5" description="暂无聊天" />
            ) : (
              chatList.map((chat) => (
                <div
                  key={chat.roomKey}
                  onClick={() => handleClickChat(chat)}
                  className={`flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-[#d6e8d1] ${
                    curChat?.roomKey === chat.roomKey ? 'bg-[#cce3c5] hover:bg-[#cce3c5]' : ''
                  }`}
                >
                  <ImgContainer
                    src={chat.avatar}
                    className="h-12 w-12 shrink-0 rounded object-cover"
                  />
                  <div className="ml-3 flex flex-1 flex-col justify-center overflow-hidden">
                    <div className="truncate text-base font-medium text-gray-800">{chat.name}</div>
                    <div className="truncate text-sm text-gray-500">
                      {(() => {
                        switch (chat.mediaType) {
                          case 'text':
                            return chat.latestMsg;
                          case 'image':
                            return '[图片]';
                          case 'video':
                            return '[视频]';
                          case 'file':
                            return '[文件]';
                          default:
                            return '';
                        }
                      })()}
                    </div>
                  </div>
                  <div className="ml-2 flex flex-col items-end justify-between self-stretch py-1">
                    <div className="text-xs text-gray-400">{fmtTime4list(chat.updatedAt)}</div>
                    {chat.unreadCnt !== 0 && (
                      <div className="mt-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {chat.unreadCnt > 99 ? '99+' : chat.unreadCnt}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="bg-theme flex flex-1 flex-col overflow-hidden">
          {curChat ? (
            <div className="flex h-dvh flex-col">
              <div className="border-theme3 bg-theme flex h-16 items-center border-b px-6 text-lg font-medium">
                {curChat.name}
              </div>
              <div className="bg-theme flex-1 overflow-auto p-4">
                <ChatMsg historyMsgList={historyMsgList} newMsgList={newMsgList} />
              </div>
              <div
                className="border-theme3 border-t bg-white"
                style={{ height: `${inputHeight}px` }}
              >
                <ChatUtils curChat={curChat} doSend={doSend} onMouseDownResize={handleMouseDown} />
              </div>
            </div>
          ) : (
            <div className="flex h-dvh items-center justify-center">
              <MessageEmoji
                theme="filled"
                size="15rem"
                fill="var(--color-theme5)"
                strokeWidth={3}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Chat;
