import { FriendList, IFriendItem } from '@/types/friend';
import { ICreateGroupDto, IGroupExt } from '@/types/group';
import { Button, Form, Input, Modal, Tree } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import ImgContainer from './img-container';
import useToast from '@/hooks/use-toast';
import { fetchFriendListApi } from '@/apis/friend';
import { BaseState, GroupState } from '@/utils/constants';
import ImgUploader from './img-uploader';
import { addFriends2groupApi, createGroupApi } from '@/apis/group';

interface IProps {
  mountModal: boolean;
  setMountModal: (newMountModal: boolean) => void;
  type: 'addFriends' | 'createGroup';
  // type === 'addFriends' 时, 需要传递群聊详情
  curGroup?: IGroupExt;
}

const CreateGroupModal: React.FC<IProps> = (props: IProps) => {
  const { mountModal, setMountModal, type, curGroup } = props;
  const toast = useToast();

  const [friendList, setFriendList] = useState<FriendList>([]);
  const [checkedFriendList, setCheckedFriendList] = useState<IFriendItem[]>([]);
  const [friendId2friend, setFriendId2friend] = useState<Record<number, IFriendItem>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [createGroupFormInst] = Form.useForm<{
    groupAvatar: string;
    groupName: string;
    readme: string;
  }>();
  const stepOneRef = useRef<HTMLDivElement | null>(null); // 第一步
  const stepTwoRef = useRef<HTMLDivElement | null>(null); // 第二步

  const treeData = friendList.map((taggedFriends) => {
    return {
      title: <div>{taggedFriends.tagName}</div>,
      key: taggedFriends.tagName,
      selectable: false,
      disabled: taggedFriends.friends.length === 0,
      children: taggedFriends.friends.map((friend) => ({
        title: (
          <div className="flex items-center gap-5">
            <ImgContainer src={friend.avatar} />
            <div>{friend.noteName}</div>
          </div>
        ),
        key: friend.id, // number
        isLeaf: true,
        selectable: false,
      })),
    };
  });

  const fetchFriendList = async () => {
    try {
      const res = await fetchFriendListApi();
      if (res.code === BaseState.Ok && res.data) {
        const friendList = res.data;
        setFriendList(friendList);
        const newFriendId2friend: Record<number, IFriendItem> = {};
        for (const taggedFriends of friendList) {
          for (const friend of taggedFriends.friends) {
            newFriendId2friend[friend.id] = friend;
          }
        }
        setFriendId2friend(newFriendId2friend);
      }
    } catch (err) {
      console.error(err);
      toast.error('获取好友列表失败');
    }
  };

  useEffect(() => {
    fetchFriendList();
  }, []);

  const switchStep = (step: 0 | 1 | 2) => {
    switch (step) {
      case 1:
        if (stepOneRef.current && stepTwoRef.current) {
          stepOneRef.current.style.opacity = '1'; // 不透明度 1
          stepTwoRef.current.style.opacity = '0'; // 不透明度 0
          setTimeout(() => {
            stepOneRef.current!.style.display = 'block';
            stepTwoRef.current!.style.display = 'none';
          }, 500);
        }
        break;

      case 2:
        if (stepOneRef.current && stepTwoRef.current) {
          if (checkedFriendList.length === 0) {
            toast.error('至少邀请 1 位好友');
            break;
          }
          stepOneRef.current.style.opacity = '0'; // 不透明度 0
          stepTwoRef.current.style.opacity = '1'; // 不透明度 1
          setTimeout(() => {
            stepOneRef.current!.style.display = 'none';
            stepTwoRef.current!.style.display = 'block';
          }, 500);
        }
        break;
    }
  };

  const FriendsTree = useMemo(() => {
    return (
      <Tree
        checkable
        defaultExpandAll={true}
        treeData={treeData}
        onCheck={(checkedKeys) => {
          const checkedIdList = (checkedKeys as (number | string)[]).filter(
            Number.isInteger,
          ) as number[];
          setCheckedFriendList(checkedIdList.map((checkedId) => friendId2friend[checkedId]));
        }}
      ></Tree>
    );
  }, [friendList]);

  const handleCreateGroup = async ({
    groupName,
    groupAvatar,
    readme,
  }: Omit<ICreateGroupDto, 'memberList'>) => {
    if (checkedFriendList.length === 0) {
      toast.error('至少邀请 1 位好友');
      return;
    }
    setIsLoading(true);
    const memberList = checkedFriendList.map((item) => ({
      userId: item.userId,
      email: item.email,
      avatar: item.avatar,
    }));
    try {
      const res = await createGroupApi({
        groupName,
        groupAvatar,
        readme,
        memberList,
      });
      if (res.code === BaseState.Ok) {
        toast.success('创建群聊成功');
        setMountModal(false);
        return; // 仍会执行 finally 块
      } else {
        toast.error('创建群聊失败');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const addFriends2group = async () => {
    if (checkedFriendList.length === 0) {
      toast.error('至少邀请 1 位好友');
      return;
    }
    const friendList = checkedFriendList.map((item) => ({
      userId: item.userId,
      email: item.email,
      avatar: item.avatar,
    }));
    try {
      const res = await addFriends2groupApi({
        groupId: curGroup!.id,
        friendList,
      });
      if (res.code === BaseState.Ok) {
        toast.success('邀请成功');
        setMountModal(false);
        return;
      }
      if (res.code === GroupState.FriendJoined) {
        toast.warning('邀请的好友已加入');
      } else {
        toast.error('邀请失败');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Modal
        title={type === 'addFriends' ? '邀请好友' : '创建群聊'}
        open={mountModal}
        onCancel={() => setMountModal(false)}
        footer={null}
      >
        <div ref={stepOneRef} className="duration-1000">
          <div className="flex">
            <div className="flex-1">
              <div>好友列表</div>
              {FriendsTree}
            </div>
            <div className="flex-1">
              <div>已选择的好友</div>
              {checkedFriendList.map((item) => {
                return (
                  <div key={item.id} className="mt-1.5 flex items-center gap-5">
                    <ImgContainer className="w-8" src={item.avatar} />
                    <div>{item.noteName}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-row-reverse">
            {type === 'addFriends' ? (
              <Button onClick={addFriends2group} loading={isLoading}>
                邀请
              </Button>
            ) : (
              <Button onClick={() => switchStep(2)}>下一步</Button>
            )}
          </div>
        </div>

        <div ref={stepTwoRef} className="hidden duration-1000">
          <Form form={createGroupFormInst} onFinish={handleCreateGroup}>
            <Form.Item rules={[{ required: true, message: '请上传群聊头像' }]} name="groupAvatar">
              <ImgUploader
                onUploadOk={(filePath) => {
                  createGroupFormInst.setFieldsValue({ groupAvatar: filePath });
                }}
              />
            </Form.Item>
            <Form.Item rules={[{ required: true, message: '请输入群聊名' }]} name="groupName">
              <Input maxLength={15} showCount={true} placeholder="请输入群聊名" />
            </Form.Item>
            <Form.Item rules={[{ required: true, message: '请输入群公告' }]} name="readme">
              <Input maxLength={30} showCount={true} placeholder="请输入群公告" />
            </Form.Item>
            <Form.Item>
              <Button onClick={() => switchStep(1)}>上一步</Button>
              <Button type="primary" htmlType="submit" loading={isLoading}>
                确定
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default CreateGroupModal;
