import { genBase64 } from '@/utils/img';

interface IProps {
  src: string;
  alt?: string;
  className?: string;
}

// src 可能是 base64, 也可能是 url, 也可能是 /uploads/image
export default function ImgContainer(props: IProps) {
  const { alt, className } = props;
  let src = props.src;
  if (src.startsWith('uploads/')) {
    src = `${import.meta.env.VITE_SERVER_URL}/${src}`;
  }
  return (
    <img
      src={src}
      onError={(ev) => {
        ev.currentTarget.src = genBase64();
      }}
      alt={alt ?? 'img'}
      className={`${className}`}
      draggable={false}
    />
  );
}
