export interface IUserInfo {
  // users 表字段
  id: number; // users 表字段 id, 用户 ID
  email: string; // users 表字段 email, 用户邮箱
  password: string; // users 表字段 password, 用户密码
  avatar: string; // users 表字段 avatar, 用户头像
  username: string; // users 表字段 username, 用户名
  signature?: string; // users 表字段 signature, 签名
  createdAt?: string; // users 表字段 created_at, 创建时间
  updatedAt?: string; // users 表字段 updated_at, 更新时间
}

export interface ILoginParams {
  email: string;
  password: string;
}

export interface ILoginRes {
  token: string;
  userInfo: IUserInfo;
}

export interface IRegisterParams {
  email: string;
  password: string;
  avatar: string; // random
}

export interface IRegisterRes {
  token: string;
  userInfo: {
    //! id, email, password, username, avatar, signature
    id: number;
    email: string;
    username: string;
    avatar: string;
    signature: string;
  };
}

export interface IUpdatePwdParams {
  email: string;
  password: string;
}

export interface IUpdateUserInfoParams {
  email: string;
  avatar: string;
  signature: string;
  username: string;
}
