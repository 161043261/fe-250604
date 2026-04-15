export interface IGroupItem {
  // groups 表字段
  id: number; // groups 表字段 id, 群聊 ID
  name: string; // groups 表字段 name, 群聊名
  creatorId: number; // groups 表字段 creator_id, 群主的用户 ID
  readme: string; // groups 表字段 readme, 群公告
  roomKey: string; // groups 表字段 room_key, 房间号
  avatar: string; // groups 表字段 avatar, 群聊头像
  unreadCnt: number; // groups 表字段 unread_cnt, 未读消息数
  createdAt: string; // groups 表字段 created_at, 创建时间
  updatedAt?: string; // groups 表字段 updated_at, 更新时间
}

export interface IGroupMemberItem {
  groupId: number; // group_members 表字段 group_id, 群聊 ID
  id?: number; // group_members 表字段 id, 成员 ID
  nickname: string; // group_members 表字段 nickname, 群昵称
  userId: number; // group_members 表字段 user_id, 成员的用户 ID
  createdAt: string; // group_members 表字段 created_at, 创建时间
  updatedAt?: string; // group_members 表字段 updated_at, 更新时间
}

export interface IGroupExt extends IGroupItem {
  // 补充字段
  creatorEmail: string; // 群主的邮箱
  memberList: IGroupMemberExt[];
}

export interface IGroupMemberExt extends Omit<IGroupMemberItem, 'groupId'> {
  avatar: string;
  latestMsgTime?: string;
  email: string;
  username: string;
  // nickname: string;
  // userId: number;
  // createdAt: string;
}

export interface IFetchGroupListByNameDto {
  avatar: string;
  id: number;
  name: string;
  memberNum: number;
  flag: boolean;
}

export interface IAddSelf2groupDto {
  groupId: number;
}

export interface IAddFriends2groupDto {
  groupId: number;
  friendList: {
    userId: number;
    email: string;
    avatar: string;
  }[];
}

export interface ICreateGroupDto {
  groupAvatar: string;
  groupName: string;
  readme: string;
  memberList: {
    userId: number;
    email: string;
    avatar: string;
  }[];
}

export interface IFetchGroupMembersDto {
  groupId: number;
  roomKey: string;
}
