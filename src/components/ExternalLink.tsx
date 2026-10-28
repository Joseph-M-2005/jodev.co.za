import type { AnchorHTMLAttributes } from 'react'

// Links off the site open in a new tab, and screen readers are told so.
// noopener (not noreferrer), so sites like GitHub still see jodev.co.za as the referrer.
export default function ExternalLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...props} target="_blank" rel="noopener">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
