// Cross-page transitions only move things that are on screen. Tap a link near the bottom of a page and the heading
// is far above the viewport, so it would fly in from a long way off. Anything with a transition name that isn't
// in view drops out of the move and just fades with the rest of the page. Runs on both pages: on the old one
// just before it's captured (pageswap), on the new one before its first frame (pagereveal).
type SwapOrReveal = Event & { viewTransition?: unknown }

function keepOnScreen(e: SwapOrReveal) {
  if (!e.viewTransition) return
  for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
    // Undo an earlier pass, for a page coming back from the back/forward cache
    el.style.removeProperty('view-transition-name')
    if (getComputedStyle(el).viewTransitionName === 'none') continue
    const box = el.getBoundingClientRect()
    if (box.bottom <= 0 || box.top >= innerHeight) el.style.viewTransitionName = 'none'
  }
}

addEventListener('pageswap', keepOnScreen as EventListener)
addEventListener('pagereveal', keepOnScreen as EventListener)
