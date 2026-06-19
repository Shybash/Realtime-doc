import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    // Suppress the chunk-size warning (our chunks are intentionally large
    // due to Tiptap + Yjs; they are separately cacheable after splitting).
    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        /**
         * Manual chunk strategy — splits the bundle into 4 separately
         * cacheable layers:
         *
         *  chunk-react  — React core + routing (rarely changes)
         *  chunk-ui     — Animation + icons + emoji picker (rarely changes)
         *  chunk-yjs    — Yjs CRDT ecosystem (changes only on library updates)
         *  chunk-tiptap — Tiptap editor ecosystem (changes only on lib updates)
         *
         * The Document.jsx page is already lazy-loaded via React.lazy() in
         * App.jsx, so Tiptap + Yjs are only fetched when a user opens a doc.
         */
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router-dom') ||
              id.includes('node_modules/scheduler')) {
            return 'chunk-react';
          }
          // UI libraries
          if (id.includes('node_modules/framer-motion') ||
              id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/emoji-picker-react') ||
              id.includes('node_modules/react-hot-toast')) {
            return 'chunk-ui';
          }
          // Yjs CRDT ecosystem
          if (id.includes('node_modules/yjs') ||
              id.includes('node_modules/y-protocols') ||
              id.includes('node_modules/y-indexeddb') ||
              id.includes('node_modules/y-prosemirror') ||
              id.includes('node_modules/y-websocket') ||
              id.includes('node_modules/lib0')) {
            return 'chunk-yjs';
          }
          // Tiptap editor ecosystem
          if (id.includes('node_modules/@tiptap') ||
              id.includes('node_modules/prosemirror') ||
              id.includes('node_modules/tiptap-extension') ||
              id.includes('node_modules/lowlight') ||
              id.includes('node_modules/highlight.js') ||
              id.includes('node_modules/tippy.js')) {
            return 'chunk-tiptap';
          }
        },
      },
    },
  },
})
