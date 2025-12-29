import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode (e.g., production, development).
  // The empty string as the third parameter allows loading all variables regardless of prefix.
  // Fix: Cast process to any to resolve 'cwd' property check error.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    // Relative base for cross-platform deployment
    base: './',
    plugins: [react()],
    define: {
      // Force injection of the API_KEY into the client-side bundle.
      // We stringify the value so it appears as a valid JS string in the output code.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || ''),
    },
    server: {
      host: true,
      port: 5173,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 1000,
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