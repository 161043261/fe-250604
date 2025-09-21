import useToast from '@/hooks/use-toast';
import useTokenStore from '@/store/token';
import useUserInfoStore from '@/store/user-info';
import { decrypt, encrypt, genRandStr } from '@/utils/auth';
import { Button, Checkbox, Form, Input } from 'antd';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { loginApi } from '@/apis/user';
import { BaseState } from '@/utils/constants';
import { IUserInfo } from '@/types/user';

import styles from './login.module.scss';

const Login: React.FC = () => {
  const tokenStore = useTokenStore();
  const userInfoStore = useUserInfoStore();

  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isRemember, setRemember] = useState(false);
  const [loginFormInst] = Form.useForm<{
    email: string;
    password: string;
  }>();
  const [mountPwdModal, setMountPwdModal] = useState(false);

  async function writeLocal(token: string, userInfo: IUserInfo) {
    const encryptedUserInfo = await encrypt(JSON.stringify(userInfo));
    const encryptedToken = await encrypt(token);
    if (encryptedUserInfo && token) {
      localStorage.setItem('userInfo', encryptedUserInfo);
      localStorage.setItem('token', encryptedToken);
    }
  }

  async function readLocal() {
    const userInfoStr = localStorage.getItem('userInfo');
    const token_ = localStorage.getItem('token');
    if (!userInfoStr || !token_) {
      return;
    }
    try {
      const decryptedStr = await decrypt(userInfoStr);
      const userInfo: IUserInfo = JSON.parse(decryptedStr);
      const token = await decrypt(token_);
      return { userInfo, token };
    } catch (err) {
      console.trace(err);
      return null;
    }
  }

  const handleLogin = async (form: { email: string; password: string }) => {
    const { email, password } = form;
    const ret = await readLocal();
    if (ret && ret.userInfo?.email === email) {
      tokenStore.setToken(ret.token);
      userInfoStore.setUserInfo(ret.userInfo);
      toast.success('登录成功');
      return navigate('/');
    }
    setIsLoading(true);
    const reqData = { email, password };
    const res = await loginApi(reqData);
    if (res.code === BaseState.Ok && res.data) {
      toast.success('登录成功');
      setIsLoading(false);
      const { token, userInfo } = res.data;
      tokenStore.setToken(token);
      userInfoStore.setUserInfo(userInfo);
      if (isRemember) {
        writeLocal(token, userInfo);
      }
      return navigate('/');
    }
    toast.error('登录失败');
    setIsLoading(false);
  };

  const handleRemember = () => {
    const newIsRemember = !isRemember;
    setRemember(newIsRemember); // 异步
    if (newIsRemember) {
      localStorage.setItem('isRemember', `${newIsRemember}`);
      localStorage.setItem('token', tokenStore.token);
      localStorage.setItem('userInfo', JSON.stringify(userInfoStore.userInfo));
    } else {
      // localStorage.clear()
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
    }
  };

  useEffect(
    () => {
      readLocal().then((val) => {
        if (val) {
          loginFormInst.setFieldsValue({
            email: val.userInfo.email,
            password: genRandStr().slice(0, 15),
          });
          setRemember(true);
        } else {
          setRemember(false);
        }
      });
    },
    [], //! onMounted
  );

  return (
    <div className="h-dvh w-dvw bg-[url('/bg.jpg')] bg-cover bg-center bg-no-repeat">
      <div
        className={`${styles.loginContainer} absolute top-[50%] right-[10%] w-100 translate-y-[-50%] px-7`}
      >
        <h1 className="my-5 text-3xl text-slate-700">欢迎登录</h1>
        <Form onFinish={handleLogin} form={loginFormInst}>
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
            <Input placeholder="请输入密码" maxLength={15} type="password" />
          </Form.Item>
          <Form.Item>
            <div className="flex cursor-pointer flex-row-reverse gap-5 text-slate-700">
              <div className="" onClick={() => setMountPwdModal(true)}>
                忘记密码
              </div>
              <Checkbox onChange={handleRemember} checked={isRemember}>
                <div className="text-slate-700">记住密码</div>
              </Checkbox>
            </div>
          </Form.Item>
          <Form.Item>
            <div className="flex items-center justify-center gap-5">
              <Button type="primary" loading={isLoading} htmlType="submit">
                登录
              </Button>
              <div className="">
                {/* <Link to="/register">没有账号? 去注册</Link> */}
                <NavLink to="/register">没有账号? 去注册</NavLink>
              </div>
            </div>
          </Form.Item>
        </Form>

        {mountPwdModal && (
          // todo: ForgetPwdModal
          <></>
        )}
      </div>
    </div>
  );
};

export default Login;
