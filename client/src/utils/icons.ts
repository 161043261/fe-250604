import {
  AddressBook,
  FileCode,
  FriendsCircle,
  Iphone,
  MessageEmoji,
  PhoneTelephone,
  PictureAlbum,
  Power,
  VideoOne,
  WeixinFavorites,
  WeixinMiniApp,
  WinkingFace,
} from '@icon-park/react';
import type { Icon } from '@icon-park/react/lib/runtime';

export type MenuIconKey =
  | 'MessageEmoji'
  | 'AddressBook'
  | 'WeixinFavorites'
  | 'FileCode'
  | 'FriendsCircle'
  | 'WeixinMiniApp'
  | 'Iphone'
  | 'Power';

export type MsgIconKey =
  | 'WinkingFace' // 表情
  | 'PictureAlbum' // 图片或视频
  | 'FileCode' // 文件
  | 'PhoneTelephone' // 语音聊天
  | 'VideoOne'; // 视频聊天

export interface IconItem {
  key: string;
  title: string;
  IconInst: Icon;
}

export const MenuIconList: IconItem[] = [
  {
    key: 'MessageEmoji', // 不要修改
    title: '聊天',
    IconInst: MessageEmoji,
  },

  {
    key: 'AddressBook',
    title: '通讯录', // 不要修改
    IconInst: AddressBook,
  },
  {
    key: 'WeixinFavorites',
    title: '收藏',
    IconInst: WeixinFavorites,
  },
  {
    key: 'FileCode',
    title: '聊天文件',
    IconInst: FileCode,
  },
  {
    key: 'FriendsCircle',
    title: '朋友圈',
    IconInst: FriendsCircle,
  },
  {
    key: 'WeixinMiniApp',
    title: '小程序',
    IconInst: WeixinMiniApp,
  },
  {
    key: 'Iphone',
    title: '手机',
    IconInst: Iphone,
  },
  {
    key: 'Power',
    title: '退出登录',
    IconInst: Power,
  },
];

export const MsgIconList: IconItem[] = [
  {
    key: 'WinkingFace',
    title: '表情',
    IconInst: WinkingFace,
  },
  {
    key: 'PictureAlbum',
    title: '图片/视频',
    IconInst: PictureAlbum,
  },
  {
    key: 'FileCode',
    title: '文件',
    IconInst: FileCode,
  },
  {
    key: 'PhoneTelephone',
    title: '语音聊天',
    IconInst: PhoneTelephone,
  },
  {
    key: 'VideoOne',
    title: '视频聊天',
    IconInst: VideoOne,
  },
];
