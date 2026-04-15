import { ICallReceiver } from '@/types/chat';
import { fetchCallersApi } from '@/apis/rtc';
import useToast from '@/hooks/use-toast';
import useUserInfoStore from '@/store/user-info';
import { BaseState } from '@/utils/constants';
import { formatCallTime } from '@/utils/time';
import { Drawer, Empty, Modal } from 'antd';
import { useEffect, useRef, useState } from 'react';
import ImgContainer from '../img-container';
import { PhoneCall, PhoneMissed, VolumeMute, VolumeNotice, PeopleSpeak } from '@icon-park/react';

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
}

enum RtcCmd {
  CreateRtcRoom = 'createRtcRoom',
  AddPeer = 'addPeer',
  Offer = 'offer',
  Answer = 'answer',
  IceCandidate = 'iceCandidate',
  Reject = 'reject',
}

const AudioModal: React.FC<IProps> = (props: IProps) => {
  const { mountModal, setMountModal, type, roomKey, callReceiverList, state } = props;
  const toast = useToast();
  const userInfoStore = useUserInfoStore();
  const userEmail = userInfoStore.userInfo.email;

  const [callState, setCallState] = useState<CallState>(state);
  const [duration, setDuration] = useState(0);
  const [callList, setCallList] = useState<ICallList>({});
  const callListRef = useRef<ICallList>({});
  const [roomMembers, setRoomMembers] = useState<IRoomMember[]>([]);
  const [showMemberDrawer, setShowMemberDrawer] = useState(false);
  const localStream = useRef<MediaStream | null>(null);
  const socket = useRef<WebSocket | null>(null);

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
                mode: type === 'friend' ? 'friendAudio' : 'groupAudio',
                receiverList: callReceiverList,
              }),
            );
          }
        } catch {
          toast.error('获取音频流失败，请检查设备是否正常或者权限是否已开启');
          if (socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({ cmd: RtcCmd.Reject }));
          }
          socket.current?.close();
          socket.current = null;
          localStream.current?.getAudioTracks().forEach((t) => t.stop());
          setTimeout(() => setMountModal(false), 1500);
        }
      }
    };

    ws.onmessage = async (ev) => {
      // TODO: zod
      const msg = JSON.parse(ev.data) as {
        code?: BaseState;
        msg?: string;
        cmd?: RtcCmd;
        sender?: string;
        data?: RTCLocalIceCandidateInit & {
          sdp?: RTCSessionDescriptionInit;
        };
      };

      // 服务端返回的错误
      if (msg.code && msg.code !== BaseState.Ok) {
        toast.error(msg.msg || '音视频聊天失败');
        socket.current?.close();
        socket.current = null;
        localStream.current?.getAudioTracks().forEach((t) => t.stop());
        setTimeout(() => setMountModal(false), 1500);
        return;
      }

      switch (msg.cmd) {
        case RtcCmd.AddPeer: {
          setCallState('calling');
          if (type !== 'friend') {
            await fetchRoomMembers();
          }
          // 给新人发 offer
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
            await callListRef.current[sender].PC!.addIceCandidate(new RTCIceCandidate(msg.data!));
          }
          break;
        }

        case RtcCmd.Reject: {
          const sender = msg.sender ?? '';
          if (type === 'friend') {
            socket.current?.close();
            socket.current = null;
            localStream.current?.getAudioTracks().forEach((t) => t.stop());
            setTimeout(() => {
              setMountModal(false);
              toast.info('对方已挂断');
            }, 1500);
          } else {
            await fetchRoomMembers();
            toast.info(`${sender} 已退出群语音通话`);
            const audio = document.querySelector(
              `.audio_${CSS.escape(sender)}`,
            ) as HTMLAudioElement;
            if (audio) audio.style.display = 'none';
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
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    localStream.current = stream;
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
        const audio = document.querySelector(`.audio_${CSS.escape(email)}`) as HTMLAudioElement;
        if (audio) audio.srcObject = evt.streams[0];
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
      toast.error('获取音频流失败，请检查设备是否正常或者权限是否已开启');
      socket.current?.send(JSON.stringify({ cmd: RtcCmd.Reject }));
      socket.current?.close();
      socket.current = null;
      localStream.current?.getAudioTracks().forEach((t) => t.stop());
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
      localStream.current?.getAudioTracks().forEach((t) => t.stop());
      toast.info(type === 'friend' ? '已挂断通话' : '已退出群语音通话');
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
          })),
        );
      }
    } catch {
      toast.error('获取房间成员失败');
    }
  };

  const handleMute = (item: IRoomMember) => {
    const audio = document.querySelector(`.audio_${CSS.escape(item.email)}`) as HTMLAudioElement;
    if (audio) audio.muted = !audio.muted;
    setRoomMembers((prev) =>
      prev.map((m) => (m.email === item.email ? { ...m, muted: !m.muted } : m)),
    );
  };

  // 初始化 WebSocket 和 PC 通道
  useEffect(() => {
    initSocket();
    callReceiverList.forEach((item) => initPC(item.email));

    return () => {
      localStream.current?.getAudioTracks().forEach((t) => t.stop());
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

  // 通话计时
  useEffect(() => {
    if (callState === 'calling') {
      const timer = setInterval(() => setDuration((d) => d + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [callState]);

  return (
    <Modal
      open={mountModal}
      footer={null}
      width={400}
      title={`${type === 'friend' ? '' : '群'}语音通话`}
      maskClosable={false}
      closable={type !== 'friend'}
      onCancel={async () => {
        if (type !== 'friend') {
          setShowMemberDrawer(!showMemberDrawer);
          if (callState !== 'calling') await fetchRoomMembers();
        }
      }}
    >
      <div className="flex flex-col items-center justify-center py-8">
        {/* 头像 */}
        <div className="mb-4 h-20 w-20 overflow-hidden rounded-full">
          {type === 'friend' ? (
            <ImgContainer
              src={callReceiverList[0]?.avatar}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="from-theme4 to-theme6 flex h-full w-full items-center justify-center rounded-full bg-linear-to-br">
              <PeopleSpeak size="2.5rem" fill="#fff" />
            </div>
          )}
        </div>

        {/* 发起中 */}
        {callState === 'initial' && (
          <>
            <p className="mb-6 text-sm text-gray-600">
              {type === 'friend'
                ? `对 ${callReceiverList[0]?.alias} 发起语音通话`
                : '发起群语音通话'}
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
                ? `${callReceiverList[0]?.alias} 发起语音通话`
                : '有人邀请您加入群语音通话'}
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

        {/* 通话中 */}
        {callState === 'calling' && (
          <>
            {/* 隐藏的 audio 元素 */}
            {Object.keys(callList).map((email) => {
              if (email === userEmail) return null;
              return (
                <audio
                  key={email}
                  className={`audio_${CSS.escape(email)}`}
                  autoPlay
                  style={{ display: 'none' }}
                />
              );
            })}
            <p className="text-theme8 mb-6 text-lg font-medium">{formatCallTime(duration)}</p>
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
                    <span>{item.email}</span>
                    <span className="cursor-pointer" onClick={() => handleMute(item)}>
                      {item.muted ? <VolumeMute size="1.2rem" /> : <VolumeNotice size="1.2rem" />}
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

export default AudioModal;
