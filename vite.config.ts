import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/* In development the API can be proxied, so the browser talks to one origin and
   the backend's cookies and CORS rules behave as they will in production.
   Set VITE_DEV_PROXY_TARGET in .env.local (for example https://sunhub.in) and
   VITE_API_BASE_URL to the path the API lives under (for example /api). */
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
