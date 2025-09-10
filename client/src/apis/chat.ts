import { IChatItem } from '@/types/chat';
import request from '@/utils/request';

export async function fetchChatListApi() {
  const res = await request.get<IChatItem[]>('chat/list');
  return res.data;
}
