import { updatePwdApi } from '@/apis/user';
import useToast from '@/hooks/use-toast';
import { BaseState } from '@/utils/constants';
import { Button, Form, Input, Modal } from 'antd';
import { useState } from 'react';

interface IProps {
  mountModal: boolean;
  setMountModal: (newMountModal: boolean) => void;
}

const ForgetPwdModal: React.FC<IProps> = (props: IProps) => {
  const { mountModal, setMountModal } = props;
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formInst] = Form.useForm<{
    email: string;
    password: string;
    confirmPwd: string;
  }>();

  const handleResetPwd = async (formData: {
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
        toast.success('密码重置成功，请重新登录');
        setMountModal(false);
      } else {
        toast.error(res.msg || '密码重置失败');
      }
    } catch (err) {
      console.error(err);
      toast.error('密码重置失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title="忘记密码"
      open={mountModal}
      confirmLoading={isLoading}
      onCancel={() => setMountModal(false)}
      footer={null}
    >
      <Form onFinish={handleResetPwd} form={formInst}>
        <Form.Item
          name="email"
          rules={[
            { required: true, message: '请输入注册邮箱' },
            { type: 'email', message: '请输入正确的邮箱格式' },
            { max: 30, message: '邮箱最多 30 个字符' },
          ]}
        >
          <Input placeholder="请输入注册邮箱" maxLength={30} />
        </Form.Item>
        <Form.Item
          name="password"
          rules={[
            { required: true, message: '请输入新密码' },
            { max: 15, message: '密码最多 15 个字符' },
          ]}
        >
          <Input type="password" placeholder="请输入新密码" maxLength={15} />
        </Form.Item>
        <Form.Item
          name="confirmPwd"
          rules={[
            { required: true, message: '请确认新密码' },
            { max: 15, message: '密码最多 15 个字符' },
          ]}
        >
          <Input type="password" placeholder="请确认新密码" maxLength={15} />
        </Form.Item>
        <Form.Item>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setMountModal(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={isLoading}>
              确认重置
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ForgetPwdModal;
