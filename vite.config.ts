import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Mã bản build: ưu tiên commit SHA của Vercel; chạy local thì lấy mốc thời gian.
// Dùng để app biết khi nào có bản deploy mới mà nhắc người dùng tải lại trang.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())

// Ghi version.json vào thư mục build (chỉ khi build). App poll file này rồi so
// với __BUILD_ID__ của bản đang chạy — khác nhau ⇒ đã có bản mới.
function emitVersionJson(): Plugin {
  return {
    name: 'baseafood-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), emitVersionJson()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
