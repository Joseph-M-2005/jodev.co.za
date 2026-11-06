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

// Preload the two pixel fonts (their Latin files) on every page. They're font-display: swap, and without this
// they arrive after the first frame, so a page transition animated the fallback font and then swapped.
const preloadFonts: Plugin = {
  name: 'preload-fonts',
  transformIndexHtml: {
    order: 'post',
    handler: (html, { bundle, path }) => {
      // The CV's body text is system-ui, so it only needs the heading font
      const wanted = path === '/cv.html' ? /press-start-2p-latin-400-normal-.*\.woff2$/ : /(press-start-2p-latin-400|pixelify-sans-latin-wght)-normal-.*\.woff2$/
      const fonts = Object.keys(bundle ?? {}).filter((f) => wanted.test(f))
      const links = fonts.map((f) => `  <link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin>\n`).join('')
      return html.replace('</head>', `${links}</head>`)
    },
  },
}

export default defineConfig({
  plugins: [react(), renderBlockingScripts, preloadFonts],
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
