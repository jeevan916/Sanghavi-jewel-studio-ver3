
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    esbuild: {
      target: 'esnext',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    server: {
      host: true,
      port: 5173,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      minify: 'esbuild',
      target: 'esnext',
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
