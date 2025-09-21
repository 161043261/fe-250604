import { IUserInfo } from '@/types/user';
import { create, StateCreator } from 'zustand';

const emptyUserInfo: IUserInfo = {
  id: 0,
  email: '',
  password: '',
  avatar: '',
  username: '',
  signature: '',
};

export interface IUserInfoState {
  userInfo: IUserInfo;
  setUserInfo: (userInfo: IUserInfo) => void;
  clearUserInfo: () => void;
}

export const createUserInfoStore: StateCreator<IUserInfoState> = (set) => {
  const userInfo = {
    ...emptyUserInfo,
    ...JSON.parse(sessionStorage.getItem('userInfo') ?? '{}'),
  };
  return {
    userInfo,
    setUserInfo: (userInfo_: IUserInfo) => {
      set((state: IUserInfoState) => {
        const newUserInfo = { ...state.userInfo, ...userInfo_ };
        sessionStorage.setItem('userInfo', JSON.stringify(newUserInfo));
        return { userInfo: newUserInfo };
      });
    },
    clearUserInfo: () => {
      sessionStorage.clear();
      set((/** state: IUserInfoState */) => {
        // state.userInfo = emptyUserInfo;
        return { userInfo: emptyUserInfo };
      });
    },
  };
};

const useUserInfoStore = create<IUserInfoState>(createUserInfoStore);

export default useUserInfoStore;
