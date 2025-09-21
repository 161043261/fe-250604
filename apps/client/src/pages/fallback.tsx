import { Empty } from 'antd';

const Fallback: React.FC = () => {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Empty description={false} />
    </div>
  );
};

export default Fallback;
