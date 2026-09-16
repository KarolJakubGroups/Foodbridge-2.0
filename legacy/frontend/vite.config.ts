import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Production build lands directly in Spring Boot's static folder so `mvn package` ships one jar.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../target/classes/static',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8085',
      '/h2-console': 'http://localhost:8085',
    },
  },
});
