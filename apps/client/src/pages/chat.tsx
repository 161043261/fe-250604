import { fetchChatListApi } from '@/apis/chat';
import ChatMsg from '@/components/chat-msg';
import ChatUtil from '@/components/chat-util';
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
import { Empty, Tooltip } from 'antd';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface IChatRef {
  fetchChatList: () => void; // 刷新消息列表
}

interface IProps {
  ref: React.Ref<IChatRef>;
  initialChat: IFriendExt | IGroupExt | null;
}

const friendOrGroup = (item: IFriendExt | IGroupExt) => Boolean((item as IFriendExt).friendId);
const friendOrGroup2 = (item: IChatItem) => Boolean(item.receiverEmail);

const Chat: React.FC<IProps> = ({ ref, initialChat }: IProps /** props */) => {
  const toast = useToast();
  const userInfoStore = useUserInfoStore();
  const userInfo = userInfoStore.userInfo;
  const [chatList, setChatList] = useState<IChatItem[]>([]);
  const [curChat, setCurChat] = useState<IChatItem>();
  const socket = useRef<WebSocket | null>(null);
  const [historyMsgList, setHistoryMsgList] = useState<IMsg[]>([]);
  const [newMsgList, setNewMsgList] = useState<IMsg[]>([]);

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
              newChat.receiverId = (initialChat as IFriendExt).friendUserId;
              newChat.name = (initialChat as IFriendExt).noteName;
              newChat.receiverEmail = (initialChat as IFriendExt).email;
            } else {
              newChat.receiverId = (initialChat as IGroupExt).id;
              newChat.name = (initialChat as IGroupExt).name;
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
      <div className="flex h-dvh">
        <div className="flex-1 overflow-auto bg-blue-200 p-3">
          <SearchBar />
          <div>
            {chatList.length === 0 ? (
              <Empty className="mt-5" />
            ) : (
              chatList.map((chat) => (
                <div
                  key={chat.roomKey}
                  onClick={() => handleClickChat(chat)}
                  className="flex items-center justify-between"
                >
                  <ImgContainer src={chat.avatar} className="h-20" />
                  <div>
                    <div>{chat.name}</div>
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
                      }
                    })()}
                  </div>
                  <div>
                    <Tooltip
                      placement="bottomLeft"
                      title={fmtTime4list(chat.updatedAt)}
                      arrow={false}
                    >
                      <div>{fmtTime4list(chat.updatedAt)}</div>
                    </Tooltip>
                    {chat.unreadCnt !== 0 && (
                      <Tooltip
                        placement="bottomLeft"
                        title={`${chat.unreadCnt}条未读消息`}
                        arrow={false}
                      >
                        <div>{chat.unreadCnt}</div>
                      </Tooltip>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex-3">
          {curChat ? (
            <div className="flex h-dvh flex-col">
              <div className="flex-1">{curChat.name}</div>
              <div className="flex-4">
                <ChatMsg historyMsgList={historyMsgList} newMsgList={newMsgList} />
              </div>
              <div className="flex-2">
                <ChatUtil curChat={curChat} doSend={doSend} />
              </div>
            </div>
          ) : (
            <div className="flex h-dvh items-center justify-center">
              <MessageEmoji theme="filled" size="15rem" fill="#4a90e2" strokeWidth={3} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Chat;
