import { Link } from '@tanstack/react-router'

import { Logo } from '#/components/AppHeader'
import { LocaleSwitcher } from '#/components/LocaleSwitcher'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

// The header every puuid.com site shares: the mark and name linking home, the
// site's pages, then the language menu (in the footer on phones) and the
// site's main action. The map at `/` keeps its own floating controls.
const navItems = [
  { to: '/history', label: () => m.price_history() },
  { to: '/changelog', label: () => m.nav_changelog() },
] as const

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
          {m.app_name()}
        </Link>
        <nav className="flex flex-1 items-center gap-1 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-2.5 py-1.5 whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-sm:px-1.5"
              activeProps={{
                className: 'text-foreground',
                'aria-current': 'page',
              }}
              activeOptions={{ exact: true, includeSearch: false }}
            >
              {item.label()}
            </Link>
          ))}
        </nav>
        <LocaleSwitcher className="max-sm:hidden" />
        <Button asChild size="sm" className="px-3 max-sm:hidden">
          <Link to="/">{m.open_map()}</Link>
        </Button>
      </div>
    </header>
  )
}
