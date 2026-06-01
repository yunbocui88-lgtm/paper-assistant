import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages 部署路径 —— 如果你的仓库名不同，请修改这里
  base: '/paper-assistant/',
  build: {
    target: 'es2020', // Safari 14+ compatibility
  },
})
