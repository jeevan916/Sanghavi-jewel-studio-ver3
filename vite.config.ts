
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Explicitly load env from the requested path
  const envDir = path.resolve(process.cwd(), '.builds/config');
  const env = loadEnv(mode, envDir, '');
  
  return {
    base: './',
    plugins: [react()],
    define: {
      // Injects the key into the client-side bundle under process.env.API_KEY
      'process.env.API_KEY': JSON.stringify(
        env.VITE_GEMINI_API_KEY || 
        env.API_KEY || 
        process.env.API_KEY || 
        ''
      ),
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
});
