import {
  FriendList,
  IAddFriendDto,
  IFriendDto,
  IFriendExt,
  ITagItem,
  IUpdateFriendDto,
} from '@/types/friend';
import request from '@/utils/request';

export async function fetchFriendListByEmailApi(email: string) {
  const res = await request.get<IFriendDto[]>(`/friend/email?email=${email}`);
  return res.data;
}

export async function addFriendApi(friendDto: IAddFriendDto) {
  const res = await request.post<IAddFriendDto>('/friend/add', friendDto);
  return res.data;
}

export async function fetchFriendListApi() {
  const res = await request.get<FriendList>('/friend/list');
  return res.data;
}

/**
 *
 * @param friendId friend ID
 */
export async function fetchFriendByIdApi(friendId: number) {
  const res = await request.get<IFriendExt>(`friend/id?id=${friendId}`);
  return res.data;
}

export async function fetchTagListApi() {
  const res = await request.get<ITagItem[]>('/friend/tag-list');
  return res.data;
}

export async function addTagApi(tagItem: ITagItem) {
  const res = await request.post<ITagItem>('/friend/add-tag', tagItem);
  return res.data;
}

export async function updateFriendApi(friendDto: IUpdateFriendDto) {
  const res = await request.post<IUpdateFriendDto>('friend/update', friendDto);
  return res.data;
}
