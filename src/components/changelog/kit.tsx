import type { ReactNode } from 'react'

import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

// Static, inert miniatures of the site for the changelog. Each preview
// pictures what one release changed, as one shot or a before/after pair.
// They are illustrations: `inert` keeps their controls out of the tab order
// and the accessibility tree, since the bullets already say what changed.
// Add small parts here (a header, a card, a form row) as previews need them,
// built from the same tokens as the real UI so they follow light and dark.

export function Figure({ children }: { children: ReactNode }) {
  return (
    <figure inert className="not-prose mt-6 grid gap-3 select-none">
      {children}
    </figure>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

/** One framed picture, optionally labelled. */
export function Shot({
  label,
  className,
  children,
}: {
  label?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'grid min-w-0 gap-2',
        label ? 'grid-rows-[auto_1fr]' : 'content-start',
      )}
    >
      {label && <Label>{label}</Label>}
      <div
        className={cn(
          'relative min-w-0 overflow-hidden rounded-lg border bg-background text-xs',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** The same spot before and after the release, side by side. */
export function BeforeAfter({
  before,
  after,
  className,
}: {
  before: ReactNode
  after: ReactNode
  className?: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Shot label={m.changelog_before()} className={className}>
        {before}
      </Shot>
      <Shot label={m.changelog_after()} className={className}>
        {after}
      </Shot>
    </div>
  )
}

/** A muted pill, like a badge or a keyboard hint. */
export function Chip({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** The site's footer row, for releases that change it. */
export function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-t px-3 py-2 text-muted-foreground">
      {children}
    </div>
  )
}

/** The site's header row, for releases that change it. */
export function Header({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b px-3 py-2">{children}</div>
  )
}

/** The site's mark, as the header and favicon show it. */
export function Mark() {
  return <span aria-hidden className="size-3 rounded-[3px] bg-foreground" />
}
