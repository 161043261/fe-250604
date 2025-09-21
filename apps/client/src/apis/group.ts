import {
  IAddFriends2groupDto,
  IAddSelf2groupDto,
  ICreateGroupDto,
  IFetchGroupListByNameDto,
  IFetchGroupMembersDto,
  IGroupExt,
  IGroupItem,
  IGroupMemberExt,
} from '@/types/group';
import request from '@/utils/request';

export async function addSelf2groupApi(params: IAddSelf2groupDto) {
  const res = await request.post<IAddSelf2groupDto>('/group/add-self', params);
  return res.data;
}

export async function addFriends2groupApi(params: IAddFriends2groupDto) {
  const res = await request.post<IAddFriends2groupDto>('/group/add-friends', params);
  return res.data;
}

export async function createGroupApi(params: ICreateGroupDto) {
  const res = await request.post<ICreateGroupDto>('/group/create', params);
  return res.data;
}

export async function fetchGroupListByNameApi(groupName: string) {
  const res = await request.get<IFetchGroupListByNameDto[]>(`/group/name?name=${groupName}`);
  return res.data;
}

export async function fetchGroupByIdApi(groupId: number) {
  const res = await request.get<IGroupExt>(`group/id?id=${groupId}`);
  return res.data;
}

export async function fetchGroupListApi() {
  const res = await request.get<IGroupItem[]>('group/list');
  return res.data;
}

export async function fetchGroupMembersApi(params: IFetchGroupMembersDto) {
  const res = await request.get<IGroupMemberExt[]>(
    `group/members/?groupId=${params.groupId}&roomKey=${params.roomKey}`,
  );
  return res.data;
}
