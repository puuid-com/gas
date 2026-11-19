import type { ComponentType } from 'react'

import { BeforeAfter, Chip, Figure, Footer, Header } from './kit'
import { fuelLabel } from '#/lib/i18n'
import { FUELS } from '#/lib/stations'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

// One picture per visible release, keyed by its version in CHANGELOG.md.
// Use a `BeforeAfter` pair when a release changes something that existed and
// a single `Shot` when it adds something new. Keep each one small and static,
// and reuse the `m.*` labels the real UI shows. Tooling, docs and refactor
// releases get none. `previews.test.ts` checks every key is a real release.
export const previews: Record<string, ComponentType> = {
  '1.0.1': () => (
    <Figure>
      <BeforeAfter
        before={<Fuels selected="bg-background" />}
        after={<Fuels selected="bg-foreground text-background" />}
      />
    </Figure>
  ),
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

// The map's fuel toggle in dark mode, with the selected fuel styled as given.
function Fuels({ selected }: { selected: string }) {
  return (
    <div className="dark flex bg-background p-3 text-foreground">
      {FUELS.map((fuel, i) => (
        <span
          key={fuel}
          className={cn(
            'border border-input px-2.5 py-1.5',
            i > 0 && 'border-l-0',
            i === 0 ? cn('rounded-l-md', selected) : 'bg-background',
            i === FUELS.length - 1 && 'rounded-r-md',
          )}
        >
          {fuelLabel(fuel)}
        </span>
      ))}
    </div>
  )
}
