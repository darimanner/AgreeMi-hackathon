import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const proxyTarget = env.VITE_API_PROXY_TARGET

  return {
    plugins: [react()],
    server: {
      proxy: proxyTarget
        ? {
            '/backend': {
              target: proxyTarget,
              changeOrigin: true,
              ws: true,
              rewrite: path => path.replace(/^\/backend/, ''),
            },
          }
        : undefined,
    },
  }
})
