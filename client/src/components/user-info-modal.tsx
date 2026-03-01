import { updateUserInfoApi } from '@/apis/user';
import useToast from '@/hooks/use-toast';
import useTokenStore from '@/store/token';
import useUserInfoStore from '@/store/user-info';
import { IUserInfo } from '@/types/user';
import { encrypt } from '@/utils/auth';
import { BaseState } from '@/utils/constants';
import { Form, Input, Modal } from 'antd';
import { useEffect, useState } from 'react';
import ImgUploader from './img-uploader';

interface IProps {
  mountModal: boolean;
  setMountModal: (newMountModal: boolean) => void;
}

const UserInfoModal: React.FC<IProps> = (props: IProps) => {
  const { mountModal, setMountModal } = props;
  const toast = useToast();
  const userInfoStore = useUserInfoStore();
  const tokenStore = useTokenStore();
  const userInfo = userInfoStore.userInfo;
  const [userInfoFormInst] = Form.useForm<{
    avatar: string;
    username: string;
    signature: string;
  }>();
  const [isLoading, setIsLoading] = useState<boolean>();

  const writeLocal = async (token: string, userInfo: IUserInfo) => {
    const encryptedUserInfo = await encrypt(JSON.stringify(userInfo));
    const encryptedToken = await encrypt(token);
    if (encryptedUserInfo && token) {
      localStorage.setItem('userInfo', encryptedUserInfo);
      localStorage.setItem('token', encryptedToken);
    }
  };

  const handleUpdateUserInfo = async () => {
    userInfoFormInst.validateFields().then(async (values) => {
      const { username, signature } = values;
      const avatar = userInfoFormInst.getFieldValue('avatar');
      setIsLoading(true);
      const params = {
        username,
        avatar,
        signature,
        email: userInfo.email,
      };
      try {
        const res = await updateUserInfoApi(params);
        if (res.code === BaseState.Ok && res.data) {
          toast.success('用户信息更新成功');
          setMountModal(false);
          const { token, userInfo } = res.data;
          // todo await?
          writeLocal(token, userInfo); // localStorage
          userInfoStore.setUserInfo(userInfo); // sessionStorage
          tokenStore.setToken(token); // sessionStorage
        } else {
          toast.error('用户信息更新失败');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    userInfoFormInst.setFieldsValue({
      username: userInfo.username,
      avatar: userInfo.avatar,
      signature: userInfo.signature ?? '',
    });
  }, []);

  return (
    <>
      <Modal
        open={mountModal}
        onOk={handleUpdateUserInfo}
        confirmLoading={isLoading}
        onCancel={() => setMountModal(false)}
      >
        <div>
          <ImgUploader
            onUploadOk={
              (filePath) =>
                userInfoFormInst.setFieldValue(
                  'avatar',
                  filePath,
                ) /** userInfoFormInst.setFieldsValue({ avatar: filePath }) */
            }
          />
          <div>
            <div>{userInfo.username}</div>
            <div>{userInfo.signature?.length ? userInfo.signature : '这个人很神秘, 没有签名'}</div>
          </div>
        </div>

        <Form form={userInfoFormInst}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入新用户名' }]}>
            <Input placeholder="请输入新用户名" />
          </Form.Item>
          <Form.Item name="signature" rules={[{ required: true, message: '请输入新签名' }]}>
            <Input placeholder="请输入新签名" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default UserInfoModal;
