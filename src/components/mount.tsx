import { StrictMode, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import Layout from './Layout'
import './transitions'

// Renders a page into #root right away instead of in a later task. Each page's script is render-blocking
// (in <head> with blocking="render"), so the first frame, the one a page transition animates to, already has
// the page in it, even when the page wasn't prerendered.
export function mount(page: ReactNode, root = document.getElementById('root')!) {
  const reactRoot = createRoot(root)
  flushSync(() => reactRoot.render(<StrictMode><Layout>{page}</Layout></StrictMode>))
}
