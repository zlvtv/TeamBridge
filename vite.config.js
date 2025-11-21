import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Дополнительные настройки если понадобятся позже
  server: {
    port: 3000,
    open: true // автоматически открывать браузер
  }
})