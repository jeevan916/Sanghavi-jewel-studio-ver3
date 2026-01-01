import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

// Fix: Define __dirname for ESM compatibility in Vite config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(process.cwd(), '.builds/config');
  const env = loadEnv(mode, envDir, '');
  
  return {
    base: './',
    plugins: [react()],
    define: {
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
          gallery: path.resolve(__dirname, 'gallery.html'),
          studio: path.resolve(__dirname, 'studio.html'),
          admin: path.resolve(__dirname, 'admin.html'),
          consultant: path.resolve(__dirname, 'consultant.html'),
          login: path.resolve(__dirname, 'login.html'),
          staff: path.resolve(__dirname, 'staff.html'),
          product: path.resolve(__dirname, 'product.html'),
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