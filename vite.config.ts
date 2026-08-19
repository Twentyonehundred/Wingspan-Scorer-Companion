import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/**
 * Version and build time, shown in the app footer so it's obvious which copy
 * you're looking at — a phone running a service-worker-cached build looks
 * identical to a fresh one otherwise.
 *
 * A virtual module rather than `define`, because define is a build-time text
 * substitution and leaves the identifiers dangling under the dev server. In
 * dev the stamp is when the server started, not when the last edit landed:
 * HMR doesn't re-evaluate this file.
 */
function buildInfo(command: string): Plugin {
  const id = 'virtual:build-info'
  const resolved = '\0' + id
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const month = now.toLocaleString('en-GB', { month: 'short' })
  const when = `${pad(now.getDate())} ${month} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const stamp = command === 'serve' ? `dev ${when}` : when

  return {
    name: 'build-info',
    resolveId: (source) => (source === id ? resolved : null),
    load: (loading) =>
      loading === resolved
        ? `export const version = ${JSON.stringify(version)}\n` +
          `export const stamp = ${JSON.stringify(stamp)}\n`
        : null,
  }
}

export default defineConfig(({ command }) => ({
  // Relative base so the built app can be dropped into any sub-path on the
  // portfolio site (e.g. /projects/wingspan/) without a rebuild.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    buildInfo(command),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Wingspan Scores',
        short_name: 'Wingspan',
        description: 'Score pad, history and stats for Wingspan and its expansions.',
        theme_color: '#1b1915',
        background_color: '#12100c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Firestore handles its own offline cache; we only precache the shell.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
}))
