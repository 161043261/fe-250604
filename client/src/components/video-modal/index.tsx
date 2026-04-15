import { ICallReceiver } from '@/types/chat';
import { fetchCallersApi } from '@/apis/rtc';
import useToast from '@/hooks/use-toast';
import useUserInfoStore from '@/store/user-info';
import { BaseState } from '@/utils/constants';
import { formatCallTime } from '@/utils/time';
import { Drawer, Empty, Modal } from 'antd';
import { useEffect, useRef, useState } from 'react';
import ImgContainer from '../img-container';
import {
  PhoneCall,
  PhoneMissed,
  VolumeMute,
  VolumeNotice,
  VideoTwo,
  PreviewCloseOne,
  PeopleSpeak,
} from '@icon-park/react';

interface IProps {
  mountModal: boolean;
  setMountModal: (newMountModal: boolean) => void;
  type: 'friend' | 'group';
  roomKey: string;
  callReceiverList: ICallReceiver[];
  state: 'initial' | 'receive' | 'calling';
}

type CallState = 'initial' | 'receive' | 'calling';

interface ICallPeer {
  PC: RTCPeerConnection | null;
  alias: string;
  avatar: string;
}

interface ICallList {
  [email: string]: ICallPeer;
}

interface IRoomMember {
  email: string;
  muted: boolean;
  showVideo: boolean;
}

enum RtcCmd {
  CreateRtcRoom = 'createRtcRoom',
  AddPeer = 'addPeer',
  Offer = 'offer',
  Answer = 'answer',
  IceCandidate = 'iceCandidate',
  Reject = 'reject',
}

