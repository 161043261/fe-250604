import { logoutApi } from '@/apis/user';
import ImgContainer from '@/components/img-container';
import useToast from '@/hooks/use-toast';
import useUserInfoStore from '@/store/user-info';

import type { IChatRef, IContactRef } from '@/types/fc-expose';
import { BaseState } from '@/utils/constants';

import { Button, Popover, Tooltip } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { IconItem, MenuIconKey, MenuIconList } from '@/utils/icons';

import Chat from './chat';
import Contact from './contact';
import PwdModal from '@/components/pwd-modal';
import UserInfoModal from '@/components/user-info-modal';
import AudioModal from '@/components/audio-modal';
import VideoModal from '@/components/video-modal';

import type { IGroupExt } from '@/types/group';
import type { IFriendExt } from '@/types/friend';
import { ICallReceiver } from '@/types/chat';

const Home: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const userInfoStore = useUserInfoStore();
  const userInfo = userInfoStore.userInfo;

  // 当前选中的图标
  const [curIconKey, setCurIconKey] = useState<MenuIconKey>('MessageEmoji');
  // 更新密码的弹窗
  const [mountPwdModal, setMountPwdModal] = useState(false);
  // 更新用户信息的弹窗
  const [mountUserInfoModal, setMountUserInfoModal] = useState(false);
  // 音频聊天弹窗
  const [mountAudioModal, setMountAudioModal] = useState(false);
  // 视频聊天弹窗
  const [mountVideoModal, setMountVideoModal] = useState(false);
  // 当前选中的好友或群聊
  const [curChat, setCurChat] = useState<IFriendExt | IGroupExt | null>(null);
  // 房间号
  const [roomKey, setRoomKey] = useState<string>('');
  // 聊天模式: 音频; 视频; 音视频
  const [rtcMode, setRtcMode] = useState<
    'friendAudio' | 'groupAudio' | 'friendVideo' | 'groupVideo'
  >();
  // 接收者列表
  const [callReceiverList, setCallReceiverList] = useState<ICallReceiver[]>([]);

  // useRef 只会在组件挂载时调用 1 次, 组件重新渲染时, 不会重新调用 useRef
  // websocket 实例
  const webSocket = useRef<WebSocket | null>(null);
  // 通讯录实例
  const contactRef = useRef<IContactRef>(null); // sidebar
  // 聊天窗口实例
  const chatRef = useRef<IChatRef>(null); // main
  // 退出登录
  const logout = async () => {
    try {
      const res = await logoutApi(userInfo);
      if (res.code !== BaseState.Ok) {
        toast.error('退出登录失败');
        return;
      }
      userInfoStore.clearUserInfo();
      toast.success('退出登录成功');
      navigate('/login');
      if (webSocket.current !== null) {
        // 关闭 websocket 连接
        webSocket.current.close();
        webSocket.current = null;
      }
    } catch (err) {
      console.error(err);
      toast.error('退出登录失败');
    }
  };

  const UserInfoContent = (
    <div>
      <div className="flex h-30 w-100 gap-5">
        <ImgContainer src={userInfo.avatar} className="h-30 w-30" />
        <div className="flex h-30 w-65 flex-col justify-between">
          <div className="flex flex-col gap-3">
            <div>{userInfo.username}</div>
            <div className="truncate">
              {userInfo.signature?.length ? userInfo.signature : '这个人很神秘, 没有签名'}
            </div>
          </div>
          <div className="flex justify-between">
            <Button onClick={() => setMountPwdModal(true)}>修改密码</Button>
            <Button onClick={() => setMountUserInfoModal(true)}>修改用户信息</Button>
          </div>
        </div>
      </div>
    </div>
  );

  //! /api/v1/user/pub
  const wsSub = () => {
    const ws = new WebSocket(
      `${import.meta.env.VITE_WS_BASE_URL}/user/pub?email=${userInfo.email}`,
    );
    ws.onmessage = (ev) => {
      const msg: {
        type: 'wsFetchFriendList' | 'wsFetchGroupList' | 'wsFetchChatList' | 'wsCreateRtcRoom';
        receiverList: ICallReceiver[];
        roomKey: string;
        mode?: 'friendAudio' | 'groupAudio' | 'friendVideo' | 'groupVideo';
      } = JSON.parse(ev.data);

      switch (msg.type) {
        case 'wsFetchFriendList':
          console.log('[ws] Fetch friend list');
          // 获取好友列表
          contactRef.current?.fetchFriendList();
          break;
        case 'wsFetchGroupList':
          console.log('[ws] Fetch group list');
          // 获取群聊列表
          contactRef.current?.fetchGroupList();
          break;
        case 'wsFetchChatList':
          console.log('[ws] Fetch chat list');
          // 获取聊天列表
          chatRef.current?.fetchChatList();
          break;
        case 'wsCreateRtcRoom':
          console.log('[ws] Create RTC room');
          // cmd, roomKey, mode, receiverList
          // mode: "friendAudio" | "friendVideo" | "groupAudio" | "groupVideo";
          try {
            const { receiverList, roomKey, mode } = msg;
            setCallReceiverList(receiverList);
            setRtcMode(mode);
            setRoomKey(roomKey);
            if (mode?.toLowerCase().includes('audio')) {
              setMountAudioModal(true);
            }
            if (mode?.toLowerCase().includes('video')) {
              setMountVideoModal(true);
            }
          } catch (err) {
            console.error(err);
            toast.error('音视频聊天失败');
          }
          break;
      }
    };
    webSocket.current = ws;
  };
  useEffect(() => wsSub(), []); //! onMounted

  const handleClickIcon = (item: IconItem) => {
    setCurIconKey(item.key as MenuIconKey);
    switch (item.key) {
      case 'MessageEmoji':
        return navigate('/chat');
      case 'AddressBook':
        return navigate('/contact');
      case 'Power':
        return logout();
    }
  };

  const doChat = (chat: IFriendExt | IGroupExt) => {
    setCurIconKey('MessageEmoji');
    navigate('/chat');
    setCurChat(chat);
  };

  return (
    <div>
      <div className="flex h-dvh w-dvw">
        {/* 左侧 */}
        <div className="bg-theme flex flex-1 flex-col items-center justify-between py-5">
          <ul className="flex w-[100%] flex-col items-center gap-5">
            <li className="w-[100%]">
              <Popover content={UserInfoContent} placement="right">
                <div className="flex items-center justify-center">
                  <ImgContainer src={userInfo.avatar} className="w-[80%] cursor-pointer" />
                </div>
              </Popover>
            </li>
            {MenuIconList.slice(0, 5).map((item) => (
              <li key={item.key}>
                <Tooltip placement="right" title={item.title} arrow={false}>
                  <item.IconInst
                    onClick={() => handleClickIcon(item)}
                    className={`${curIconKey === item.key ? 'text-theme5' : 'text-slate-500'} cursor-pointer text-5xl`}
                  />
                </Tooltip>
              </li>
            ))}
          </ul>

          <ul className="flex flex-col items-center gap-5">
            {MenuIconList.slice(5).map((item) => (
              <li key={item.key}>
                <Tooltip placement="right" title={item.title} arrow={false}>
                  <item.IconInst
                    onClick={() => handleClickIcon(item)}
                    className={`${curIconKey === item.key ? 'text-theme5' : 'text-slate-500'} cursor-pointer text-5xl`}
                  />
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
        {/* 右侧 */}
        <div className="flex-15">
          {
            (() => {
              switch (curIconKey) {
                case 'MessageEmoji':
                  return <Chat ref={chatRef} initialChat={curChat} />;
                case 'AddressBook':
                  return <Contact ref={contactRef} doChat={doChat} />;
              }
            })() /** IIFE */
          }
        </div>
      </div>
      {mountPwdModal && <PwdModal mountModal={mountPwdModal} setMountModal={setMountPwdModal} />}
      {mountUserInfoModal && (
        <UserInfoModal mountModal={mountUserInfoModal} setMountModal={setMountUserInfoModal} />
      )}
      {mountAudioModal && (
        <AudioModal
          state="receive"
          mountModal={mountAudioModal}
          setMountModal={setMountAudioModal}
          type={rtcMode?.includes('friends') ? 'friend' : 'group'}
          roomKey={roomKey}
          callReceiverList={callReceiverList}
        />
      )}
      {mountVideoModal && (
        <VideoModal
          state="receive"
          mountModal={mountVideoModal}
          setMountModal={setMountVideoModal}
          type={rtcMode?.includes('friends') ? 'friend' : 'group'}
          roomKey={roomKey}
          callReceiverList={callReceiverList}
        />
      )}
    </div>
  );
};

export default Home;
