import {
  ILoginParams,
  ILoginRes,
  IRegisterParams,
  IRegisterRes,
  IUpdatePwdParams,
  IUpdateUserInfoParams,
  IUserInfo,
} from '@/types/user';
import request from '@/utils/request';

export async function loginApi(params: ILoginParams) {
  const res = await request.post<ILoginParams, ILoginRes>('/user/login', params);
  return res.data;
}

export async function registerApi(params: IRegisterParams) {
  const res = await request.post<IRegisterParams, IRegisterRes>('/user/register', params);
  return res.data;
}

export async function logoutApi(params: IUserInfo) {
  const res = await request.post<IUserInfo>('/user/logout', params);
  return res.data;
}

export async function updatePwdApi(params: IUpdatePwdParams) {
  const res = await request.post<IUpdatePwdParams>('/user/update-pwd', params);
  return res.data;
}

export async function updateUserInfoApi(params: IUpdateUserInfoParams) {
  const res = await request.post<IUpdateUserInfoParams, ILoginRes>('/user/update-info', params);
  return res.data;
}
