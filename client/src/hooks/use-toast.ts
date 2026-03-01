import { App } from 'antd';

export default function useToast() {
  const { message } = App.useApp();
  // return (
  //   type: 'info' | 'success' | 'error' | 'warning' | 'loading',
  //   text: string,
  //   duration?: number,
  // ) => {
  //   message[type](text, duration ?? 1.5);
  // };
  return {
    info(text: string, duration?: number) {
      message['info'](text, duration ?? 1.5);
    },
    success(text: string, duration?: number) {
      message['success'](text, duration ?? 1.5);
    },
    error(text: string, duration?: number) {
      message['error'](text, duration ?? 1.5);
    },
    warning(text: string, duration?: number) {
      message['warning'](text, duration ?? 1.5);
    },
    loading(text: string, duration?: number) {
      message['loading'](text, duration ?? 1.5);
    },
  };
}
