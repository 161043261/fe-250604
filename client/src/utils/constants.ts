// 1xxx base
export enum BaseState {
  Ok = 200,
  Err = 400,
  ServerErr = 500,

  TokenErr = 1001, // error or expired
  ParamErr = 1002,
  CreateErr = 1003,
  UpdateErr = 1004,
}

// 2xxx user
export enum UserState {
  EmailOrPassErr = 2001,
  UserLoggedIn = 2002,
  UserRegistered = 2003,
  UserNotRegistered = 2004,
}

// 3xxx friend
export enum FriendState {}

// 4xxx group
export enum GroupState {
  SelfJoined = 4001,
  FriendJoined = 4002,
}

// 5xxx msg

// 6xxx file
export enum FileState {
  FileUploaded = 6001,
  ChunksUploaded = 6002, // pending for merge
}

export const Code2Msg = new Map<number, string>([
  [200, '成功'],
  [400, '失败'],
  [500, '服务器错误'],
  // 1xxx base

  [1001, '令牌错误或过期'],
  [1002, '参数错误'],
  [1003, '创建失败'],
  [1004, '更新失败'],

  // 2xxx user
  [2001, '邮箱或密码错误'],
  [2002, '用户已登录'],
  [2003, '用户已注册'],
  [2004, '用户未注册'],

  // 3xxx friend

  // 4xxx group
  [4001, '你已加入群聊'],
  [4002, '好友已加入群聊'],

  // 5xxx msg

  // 6xxx file
  [6001, '文件重复上传'],
  [6002, '分块全部上传, 等待合并'],
]);
