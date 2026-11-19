import { Outlet, createFileRoute } from '@tanstack/react-router'

import { SiteFooter } from '#/components/layout/SiteFooter'
import { SiteHeader } from '#/components/layout/SiteHeader'
import { m } from '#/paraglide/messages'

// Layout for content pages. The map at `/` uses its own full-screen shell.
export const Route = createFileRoute('/_site')({
  component: SiteLayout,
})

function SiteLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:ring-1 focus:ring-ring"
      >
        {m.skip_to_content()}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
