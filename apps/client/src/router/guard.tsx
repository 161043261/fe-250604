/* eslint-disable @typescript-eslint/no-explicit-any */
import { Navigate } from 'react-router';

interface IProps {
  node: React.ReactNode; // JSX.Element
}

// 高阶组件 (HOC, Higher-Order Component)
export const WithGuard = (Component: React.FC) => {
  const GuardComponent: React.FC<IProps> = (props: IProps) => {
    // const tokenStore = useTokenStore();
    const { node } = props;
    const hasToken = sessionStorage.getItem('token');
    if (hasToken) {
      return node;
    }
    return <Navigate to="/login" />; // 重定向, 会改变 url
    // return <Login />; // 仅渲染组件, 不会改变 url
  };

  const WrappedComponent = (props: any) => {
    // 如果 props = { a: 1, b: 2 }
    // 则 <Component {...props} /> 等价于 <Component a={1} b={2} />
    return <GuardComponent node={<Component {...props} />} />;
  };
  return WrappedComponent;
};
