import zhCN from 'antd/es/locale/zh_CN';
import { /** BrowserRouter */ RouterProvider } from 'react-router';
import { App as AntdApp } from 'antd';
import { router } from './router/router';

import { ConfigProvider } from 'antd';
// import RouterPage from './router';
export default function App() {
  return (
    // <BrowserRouter>
    //   {/* 注册全局样式 */}
    //   <ConfigProvider
    //     theme={{
    //       token: {
    //         colorPrimary: '#4EA4DC',
    //         borderRadius: 16,
    //       },
    //       components: {
    //         Tree: { indentSize: 0 },
    //       },
    //     }}
    //     locale={zhCN}
    //   >
    //     <AntdApp>
    //       <RouterPage />
    //     </AntdApp>
    //   </ConfigProvider>
    // </BrowserRouter>

    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4EA4DC',
          borderRadius: 16,
        },
        components: {
          Tree: { indentSize: 0 },
        },
      }}
      locale={zhCN}
    >
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
}
