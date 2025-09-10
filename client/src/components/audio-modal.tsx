import { ICallReceiver } from '@/types/chat';

interface IProps {
  mountModal: boolean;
  setMountModal: (newMountModal: boolean) => void;
  type: 'friend' | 'group';
  roomKey: string;
  callReceiverList: ICallReceiver[];
  state: 'initial' | 'receive' | 'calling';
}

const AudioModal: React.FC<IProps> = (props: IProps) => {
  console.log(props);
  return (
    <div>
      <div>AudioModal</div>
    </div>
  );
};

export default AudioModal;
