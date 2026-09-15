import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  // .env files (local dev). Vercel injects its vars into process.env at build.
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const pick = (...names) => {
    for (const n of names) {
      const v = process.env[n] ?? fileEnv[n]
      if (v) return v
    }
    return undefined
  }
  // Bridge the non-VITE_ Vercel var names into the client bundle. Vite only
  // exposes VITE_* to the browser, so map the deploy vars explicitly.
  const supabaseUrl = pick('VITE_SUPABASE_URL', 'SUPABASE_URL_new', 'SUPABASE_URL')
  const supabaseAnonKey = pick('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY_new', 'SUPABASE_ANON_KEY')

  return {
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react') || id.includes('@tabler/icons-react')) {
              return 'vendor-icons';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            return 'vendor-utils';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  }
})