const VideoModal: React.FC<IProps> = (props: IProps) => {
  const { mountModal, setMountModal, type, roomKey, callReceiverList, state } = props;
  const toast = useToast();
  const userInfoStore = useUserInfoStore();
  const userEmail = userInfoStore.userInfo.email;

  const [callState, setCallState] = useState<CallState>(state);
  const [duration, setDuration] = useState(0);
  const [callList, setCallList] = useState<ICallList>({});
  const [roomMembers, setRoomMembers] = useState<IRoomMember[]>([]);
  const [curShowVideoCount, setCurShowVideoCount] = useState(0);
  const [showMemberDrawer, setShowMemberDrawer] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const callListRef = useRef<ICallList>({});
  const localStream = useRef<MediaStream | null>(null);
  const socket = useRef<WebSocket | null>(null);

  const stopAllTracks = () => {
    localStream.current?.getTracks().forEach((t) => t.stop());
  };

  const initSocket = () => {
    if (!roomKey || !userEmail || !type) return;
    if (socket.current) {
      if (
        socket.current.readyState === WebSocket.CONNECTING ||
        socket.current.readyState === WebSocket.OPEN
      ) {
        return;
      }
      socket.current.close();
      socket.current = null;
    }

    const ws = new WebSocket(
      `${import.meta.env.VITE_WS_BASE_URL}/rtc/create?roomKey=${roomKey}&email=${userEmail}&type=${type}`,
    );

    ws.onopen = async () => {
      if (callState === 'initial') {
        try {
          await initStream();
          if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(
              JSON.stringify({
                cmd: RtcCmd.CreateRtcRoom,
                mode: type === 'friend' ? 'friendVideo' : 'groupVideo',
                receiverList: callReceiverList,
              }),
            );
          }
        } catch {
          toast.error('获取音视频流失败，请检查设备是否正常或者权限是否已开启');
          if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({ cmd: RtcCmd.Reject }));
          }
          socket.current?.close();
          socket.current = null;
          stopAllTracks();
          setTimeout(() => setMountModal(false), 1500);
        }
      }
    };

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data) as {
        code?: BaseState;
        msg?: string;
        cmd?: RtcCmd;
        sender?: string;
        data?: RTCLocalIceCandidateInit & {
          sdp?: RTCSessionDescriptionInit;
        };
      };

      if (msg.code && msg.code !== BaseState.Ok) {
        toast.error(msg.msg || '音视频聊天失败');
        socket.current?.close();
        socket.current = null;
        stopAllTracks();
        setTimeout(() => setMountModal(false), 1500);
        return;
      }

      switch (msg.cmd) {
        case RtcCmd.AddPeer: {
          setCallState('calling');
          if (type !== 'friend') {
            await fetchRoomMembers();
          }
          const sender = msg.sender ?? '';
          if (callListRef.current[sender]?.PC) {
            localStream.current!.getTracks().forEach((track) => {
              callListRef.current[sender].PC!.addTrack(track, localStream.current!);
            });
            const offerSdp = await callListRef.current[sender].PC!.createOffer();
            await callListRef.current[sender].PC!.setLocalDescription(offerSdp);
            socket.current?.send(
              JSON.stringify({
                cmd: RtcCmd.Offer,
                data: { sdp: offerSdp },
                receiver: sender,
              }),
            );
          }
          break;
        }

        case RtcCmd.Offer: {
          setCallState('calling');
          const sender = msg.sender ?? '';
          if (callListRef.current[sender]?.PC) {
            localStream.current!.getTracks().forEach((track) => {
              callListRef.current[sender].PC!.addTrack(track, localStream.current!);
            });
            await callListRef.current[sender].PC!.setRemoteDescription(
              new RTCSessionDescription(msg.data!.sdp!),
            );
            const answerSdp = await callListRef.current[sender].PC!.createAnswer();
            await callListRef.current[sender].PC!.setLocalDescription(answerSdp);
            socket.current?.send(
              JSON.stringify({
                cmd: RtcCmd.Answer,
                data: { sdp: answerSdp },
                receiver: sender,
              }),
            );
          }
          break;
        }

        case RtcCmd.Answer: {
          const sender = msg.sender ?? '';
          if (callListRef.current[sender]?.PC) {
            await callListRef.current[sender].PC!.setRemoteDescription(
              new RTCSessionDescription(msg.data!.sdp!),
            );
          }
          break;
        }

        case RtcCmd.IceCandidate: {
          const sender = msg.sender ?? '';
          if (callListRef.current[sender]?.PC) {
            await callListRef.current[sender].PC!.addIceCandidate(new RTCIceCandidate(msg.data));
          }
          break;
        }

        case RtcCmd.Reject: {
          const sender = msg.sender ?? '';
          if (type === 'friend') {
            socket.current?.close();
            socket.current = null;
            stopAllTracks();
            setTimeout(() => {
              setMountModal(false);
              toast.info('对方已挂断');
            }, 1500);
          } else {
            await fetchRoomMembers();
            toast.info(`${sender} 已退出群视频通话`);
            const video = document.querySelector(
              `.video_${CSS.escape(sender)}`,
            ) as HTMLVideoElement;
            if (video) video.style.display = 'none';
          }
          break;
        }
      }
    };

    ws.onerror = () => {
      toast.error('WebSocket 连接错误');
    };

    socket.current = ws;
  };

  const initStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.current = stream;
    // 私聊时立即显示自己的视频
    if (type === 'friend') {
      const selfVideo = document.querySelector(`.video_self`) as HTMLVideoElement;
      if (selfVideo) selfVideo.srcObject = stream;
    }
  };

  const initPC = (email: string) => {
    const pc = new RTCPeerConnection();
    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        socket.current?.send(
          JSON.stringify({
            cmd: RtcCmd.IceCandidate,
            data: {
              id: evt.candidate.sdpMid,
              label: evt.candidate.sdpMLineIndex,
              sdpMLineIndex: evt.candidate.sdpMLineIndex,
              candidate: evt.candidate.candidate,
            },
            receiver: email,
          }),
        );
      }
    };
    pc.ontrack = (evt) => {
      if (evt.streams?.[0]) {
        const video = document.querySelector(`.video_${CSS.escape(email)}`) as HTMLVideoElement;
        if (video) video.srcObject = evt.streams[0];
      }
    };

    const receiver = callReceiverList.find((item) => item.email === email);
    callListRef.current[email] = {
      PC: pc,
      alias: receiver?.alias || '',
      avatar: receiver?.avatar || '',
    };
  };

  const handleAcceptCall = async () => {
    setCallState('calling');
    try {
      await initStream();
      socket.current?.send(JSON.stringify({ cmd: RtcCmd.AddPeer }));
      if (type !== 'friend') {
        await fetchRoomMembers();
      }
    } catch {
      toast.error('获取音视频流失败，请检查设备是否正常或者权限是否已开启');
      socket.current?.send(JSON.stringify({ cmd: RtcCmd.Reject }));
      socket.current?.close();
      socket.current = null;
      stopAllTracks();
      setTimeout(() => setMountModal(false), 1500);
    }
  };

  const handleRejectCall = () => {
    if (!socket.current) return;
    socket.current.send(JSON.stringify({ cmd: RtcCmd.Reject }));
    socket.current.close();
    socket.current = null;
    setTimeout(() => {
      setMountModal(false);
      stopAllTracks();
      toast.info(type === 'friend' ? '已挂断通话' : '已退出群视频通话');
    }, 1500);
  };

  const fetchRoomMembers = async () => {
    try {
      const res = await fetchCallersApi(roomKey);
      if (res.code === BaseState.Ok && res.data) {
        setRoomMembers(
          res.data.map((email) => ({
            email,
            muted: roomMembers.find((m) => m.email === email)?.muted || false,
            showVideo: roomMembers.find((m) => m.email === email)?.showVideo ?? true,
          })),
        );
      }
    } catch {
      toast.error('获取房间成员失败');
    }
  };

  const handleMute = (item: IRoomMember) => {
    const video = document.querySelector(`.video_${CSS.escape(item.email)}`) as HTMLVideoElement;
    if (video) video.muted = !video.muted;
    setRoomMembers((prev) =>
      prev.map((m) => (m.email === item.email ? { ...m, muted: !m.muted } : m)),
    );
  };

  const handleToggleVideo = (item: IRoomMember) => {
    if (!item.showVideo && curShowVideoCount >= 6) {
      toast.info('最多显示 6 个视频，请先关闭其他视频');
      return;
    }
    setRoomMembers((prev) =>
      prev.map((m) => (m.email === item.email ? { ...m, showVideo: !m.showVideo } : m)),
    );
  };

  // 更新显示视频人数
  useEffect(() => {
    setCurShowVideoCount(roomMembers.filter((m) => m.showVideo).length);
  }, [roomMembers]);

  // 初始化 WebSocket 和 PC 通道
  useEffect(() => {
    initSocket();
    callReceiverList.forEach((item) => initPC(item.email));

    return () => {
      stopAllTracks();
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.close();
      }
      socket.current = null;
      Object.values(callListRef.current).forEach((peer) => peer.PC?.close());
    };
  }, []);

  // callList 渲染
  useEffect(() => {
    setCallList({ ...callListRef.current });
  }, [callState]);

  // 通话计时 + 渲染自己的视频
  useEffect(() => {
    if (callState === 'calling') {
      if (type === 'friend') {
        const selfVideo = document.querySelector(`.video_self`) as HTMLVideoElement;
        if (selfVideo) selfVideo.srcObject = localStream.current;
      }
      const timer = setInterval(() => setDuration((d) => d + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [callState, type]);

  return (
    <Modal
      open={mountModal}
      footer={null}
      width={type === 'friend' ? 520 : 640}
      title={`${type === 'friend' ? '' : '群'}视频通话`}
      maskClosable={false}
      closable={type !== 'friend'}
      onCancel={async () => {
        if (type !== 'friend') {
          setShowMemberDrawer(!showMemberDrawer);
          if (callState !== 'calling') await fetchRoomMembers();
        }
      }}
      styles={{ body: { minHeight: 360 } }}
    >
      <div className="flex flex-col items-center justify-center">
        {/* 发起 / 接收 状态 — 显示头像 */}
        {callState !== 'calling' && (
          <div className="mb-4 h-20 w-20 overflow-hidden rounded-full">
            {type === 'friend' ? (
              <ImgContainer
                src={callReceiverList[0]?.avatar}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-purple-400 to-pink-400">
                <PeopleSpeak size="2.5rem" fill="#fff" />
              </div>
            )}
          </div>
        )}

        {/* 发起中 */}
        {callState === 'initial' && (
          <>
            <p className="mb-6 text-sm text-gray-600">
              {type === 'friend'
                ? `对 ${callReceiverList[0]?.alias} 发起视频通话`
                : '发起群视频通话'}
            </p>
            <div className="flex gap-8">
              <button
                onClick={handleRejectCall}
                className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
              >
                <PhoneMissed size="1.5rem" />
              </button>
            </div>
          </>
        )}

        {/* 接听中 */}
        {callState === 'receive' && (
          <>
            <p className="mb-6 text-sm text-gray-600">
              {type === 'friend'
                ? `${callReceiverList[0]?.alias} 发起视频通话`
                : '有人邀请您加入群视频通话'}
            </p>
            <div className="flex gap-8">
              <button
                onClick={handleAcceptCall}
                className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition hover:bg-green-600"
              >
                <PhoneCall size="1.5rem" />
              </button>
              <button
                onClick={handleRejectCall}
                className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
              >
                <PhoneMissed size="1.5rem" />
              </button>
            </div>
          </>
        )}

        {/* 通话中 — 视频区域 */}
        {callState === 'calling' && (
          <div
            className="relative flex w-full flex-wrap justify-center gap-2"
            style={{ minHeight: 300 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* 远程视频 */}
            {Object.keys(callList).map((email) => {
              if (email === userEmail) return null;
              const isFriend = type === 'friend';
              const memberInfo = roomMembers.find((m) => m.email === email);
              const shouldHide = !isFriend && memberInfo && !memberInfo.showVideo;
              return (
                <div
                  key={email}
                  className={isFriend ? 'absolute inset-0 z-0' : 'relative m-1 h-35 w-45'}
                  style={shouldHide ? { display: 'none' } : {}}
                >
                  <video
                    className={`video_${CSS.escape(email)} ${isFriend ? 'h-full w-full object-cover' : 'h-full w-full rounded object-cover'}`}
                    autoPlay
                    playsInline
                  />
                  {!isFriend && (
                    <span className="absolute bottom-0 left-0 w-full truncate bg-black/40 text-center text-xs text-white">
                      {callList[email]?.alias || email}
                    </span>
                  )}
                </div>
              );
            })}

            {/* 自己的视频（私聊小窗） */}
            {type === 'friend' && (
              <video
                className="video_self absolute top-2 right-2 z-10 h-30 w-40 rounded object-cover"
                autoPlay
                playsInline
                muted
              />
            )}

            {/* 底部控制栏 */}
            <div
              className="absolute bottom-0 left-0 flex w-full flex-col items-center bg-black/50 py-2 transition-all duration-300"
              style={{
                transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
              }}
            >
              <p className="mb-2 text-sm text-white">{formatCallTime(duration)}</p>
              <button
                onClick={handleRejectCall}
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
              >
                <PhoneMissed size="1.3rem" />
              </button>
            </div>
          </div>
        )}

        {/* 群通话成员抽屉 */}
        {type !== 'friend' && (
          <Drawer
            title="当前正在通话的群成员"
            placement="right"
            closable={false}
            onClose={() => setShowMemberDrawer(false)}
            open={showMemberDrawer}
            getContainer={false}
            width="50%"
            forceRender
          >
            {roomMembers.length ? (
              <ul>
                {roomMembers.map((item) => (
                  <li key={item.email} className="mb-3 flex items-center justify-between text-sm">
                    <span className="mr-auto">{item.email}</span>
                    <span className="ml-2 cursor-pointer" onClick={() => handleMute(item)}>
                      {item.muted ? <VolumeMute size="1.2rem" /> : <VolumeNotice size="1.2rem" />}
                    </span>
                    <span className="ml-2 cursor-pointer" onClick={() => handleToggleVideo(item)}>
                      {item.showVideo ? (
                        <VideoTwo size="1.2rem" />
                      ) : (
                        <PreviewCloseOne size="1.2rem" />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无群友加入通话" />
            )}
          </Drawer>
        )}
      </div>
    </Modal>
  );
};

export default VideoModal;
