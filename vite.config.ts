import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Separate HTML pages, not a single-page app: unknown paths 404 in dev, like on Cloudflare
  appType: 'mpa',
  // The HTML pages live in src/ with the code; public/ and dist/ stay at the project root
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: ['index.html', '404.html', 'cv.html', 'work.html', 'about.html', 'contact.html'].map((f) => `src/${f}`),
    },
  },
})
