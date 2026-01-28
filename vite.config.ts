
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import process from 'process';

export default defineConfig(({ mode }) => {
  // Point loadEnv to the user-specified configuration directory
  const envDir = path.resolve(process.cwd(), '.builds/config');
  const env = loadEnv(mode, envDir, '');
  
  return {
    base: './',
    plugins: [react()],
    define: {
      /**
       * In Vite, 'define' is used for build-time replacement of global variables.
       */
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
            // Keep AI SDK separate as it's large
            if (id.includes('@google/genai')) return 'vendor-ai';
            // Bundle core React deps together
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
              // Allow other libs (like lucide-react) to be tree-shaken naturally 
              // instead of forcing them into a massive vendor file.
            }
          },
        },
      },
    },
  }
});
