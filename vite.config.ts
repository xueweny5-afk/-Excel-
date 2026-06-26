import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // 把第三方库拆为独立 chunk，降低首屏加载
        manualChunks(id: string) {
          if (id.includes('echarts')) return 'echarts';
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('zustand')) return 'zustand';
          return undefined;
        },
      },
    },
  },
});