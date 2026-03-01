import { logoutApi, updatePwdApi } from '@/apis/user';
import useToast from '@/hooks/use-toast';
import useUserInfoStore from '@/store/user-info';
import { BaseState } from '@/utils/constants';
import { Button, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';

interface IProps {
  mountModal: boolean;
  setMountModal: (newMountModal: boolean) => void;
}

const PwdModal: React.FC<IProps> = (props: IProps) => {
  const { mountModal, setMountModal } = props;
  const toast = useToast();
  const navigate = useNavigate();
  const userInfoStore = useUserInfoStore();
  const userInfo = userInfoStore.userInfo;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userInfoFormInst] = Form.useForm<{
    email: string;
    password: string;
    confirmPwd: string;
  }>();

  const logout = async () => {
    try {
      const res = await logoutApi(userInfo);
      if (res.code !== BaseState.Ok) {
        toast.error('退出登录失败');
        return;
      }
      userInfoStore.clearUserInfo();
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      toast.success('登录已过期, 请重新登录');
      navigate('/login');
    } catch (err) {
      console.error(err);
      toast.error('退出登录失败');
    }
  };

  const handleUpdatePwd = async (formData: {
    email: string;
    password: string;
    confirmPwd: string;
  }) => {
    const { email, password, confirmPwd } = formData;
    if (password !== confirmPwd) {
      return toast.error('两次输入的密码不同');
    }
    setIsLoading(true);
    try {
      const res = await updatePwdApi({ email, password });
      if (res.code === BaseState.Ok) {
        toast.success('密码更新成功');
        setMountModal(false);
        logout();
      } else {
        toast.error('密码更新失败');
      }
    } catch (err) {
      console.error(err);
      toast.error('密码更新失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Modal
        title="更新密码"
        open={mountModal}
        confirmLoading={isLoading}
        onCancel={() => setMountModal(false)}
        footer={null}
      >
        <Form
          onFinish={handleUpdatePwd}
          initialValues={{
            email: userInfo.email,
          }}
          form={userInfoFormInst}
        >
          <Form.Item name="email">
            <Input type="text" placeholder="邮箱" disabled />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { max: 15, message: '密码最多 15 个字符' },
            ]}
          >
            <Input type="password" placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPwd"
            rules={[
              { required: true, message: '请确认新密码' },
              { max: 15, message: '密码最多 15 个字符' },
            ]}
          >
            <Input type="password" placeholder="请确认新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="default" onClick={() => setMountModal(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              确认
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default PwdModal;
