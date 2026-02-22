
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import process from 'process';
import { existsSync } from 'fs';

export default defineConfig(({ mode }) => {
  // Point loadEnv to the user-specified configuration directory
  let envDir = path.resolve(process.cwd(), 'public_html', '.builds', 'config');
  if (!existsSync(envDir)) {
     // Fallback
     envDir = path.resolve(process.cwd(), '.builds', 'config');
  }
  const env = loadEnv(mode, envDir, '');
  
  return {
    base: '/', // ABSOLUTE PATH: Critical for .htaccess routing to work correctly
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(
        env.VITE_GEMINI_API_KEY || 
        env.API_KEY || 
        process.env.API_KEY || 
        ''
      ),
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
        '/uploads': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        }
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      minify: 'esbuild',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('@google/genai')) return 'vendor-ai';
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
            }
          },
        },
      },
    },
  }
});
