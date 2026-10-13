import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_PROXY_TARGET;
  const base = env.VITE_API_BASE_URL || '/api';
  return {
    plugins: [react()],
    server: target && base.startsWith('/')
      ? { proxy: { [base]: { target, changeOrigin: true, secure: true } } }
      : undefined,
  };
});
