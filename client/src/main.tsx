import { createRoot } from 'react-dom/client';
// import App from './App';
//! tailwindcss
import '@/assets/styles/tailwind.css';
//! global.scss
import '@/assets/styles/global.scss';
import '@ant-design/v5-patch-for-react-19';
import App from './App';
import { StrictMode } from 'react';

// localStorage.removeItem('userInfo');
// localStorage.removeItem('token');
// localStorage.removeItem('isRemember');

const container = document.getElementById('root') as HTMLDivElement;
const root = createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
