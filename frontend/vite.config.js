import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'editorRemote',
      filename: 'remoteEntry.js',
      exposes: {
        './DocumentEditor': './src/components/document/DocumentEditor.jsx',
        './DocumentToolbar': './src/components/document/DocumentToolbar.jsx',
      },
      shared: ['react', 'react-dom', 'react-router-dom', 'yjs']
    })
  ],

  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1500,
  },
})
