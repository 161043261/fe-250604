import useToast from '@/hooks/use-toast';
import { uploadFile } from '@/utils/upload';
import { Plus, Rotation } from '@icon-park/react';
import { Upload } from 'antd';
import { useEffect, useState } from 'react';
import ImgContainer from './img-container';

interface IProps {
  onUploadOk: (filePath: string) => void; // 图片上传成功的回调
  initialImgUrl?: string;
}
const ImgUploader: React.FC<IProps> = (props) => {
  const { onUploadOk, initialImgUrl } = props;
  const toast = useToast();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpload = async (options: { file: any }) => {
    setIsLoading(true);
    const img = options.file;
    if (img.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10M');
      setIsLoading(false);
      return;
    }
    try {
      const res = await uploadFile(img, 5 /** chunkSize */);
      if (res.done && res.filePath) {
        setImgUrl(res.filePath);
        onUploadOk(res.filePath);
      } else {
        toast.error('图片上传失败');
      }
    } catch (err) {
      console.error(err);
      toast.error('图片上传失败');
    } finally {
      setIsLoading(false);
    }
  };

  const UploadBtn = (
    <div>
      {isLoading ? (
        <Rotation theme="filled" size="32" fill="#4a90e2" strokeWidth={3} />
      ) : (
        <Plus theme="filled" size="32" fill="#4a90e2" strokeWidth={3} />
      )}
    </div>
  );

  useEffect(() => {
    if (initialImgUrl) {
      setImgUrl(initialImgUrl);
    }
  }, []);

  return (
    <div>
      <Upload
        listType="picture-card"
        showUploadList={false}
        customRequest={handleUpload}
        accept="image/*"
        maxCount={1}
      >
        {imgUrl ? <ImgContainer src={imgUrl} /> : UploadBtn}
      </Upload>
    </div>
  );
};

export default ImgUploader;
