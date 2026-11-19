import type { ComponentType } from 'react'

import { BeforeAfter, Chip, Figure, Footer, Header } from './kit'
import { m } from '#/paraglide/messages'

// One picture per visible release, keyed by its version in CHANGELOG.md.
// Use a `BeforeAfter` pair when a release changes something that existed and
// a single `Shot` when it adds something new. Keep each one small and static,
// and reuse the `m.*` labels the real UI shows. Tooling, docs and refactor
// releases get none. `previews.test.ts` checks every key is a real release.
export const previews: Record<string, ComponentType> = {
  '1.0.0': () => (
    <Figure>
      <BeforeAfter
        className="flex flex-col"
        before={
          <>
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Mark />
              <span className="font-semibold">{m.app_name()}</span>
              <span className="text-muted-foreground">/</span>
              <span className="truncate font-medium">{m.history_title()}</span>
              <span className="ml-auto text-muted-foreground">←</span>
            </div>
            <Page />
          </>
        }
        after={
          <>
            <Header>
              <span className="flex shrink-0 items-center gap-1.5 font-semibold">
                <Mark />
                {m.app_name()}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {m.price_history()} · {m.nav_changelog()}
              </span>
              <Chip>Français</Chip>
            </Header>
            <Page />
            <Footer>
              <span className="min-w-0 flex-1 truncate">
                {m.footer_rights({ year: 2026, name: m.app_name() })}
              </span>
              <span className="font-mono">
                {m.app_version({ version: '1.0.0' })}
              </span>
            </Footer>
          </>
        }
      />
    </Figure>
  ),
}

// Plein's mark, as the header shows it.
function Mark() {
  return <span aria-hidden className="size-3 shrink-0 bg-foreground" />
}

// The price history page's first rows, as placeholder bars.
function Page() {
  return (
    <div className="grid flex-1 gap-2 px-3 py-4">
      <span className="h-2 w-2/5 rounded-sm bg-muted" />
      <span className="h-12 rounded-md bg-muted" />
    </div>
  )
}
