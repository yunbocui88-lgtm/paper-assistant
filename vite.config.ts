import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      // 微信浏览器 ≈ Chrome 80+, QQ浏览器 ≈ Chrome 90+, Safari 14+
      targets: ['chrome >= 80', 'safari >= 14', 'ios >= 14'],
      // 为现代浏览器也注入 polyfills (如 toHex, at, findLast 等)
      modernPolyfills: true,
      // 为老旧浏览器生成降级代码
      renderLegacyChunks: true,
    }),
  ],
  // GitHub Pages 部署路径 —— 如果你的仓库名不同，请修改这里
  base: '/paper-assistant/',
  build: {
    target: 'es2020', // Safari 14+ compatibility (modern bundles)
    modulePreload: false,
    // Generate source maps for debugging Safari/QQ Browser errors
    sourcemap: true,
  },
})
