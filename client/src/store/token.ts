/* eslint-disable @typescript-eslint/no-unused-vars */
import { create, StateCreator } from 'zustand';

export interface ITokenState {
  token: string;
  setToken: (token: string) => void;
  clearToken: () => void;
}

export const createAuthTokenStore: StateCreator<ITokenState> = (set) => {
  return {
    token: sessionStorage.getItem('token') ?? '',
    setToken: (token: string) => {
      set((_state: ITokenState) => {
        sessionStorage.setItem('token', token);
        return { token };
      });
    },
    clearToken: () => {
      set((_state: ITokenState) => {
        sessionStorage.clear();
        return { token: '' };
      });
    },
  };
};

const useTokenStore = create<ITokenState>(createAuthTokenStore);

export default useTokenStore;
