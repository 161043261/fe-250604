import request from '@/utils/request';

export async function fetchCallersApi(roomKey: string) {
  const res = await request.get<string[]>(`/rtc/callers?roomKey=${roomKey}`);
  return res.data;
}
