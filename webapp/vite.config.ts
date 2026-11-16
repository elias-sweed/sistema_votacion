import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Sistema de Votación — I.E. Jimenez Pimentel',
        short_name: 'Votación',
        description: 'Panel de administración y kiosco de votación escolar.',
        lang: 'es',
        theme_color: '#03040b',
        background_color: '#03040b',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Solo se precachea el shell de la app. Los datos de Supabase y los
        // votos NUNCA se guardan: la votación sigue siendo online-only.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,ttf,woff2}'],
        globIgnores: ['**/fondo-*.jpg'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/functions\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'imagenes-kiosco',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ]
})
