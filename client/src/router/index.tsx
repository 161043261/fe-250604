import { Spin } from 'antd';
import { IRoute } from './routes';
import { Navigate, Route, Routes } from 'react-router';
import { Suspense, useMemo } from 'react';

import { routes } from './routes';

const AntdSpin = () => (
  <div className="flex h-dvh items-center justify-center">
    <Spin />
  </div>
);

const RouterPage = () => {
  const createRoutes = (routes: IRoute[]) => {
    return routes.map((route) => {
      return (
        <Route
          key={route.key}
          path={route.path}
          element={
            route.redirect ? (
              <Navigate to={route.redirect} />
            ) : (
              <Suspense fallback={<AntdSpin />}>
                <route.element />
              </Suspense>
            )
          }
        >
          {route.children && createRoutes(route.children)}
        </Route>
      );
    });
  };

  const ComputedRoutes = useMemo(() => {
    return createRoutes(routes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes]);

  // Routes 根据当前 url 渲染匹配的页面, 类似 Vue 的 RouterView
  return <Routes>{ComputedRoutes}</Routes>;
};

export default RouterPage;
