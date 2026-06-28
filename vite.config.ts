import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base path for GitHub Pages. The site is served from
// https://<user>.github.io/plan-it-nice/. Override with VITE_BASE if you
// host it under a different path (e.g. a custom domain → "/").
const base = process.env.VITE_BASE ?? '/plan-it-nice/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Plan It Nice',
        short_name: 'Plan It Nice',
        description:
          'Serverless peer-to-peer planning poker. No backend, no accounts — just share a room link.',
        theme_color: '#ec6608',
        background_color: '#1c1a17',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // PeerJS talks to its broker/STUN over WebSocket/WebRTC, which the
        // service worker never intercepts — so no runtime caching needed there.
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
})
