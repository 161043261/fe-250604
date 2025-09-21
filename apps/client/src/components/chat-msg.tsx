import { IMsg } from '@/types/chat';
import { fmtTime4chat } from '@/utils/fmt';
import { useEffect, useMemo, useRef } from 'react';
import MsgBubble from './msg-bubble';

interface IProps {
  historyMsgList: IMsg[];
  newMsgList: IMsg[];
}

const ChatMsg: React.FC<IProps> = (props: IProps) => {
  const { historyMsgList, newMsgList } = props;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  let prevTime: string | null = null;

  useEffect(() => {
    // 滚动到底部
    wrapperRef.current!.scrollTop = wrapperRef.current!.scrollHeight;
  }, [historyMsgList, newMsgList]);

  // perf: 历史消息不必重新渲染
  // todo 虚拟滚动列表
  const HistoryMsgContainer = useMemo(() => {
    if (!historyMsgList || historyMsgList.length === 0) {
      return;
    }
    return historyMsgList.map((item, idx) => {
      const curTime = fmtTime4chat(item.createdAt);
      const isTimeDisplay = curTime !== prevTime;
      prevTime = curTime;
      return (
        <div key={idx}>
          <MsgBubble isTimeDisplay={isTimeDisplay} msg={item} />
        </div>
      );
    });
  }, [historyMsgList]);

  const NewMsgContainer = useMemo(() => {
    if (!newMsgList || newMsgList.length === 0) {
      return;
    }
    return newMsgList.map((item, idx) => {
      const curTime = fmtTime4chat(item.createdAt);
      const isTimeDisplay = curTime !== prevTime;
      prevTime = curTime;
      return (
        <div key={idx}>
          <MsgBubble isTimeDisplay={isTimeDisplay} msg={item} />
        </div>
      );
    });
  }, [newMsgList]);

  return (
    <div ref={wrapperRef}>
      {HistoryMsgContainer}
      {NewMsgContainer}
    </div>
  );
};

export default ChatMsg;
