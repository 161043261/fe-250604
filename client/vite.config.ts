import { defineConfig, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss() as PluginOption[]],
  root: __dirname, // path.resolve(__dirname, 'path/to/root'),
  //! tsconfig.app.json
  // {
  //   "compilerOptions": {
  //     "paths": {
  //       "@/*": ["./src/*"]
  //     }
  //   }
  // }
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // server: {
  //   proxy: {
  //     '^/api/v': {
  //       target: 'http://127.0.0.1:3000',
  //       changeOrigin: true,
  //       rewrite: (path) => path.replace(/^\/api\/v/, '/api'),
  //     },
  //   },
  // },
});
