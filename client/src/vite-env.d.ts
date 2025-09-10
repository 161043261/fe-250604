/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: `${'http' | 'https'}://${string}`;
  readonly VITE_WS_BASE_URL: `ws://${string}`;
  readonly VITE_SERVER_URL: string;
}
