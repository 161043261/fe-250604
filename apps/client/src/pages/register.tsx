import { registerApi } from '@/apis/user';
import useToast from '@/hooks/use-toast';
import { ILoginParams } from '@/types/user';
import { BaseState } from '@/utils/constants';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import styles from './register.module.scss';
import { Button, Form, Input } from 'antd';
import { genBase64 } from '@/utils/img';

export default function Register() {
  type RegisterForm = ILoginParams & { confirmPwd: string };
  const navigate = useNavigate();
  const toast = useToast();
  const [registerFormInst] = Form.useForm<RegisterForm>();

  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (form: RegisterForm) => {
    const { email, password, confirmPwd } = form;
    if (password !== confirmPwd) {
      return toast.error('两次输入的密码不同');
    }
    setIsLoading(true);
    try {
      const reqData = {
        email,
        password,
        avatar: genBase64(),
      };
      const res = await registerApi(reqData);
      if (res.code === BaseState.Ok) {
        toast.success('注册成功');
        navigate('/login');
      } else {
        toast.error(res.msg);
      }
    } catch (err) {
      console.error(err);
      toast.error('注册失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-dvh w-dvw bg-[url('/bg.png')] bg-cover bg-center bg-no-repeat">
      <div
        className={`${styles.registerContainer} absolute top-[50%] right-[10%] w-100 translate-y-[-50%] px-7`}
      >
        <h1 className="my-5 text-3xl text-slate-700">欢迎注册</h1>
        <Form onFinish={handleRegister} form={registerFormInst}>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { max: 30, message: '邮箱最多 30 个字符' },
            ]}
          >
            <Input placeholder="请输入邮箱" maxLength={30} />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { max: 15, message: '密码最多 15 个字符' },
            ]}
          >
            <Input placeholder="请输入密码" maxLength={15} />
          </Form.Item>
          <Form.Item
            name="confirmPwd"
            rules={[
              { required: true, message: '请确认密码' },
              { max: 15, message: '密码最多 15 个字符' },
            ]}
          >
            <Input placeholder="请确认密码" maxLength={15} />
          </Form.Item>
          <Form.Item>
            <div className="flex items-center justify-center gap-5">
              <Button type="primary" loading={isLoading} htmlType="submit">
                注册
              </Button>
              <div className="">
                <Link to="/login">已有账号? 去登录</Link>
              </div>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
