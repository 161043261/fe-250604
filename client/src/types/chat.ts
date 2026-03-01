export interface IMsgItem {
  // messages 表字段
  content: string; // messages 表字段 content, 消息内容
  fileSize: number; // messages 表字段 file_size, 文件大小, 单位 B
  id?: number; // messages 表字段 id, 消息 ID
  mediaType: 'text' | 'image' | 'video' | 'file'; // messages 表字段 media_type, 媒体类型
  receiverId: number; // messages 表字段 receiver_id, 接收者的用户 ID
  roomKey: string; // messages 表字段 room_key, 房间号
  senderId: number; // messages 表字段 sender_id, 发送者的用户 ID
  state: 0 | 1; // messages 表字段 state, 消息状态
  // type: friend | group
  type: 'friend' | 'group'; // messages 表字段 type, 消息类型
  createdAt: string; // messages 表字段 created_at, 创建时间
  updatedAt?: string; // messages 表字段 updated_at, 更新时间
}

export interface IMsg {
  content: string;
  fileSize?: string;
  mediaType: 'text' | 'image' | 'video' | 'file';
  receiverId: number;
  roomKey: string;
  senderId: number;
  createdAt: Date;
  avatar: string;
}

export interface ISendMsg {
  content: string;
  fileSize?: number;
  mediaType: 'text' | 'image' | 'video' | 'file';
  receiverId: number;
  senderId: number;
  avatar: string;
}

export interface IMsgStatItem {
  // msg_stats 表字段
  id?: number; // msg_stats 表字段 id, 消息统计 ID
  roomKey: string; // msg_stats 表字段 room_key, 房间号
  total: number; // msg_stats 表字段 total, 消息总数
  createdAt?: string; // msg_stats 表字段 created_at, 创建时间
  updatedAt?: string; // msg_stats 表字段 updated_at, 更新时间
}

export interface IChatItem {
  receiverId: number; // 接收者的 ID: 好友 ID 或群聊 ID
  name: string; // 好友备注 (friend noteName) 或群聊名 (group name)
  receiverEmail?: string; // 接收者的邮箱: 接收者是好友时有该字段, 接收者是群聊时没有该字段
  roomKey: string; // 房间号
  updatedAt: string; // 更新时间, 即最新消息的发送时间
  unreadCnt: number; // 未读消息数
  latestMsg: string; // 最新消息
  mediaType: 'text' | 'image' | 'video' | 'file'; // 最新消息的类型
  avatar: string; // 好友头像或群聊头像
}

export interface ICallReceiver {
  email: string;
  alias: string; // 好友备注 (friend noteName) 或群昵称 (groupMember nickname)
  avatar: string;
}
