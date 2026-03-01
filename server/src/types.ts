import type { Context, Next } from "koa";
import type { WebSocket } from "ws";

// User info stored in JWT token
export interface UserInfo {
  id: number;
  email: string;
  password: string;
  username: string;
  avatar: string;
  signature: string;
}

// Extended Koa context with user info
export interface AppContext extends Context {
  userInfo?: UserInfo;
}

// Middleware type
export type Middleware = (ctx: AppContext, next: Next) => Promise<void>;

// Online user entry
export interface OnlineUserEntry {
  ws: WebSocket;
  state: boolean; // whether user is in audio/video chat
}

// Global state types
export interface OnlineUsers {
  [email: string]: OnlineUserEntry;
}

export interface ChatRooms {
  [roomKey: string]: { [receiverId: string]: WebSocket };
}

export interface RtcRooms {
  [roomKey: string]: { [email: string]: WebSocket };
}

// Database record types
export interface UserRecord {
  id: number;
  email: string;
  password: string;
  username: string | null;
  avatar: string | null;
  signature: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FriendRecord {
  id: number;
  user_id: number;
  email: string;
  avatar: string | null;
  note_name: string | null;
  tag_id: number | null;
  state: "online" | "offline";
  unread_cnt: number;
  room_key: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TagRecord {
  id: number;
  user_id: number;
  user_email: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface GroupRecord {
  id: number;
  name: string;
  creator_id: number;
  room_key: string;
  avatar: string | null;
  readme: string | null;
  unread_cnt: number;
  created_at: Date;
  updated_at: Date;
}

export interface GroupMemberRecord {
  id: number;
  nickname: string;
  group_id: number;
  user_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRecord {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  room_key: string;
  type: "friend" | "group";
  media_type: "text" | "image" | "video" | "file";
  file_size: number;
  state: number;
  created_at: Date;
}

export interface MsgStatRecord {
  id: number;
  room_key: string;
  total: number;
  created_at: Date;
  updated_at: Date;
}

// API response types
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  msg: string;
}

// Pub message types
export type PubMessageType =
  | "wsFetchFriendList"
  | "wsFetchGroupList"
  | "wsFetchChatList"
  | "wsCreateRtcRoom";

export interface PubData {
  receiverId?: number;
  receiverEmail?: string;
  type: PubMessageType;
}

// RTC types
export type RtcMode = "friendAudio" | "friendVideo" | "groupAudio" | "groupVideo";

export interface RtcMessage {
  cmd: "createRtcRoom" | "addPeer" | "offer" | "answer" | "iceCandidate" | "reject";
  mode?: RtcMode;
  data?: unknown;
  receiver?: string;
  receiverList?: Array<{ email: string; avatar?: string; alias?: string }>;
  roomKey?: string;
  sender?: string;
}

// Chat message types
export interface ChatMessage {
  senderId: number;
  receiverId: number;
  content: string;
  roomKey: string;
  avatar?: string;
  mediaType: "text" | "image" | "video" | "file";
  fileSize?: number | string;
  createdAt?: string;
  nickname?: string;
}

// File upload types
export interface VerifyFileRequest {
  fileHash: string;
  chunkCnt: number;
  extName: string;
}

export interface UploadChunkRequest {
  fileHash: string;
  chunkIdx: string;
  extName: string;
}

export interface MergeChunksRequest {
  fileHash: string;
  extName: string;
}

// Friend types
export interface FriendInfo {
  friendId: number;
  friendUserId: number;
  state: "online" | "offline";
  noteName: string;
  tagId: number;
  roomKey: string;
  unreadCnt: number;
  tagName: string;
  email: string;
  avatar: string;
  username: string;
  signature: string;
}

export interface TaggedFriends {
  tagName: string;
  onlineCnt: number;
  friends: FriendInfo[];
}

// Group types
export interface GroupInfo {
  id: number;
  name: string;
  creatorId: number;
  creatorEmail: string;
  avatar: string;
  readme: string;
  roomKey: string;
  createdAt: string;
  memberList: GroupMemberInfo[];
}

export interface GroupMemberInfo {
  userId: number;
  avatar: string;
  email: string;
  username: string;
  nickname: string;
  createdAt: string;
  latestMsgTime?: string;
}

// Chat list types
export interface ChatListItem {
  receiverId: number;
  name: string;
  receiverEmail?: string;
  roomKey: string;
  updatedAt: string;
  unreadCnt: number;
  latestMsg: string;
  mediaType: "text" | "image" | "video" | "file";
  avatar: string;
}

declare global {
  var __online_users__: OnlineUsers;
  var __chat_rooms__: ChatRooms;
  var __rtc_rooms__: RtcRooms;
}
