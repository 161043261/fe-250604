import { ICallReceiver } from '@/types/chat';

interface IProps {
  mountModal: boolean;
  setMountModal: (newMountModal: boolean) => void;
  type: 'friend' | 'group';
  roomKey: string;
  callReceiverList: ICallReceiver[];
  state: 'initial' | 'receive' | 'calling';
}

const VideoModal: React.FC<IProps> = (props: IProps) => {
  console.log(props);
  return (
    <div>
      <div>VideoModal</div>
    </div>
  );
};

export default VideoModal;
