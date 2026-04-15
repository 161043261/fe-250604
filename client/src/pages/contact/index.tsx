import SearchBar from '@/components/search-bar';
import useToast from '@/hooks/use-toast';
import useUserInfoStore from '@/store/user-info';
import type { IFriendExt, ITaggedFriends } from '@/types/friend';
import type { IGroupExt, IGroupItem } from '@/types/group';
import type { ITagItem } from '@/types/friend';
import { Button, Empty, Form, Input, Modal, Select, Tabs, TabsProps, Tooltip } from 'antd';
import { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import ImgContainer from '@/components/img-container';
import {
  addTagApi,
  fetchFriendByIdApi,
  fetchFriendListApi,
  fetchTagListApi,
  updateFriendApi,
} from '@/apis/friend';
import { BaseState } from '@/utils/constants';
import type { DirectoryTreeProps } from 'antd/es/tree';
import { fetchGroupByIdApi, fetchGroupListApi } from '@/apis/group';
import DirectoryTree from 'antd/es/tree/DirectoryTree';
import { MessageEmoji } from '@icon-park/react';
import CreateGroupModal from '@/components/create-group-modal';
import styles from './index.module.scss';

export interface IContactRef {
  fetchFriendList: () => void; // 获取好友列表
  fetchGroupList: () => void; // 获取群聊列表
}

interface IProps {
  ref: React.Ref<IContactRef>;
  doChat: (chat: IFriendExt | IGroupExt) => void;
}

const Contact: React.FC<IProps> = ({ ref, doChat }: IProps /** props */) => {
  const userInfoStore = useUserInfoStore();
  const userInfo = userInfoStore.userInfo;
  const toast = useToast();

  // 当前标签页类型: 好友或群聊
  const [curTab, setCurTab] = useState<string>('friend');
  // 好友列表
  const [friendList, setFriendList] = useState<ITaggedFriends /** 某标签下的全部好友 */[]>([]);
  // 当前选中的好友
  const [curFriend, setCurFriend] = useState<IFriendExt | null>(null);
  // 标签列表
  const [tagList, setTagList] = useState<ITagItem[]>([]);
  // 好友表单实例
  const [friendFormInst] = Form.useForm<{
    email: string;
    username: string;
    noteName: string;
    tagId: number;
  }>();
  const [addTagFormInst] = Form.useForm<{ tagName: string }>();

  // 新建标签的弹窗挂载/卸载
  const [mountAddTagModal, setMountAddTagModal] = useState(false);
  // 新建标签名
  const [newTagName, setNewTagName] = useState('');
  // 群聊列表
  const [groupList, setGroupList] = useState<IGroupItem[]>([]);
  // 当前选中的群聊
  const [curGroup, setCurGroup] = useState<IGroupExt | null>(null);
  // 创建群聊的弹窗挂载/卸载
  const [mountCreateGroupModal, setMountCreateGroupModal] = useState(false);

  // Tree 组件的数据
  const treeData = friendList.map((taggedFriends) => {
    return {
      key: taggedFriends.tagName,
      title: (
        <div className="flex items-center justify-between py-1 font-medium text-gray-700">
          <div>{taggedFriends.tagName}</div>
          <div className="text-xs text-gray-400">
            {taggedFriends.onlineCnt} / {taggedFriends.friends.length}
          </div>
        </div>
      ),
      selectable: false,
      children: taggedFriends.friends.map((friend) => ({
        key: friend.id, // number
        title: (
          <div className="group flex items-center justify-between rounded px-2 py-1 transition-colors">
            <div className="flex items-center gap-3">
              <ImgContainer
                src={friend.avatar}
                className="h-10 w-10 shrink-0 rounded object-cover"
              />
              <div className="text-gray-800">{friend.noteName}</div>
            </div>
            <div
              className={`text-xs ${friend.state === 'online' ? 'text-theme5' : 'text-gray-400'}`}
            >
              {friend.state === 'online' ? '在线' : '离线'}
            </div>
          </div>
        ),
        isLeaf: true,
      })),
    };
  });

  /**
   *
   * @param keyId friend.id
   */
  const _fetchFriendById = useCallback(
    async (keyId: number) => {
      try {
        const res = await fetchFriendByIdApi(keyId);
        if (res.code === BaseState.Ok && res.data) {
          setCurFriend(res.data);
          friendFormInst.setFieldsValue({
            email: res.data.email,
            username: res.data.username,
            noteName: res.data.noteName,
            tagId: res.data.tagId,
          });
        } else {
          toast.error('获取好友详情失败');
        }
      } catch (err) {
        console.error(err);
        toast.error('获取好友详情失败');
      }
    },
    [toast, friendFormInst],
  );

  const handleSelectFriend: DirectoryTreeProps['onSelect'] = useCallback(
    (_selectedKeys, info) => {
      _fetchFriendById(Number(info.node.key) /** friend.id */);
    },
    [_fetchFriendById],
  );

  const _fetchGroupById = useCallback(
    async (groupId: number) => {
      try {
        const res = await fetchGroupByIdApi(groupId);
        if (res.code === BaseState.Ok) {
          setCurGroup(res.data);
        } else {
          toast.error('获取群聊详情失败');
        }
      } catch (err) {
        console.error(err);
        toast.error('获取群聊详情失败');
      }
    },
    [toast],
  );

  const handleClickGroup = useCallback(
    async (item: IGroupItem) => {
      _fetchGroupById(item.id);
    },
    [_fetchGroupById],
  );

  // 获取好友列表, 暴露
  const fetchFriendList = useCallback(async () => {
    try {
      const [res] =
        curFriend && curFriend.id
          ? await Promise.all([fetchFriendListApi(), _fetchFriendById(curFriend.id)])
          : [await fetchFriendListApi()];
      if (res.code === BaseState.Ok && res.data) {
        setFriendList(res.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('获取好友列表失败');
    }
  }, [_fetchFriendById, curFriend, toast]);

  // 获取标签列表
  const _fetchTagList = async () => {
    try {
      const res = await fetchTagListApi();
      if (res.code === BaseState.Ok && res.data) {
        setTagList(res.data);
      } else {
        toast.error('获取标签列表');
      }
    } catch (err) {
      console.error(err);
      toast.error('获取标签列表失败');
    }
  };

  // 更新好友详情
  const updateFriend = () => {
    friendFormInst.validateFields().then(async (values) => {
      try {
        const params = {
          friendId: curFriend!.friendId,
          noteName: values.noteName ? values.noteName : curFriend!.email,
          tagId: values.tagId,
        };
        const res = await updateFriendApi(params);
        if (res.code === BaseState.Ok /**  && res.data */) {
          toast.success('更新好友详情成功');
          fetchFriendList();
        } else {
          toast.error('更新好友详情失败');
        }
      } catch (err) {
        console.error(err);
        toast.error('更新好友详情失败');
      }
    });
  };

  // 新建标签
  const addTag = async () => {
    if (!newTagName) {
      toast.warning('请输入标签名');
      return;
    }
    try {
      const params = {
        userId: userInfo.id,
        userEmail: userInfo.email,
        name: newTagName,
      };
      const res = await addTagApi(params);
      if (res.code === BaseState.Ok) {
        toast.success('新建标签成功');
        fetchFriendList();
        _fetchTagList();
        setMountAddTagModal(false);
      } else {
        toast.error('新建标签失败');
      }
    } catch (err) {
      console.error(err);
      toast.error('新建标签失败');
    }
  };

  // 获取群聊列表, 暴露
  const fetchGroupList = useCallback(async () => {
    try {
      const [res] =
        curGroup && curGroup.id
          ? await Promise.all([fetchGroupListApi(), _fetchGroupById(curGroup.id)])
          : [await fetchGroupListApi()];
      if (res.code === BaseState.Ok) {
        setGroupList(res.data);
      } else {
        toast.error('获取群聊列表失败');
      }
    } catch (err) {
      console.error(err);
      toast.error('获取群聊列表失败');
    }
  }, [_fetchGroupById, curGroup, toast]);

  const CtxMenu = useCallback(
    (tabKey: 'friend' | 'group') => {
      return tabKey === 'friend' ? (
        <ul>
          <li onClick={fetchFriendList}>刷新好友列表</li>
          <li onClick={() => setMountAddTagModal(true)}>新建标签</li>
        </ul>
      ) : (
        <ul>
          <li onClick={fetchGroupList}>刷新群聊列表</li>
        </ul>
      );
    },
    [fetchFriendList, fetchGroupList],
  );

  const TabLabel = useCallback(
    (tabKey: 'friend' | 'group') => {
      return (
        <Tooltip
          placement="bottomLeft"
          title={CtxMenu(tabKey)}
          arrow={false}
          trigger={'contextMenu'}
        >
          {tabKey === 'friend' ? '好友' : '群聊'}
        </Tooltip>
      );
    },
    [CtxMenu],
  );

  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: 'friend',
        label: TabLabel('friend'),
        children:
          treeData.length === 0 ? (
            <Empty />
          ) : (
            <DirectoryTree
              onSelect={handleSelectFriend}
              treeData={treeData}
              icon={null}
              showIcon={false}
              className={`${styles.tree} w-full`}
            />
          ),
      },
      {
        key: 'group',
        label: TabLabel('group'),
        children:
          groupList.length === 0 ? (
            <Empty description="暂无群聊" />
          ) : (
            <div className="flex flex-col gap-1">
              {groupList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleClickGroup(item)}
                  className={`flex h-[60px] cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-[#d6e8d1] ${
                    curGroup?.id === item.id ? 'bg-[#cce3c5] hover:bg-[#cce3c5]' : ''
                  }`}
                >
                  <div className="flex w-full items-center gap-3">
                    <ImgContainer
                      src={item.avatar}
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                    <div className="flex-1 truncate text-gray-800">{item.name}</div>
                  </div>
                </div>
              ))}
            </div>
          ),
      },
    ],
    [TabLabel, groupList, handleClickGroup, handleSelectFriend, treeData],
  );

  const subTabItems: TabsProps['items'] = [
    {
      key: 'groupIndex',
      label: '群聊主页',
      children: (
        <div>
          <div>群主: {curGroup?.creatorEmail}</div>
          <div>群聊人数: {curGroup?.memberList.length}</div>
          <div>创建时间: {curGroup?.createdAt.split('.')[0].replace('T', '')}</div>
        </div>
      ),
    },
    {
      key: 'groupDetail',
      label: '群聊详情',
      children: (
        <div>
          <ul className="flex">
            <li className="flex-1 font-bold">用户名</li>
            <li className="flex-1 font-bold">群昵称</li>
            <li className="flex-1 font-bold">加入时间</li>
            <li className="flex-1 font-bold">最后发言时间</li>
          </ul>
          <div>
            {curGroup?.memberList.map((item) => (
              <ul key={item.userId} className="flex">
                <li className="flex-1">{item.username}</li>
                <li className="flex-1">{item.nickname}</li>
                <li className="flex-1">{item.createdAt.split('.')[0].replace('T', ' ')}</li>
                <li className="flex-1">
                  {item.latestMsgTime?.split('.')[0].replace('T', '') || '没有发言记录'}
                </li>
              </ul>
            ))}
          </div>
        </div>
      ),
    },
  ];

  useEffect(() => {
    // 获取好友列表
    fetchFriendList();
    // 获取标签列表
    _fetchTagList();
    // 获取群聊列表
    fetchGroupList();
  }, []); //! onMounted

  useEffect(() => {
    switch (curTab) {
      case 'friend':
        setCurGroup(null);
        break;
      case 'group':
        setCurFriend(null);
        break;
    }
  }, [curTab]); //! watch

  //! defineExpose
  useImperativeHandle(ref, () => {
    return {
      fetchFriendList,
      fetchGroupList,
    };
  });

  const LeftContainer = useMemo(
    () => (
      <div className="bg-theme2 border-theme3 flex w-70 shrink-0 flex-col overflow-auto border-r">
        <div className="p-3">
          <SearchBar />
        </div>
        <div className="flex-1 overflow-auto p-3">
          <Tabs
            centered
            defaultActiveKey="friend"
            items={tabItems}
            onChange={(tabKey: string) => setCurTab(tabKey)}
          />
        </div>
      </div>
    ),
    [tabItems],
  );

  return (
    <>
      <div className="flex h-dvh w-full">
        {LeftContainer}
        {/* rightContainer */}
        <div className="bg-theme flex h-dvh flex-1 flex-col items-center justify-center overflow-hidden">
          {curTab === 'friend' && curFriend && (
            <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-10 shadow-sm">
              <div className="mb-10 flex w-full items-center border-b border-gray-100 pb-10">
                <ImgContainer
                  src={curFriend.avatar}
                  className="h-24 w-24 shrink-0 rounded-xl object-cover shadow-sm"
                />
                <div className="ml-8 flex-1">
                  <div className="mb-2 flex items-center gap-2 text-2xl font-bold text-gray-800">
                    {curFriend.noteName || curFriend.username}
                  </div>
                  <div className="mb-1 text-sm text-gray-500">邮箱: {curFriend.email}</div>
                  <div className="text-sm text-gray-500">
                    个性签名: {curFriend.signature ?? '这个人很神秘, 没有签名'}
                  </div>
                </div>
              </div>
              <div className="px-4">
                <Form form={friendFormInst} layout="horizontal" labelCol={{ span: 4 }}>
                  <Form.Item label="邮箱" colon={false} name="email">
                    <Input readOnly variant="borderless" className="px-0 text-gray-600" />
                  </Form.Item>
                  <Form.Item label="用户名" colon={false} name="username">
                    <Input readOnly variant="borderless" className="px-0 text-gray-600" />
                  </Form.Item>
                  <Form.Item label="备注" colon={false} name="noteName">
                    <Input
                      placeholder="请输入备注"
                      className="hover:border-theme5 focus:border-theme5 focus:ring-theme5"
                    />
                  </Form.Item>
                  <Form.Item label="标签" colon={false} name="tagId">
                    <Select
                      notFoundContent="没有标签"
                      placeholder="请选择标签"
                      options={tagList.map((item) => ({
                        label: item.name,
                        value: item.id,
                      }))}
                      className="hover:border-theme5"
                    />
                  </Form.Item>
                </Form>
                <div className="mt-12 flex justify-center gap-8 border-t border-gray-100 pt-8">
                  <Button
                    size="large"
                    className="hover:text-theme5 hover:border-theme5 w-32"
                    onClick={updateFriend}
                  >
                    更新资料
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    className="bg-theme6 hover:bg-theme5 w-32"
                    onClick={() => doChat(curFriend)}
                  >
                    发消息
                  </Button>
                </div>
              </div>
            </div>
          )}
          {curTab === 'group' && curGroup && (
            <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-10 shadow-sm">
              <div className="mb-10 flex w-full items-center border-b border-gray-100 pb-10">
                <ImgContainer
                  src={curGroup.avatar}
                  className="h-24 w-24 shrink-0 rounded-xl object-cover shadow-sm"
                />
                <div className="ml-8 flex-1">
                  <div className="mb-2 text-2xl font-bold text-gray-800">{curGroup.name}</div>
                  <div className="text-sm text-gray-500">
                    群公告: {curGroup.readme ?? '这个群很神秘, 没有群公告'}
                  </div>
                </div>
              </div>
              <div className="px-4">
                <Tabs
                  centered
                  defaultActiveKey={'groupIndex'}
                  items={subTabItems}
                  className="mb-8"
                />
              </div>
              <div className="mt-8 flex justify-center gap-8 border-t border-gray-100 pt-8">
                <Button
                  size="large"
                  className="hover:text-theme5 hover:border-theme5 w-32"
                  onClick={() => setMountCreateGroupModal(true)}
                >
                  邀请好友
                </Button>
                <Button
                  type="primary"
                  size="large"
                  className="bg-theme6 hover:bg-theme5 w-32"
                  onClick={() => doChat(curGroup)}
                >
                  发消息
                </Button>
              </div>
            </div>
          )}
          {!curFriend && !curGroup && (
            <MessageEmoji theme="filled" size="15rem" fill="var(--color-theme5)" strokeWidth={3} />
          )}
        </div>
        {mountAddTagModal && (
          // width
          <Modal
            title="新建标签"
            open={mountAddTagModal}
            onCancel={() => setMountAddTagModal(false)}
            onOk={() => addTag()}
            cancelText="取消"
            okText="确定"
          >
            <Form name="addTagForm" form={addTagFormInst}>
              <Form.Item name="tagName">
                <Input
                  placeholder="请输入标签名"
                  onChange={(ev) => setNewTagName(ev.target.value)}
                />
              </Form.Item>
            </Form>
          </Modal>
        )}
        {mountCreateGroupModal && curGroup && (
          <CreateGroupModal
            mountModal={mountCreateGroupModal}
            curGroup={curGroup}
            setMountModal={setMountCreateGroupModal}
            type="addFriends"
          />
        )}
      </div>
    </>
  );
};

export default Contact;
