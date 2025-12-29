import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load all environment variables from .env files
  // Using casting to any for process to avoid missing property error in dev environments
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    base: './',
    plugins: [react()],
    define: {
      // Robustly inject the API key into the client bundle
      // Using casting for process.env to ensure robustness in various build environments
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || (process.env as any).API_KEY || ''),
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        // Proxy API requests to the local Express server during development
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('@google/genai')) return 'vendor-ai';
              if (id.includes('react')) return 'vendor-react';
              return 'vendor';
            }
          },
        },
      },
    },
  }
});