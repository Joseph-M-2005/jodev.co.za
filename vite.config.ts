import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Page scripts block rendering, so the first frame, the one a cross-page transition animates to, already has the
// React page in it (see src/components/mount.tsx). Vite moves them into <head> (render blocking is ignored in
// <body>) but drops unknown attributes from the tags it rewrites, so the attribute is added after it.
const renderBlockingScripts: Plugin = {
  name: 'render-blocking-scripts',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html.replace(/<script type="module"(?![^>]*blocking)/g, '<script type="module" blocking="render"'),
  },
}

export default defineConfig({
  plugins: [react(), renderBlockingScripts],
  // Separate HTML pages, not a single-page app: unknown paths 404 in dev, like on Cloudflare
  appType: 'mpa',
  // The HTML pages live in src/ with the code; public/ and dist/ stay at the project root
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: ['index.html', '404.html', 'cv.html', 'work.html', 'about.html', 'contact.html', 'status.html'].map((f) => `src/${f}`),
    },
  },
})
