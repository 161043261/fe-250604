// 某标签下的全部好友
export interface ITaggedFriends {
  tagName: string;
  onlineCnt: number;
  friends: IFriendItem[];
}

export type TaggedFriendsList = ITaggedFriends[];
export type FriendList = TaggedFriendsList;

//! id, state, tag_id, room_key, unread_cnt, email, avatar,
//! friend_id, friend_user_id, tag_name, username, signature
export interface IFriendItem {
  // friends 表字段
  id: number; // friends 表字段 id, 好友 ID
  avatar: string; // friends 表字段 avatar, 好友头像
  email: string; // friends 表字段 email, 好友邮箱
  noteName: string; // friends 表字段 note_name, 好友备注
  state: 'online' | 'offline'; // friends 表字段 state, 好友状态
  tagId: number; // friends 表字段 tag_id, 好友的标签 ID
  unreadCnt: number; // friends 表字段 unread_cnt, 未读消息数
  userId: number; // friends 表字段 user_id, 所属用户 ID
  roomKey: string; // friends 表字段 room_key, 房间号
  createdAt?: string; // friends 表字段 created_at, 创建时间
  updatedAt?: string; // friends 表字段 updated_at, 更新时间
}

export interface IFriendExt extends IFriendItem {
  // 补充属性
  friendId: number; // 同 IFriendItem.id
  friendUserId: number;
  username: string; // 好友的用户名
  signature: string; // 好友的签名
  flag: boolean;
}

export interface ITagItem {
  // tag 表字段
  id?: number; // tags 表字段 id, 标签 ID
  name: string; // tags 表字段 name, 标签名
  userId: number; // tags 表字段 user_id, 所属用户 ID
  userEmail: string; // tags 表字段 user_email, 所属用户邮箱
  createdAt?: string; // tags 表字段 created_at, 创建时间
  updatedAt?: string; // tags 表字段 updated_at, 更新时间
}

export interface IFriendDto {
  email: string;
  username: string;
  id: number;
  avatar: string;
  flag: boolean;
}

export interface IAddFriendDto {
  id: number;
  email: string;
  avatar: string;
}

export interface IUpdateFriendDto {
  friendId: number;
  noteName: string;
  tagId: number;
}
