import { useState } from 'react'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconMapPin,
  IconSearch,
} from '@tabler/icons-react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useDebouncedValue } from '@tanstack/react-pacer'
import {
  DistributionChart,
  PriceChart,
  RegionChart,
} from '#/components/history/charts'
import { StaleNotice, StaleTag } from '#/components/StaleMark'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { useSetHistorySearch } from '#/hooks/use-history-search'
import { useNow } from '#/hooks/use-now'
import {
  formatDay,
  formatDayTime,
  formatPrice,
  formatRelative,
  formatSignedCents,
} from '#/lib/format'
import { STALE_DAYS, isStale, unchangedDays } from '#/lib/history'
import {
  staleListQueryOptions,
  stationHistoryQueryOptions,
  stationSearchQueryOptions,
} from '#/lib/history.query'
import { fuelLabel } from '#/lib/i18n'
import { cn } from '#/lib/utils'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { PriceHistory, Range, StationRecord } from '#/lib/history'
import { stationsQueryOptions } from '#/lib/stations.query'
import type { Fuel } from '#/lib/stations'

const title = (s: Pick<StationRecord, 'brand' | 'name'>) => s.brand ?? s.name

/** A price move, coloured like the map: green when cheaper, red when pricier. */
export function Delta({
  cents,
  className,
}: {
  cents: number
  className?: string
}) {
  const flat = Math.abs(cents) < 0.05
  const Icon = cents < 0 ? IconArrowDownRight : IconArrowUpRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium tabular-nums',
        flat
          ? 'text-muted-foreground'
          : cents < 0
            ? 'text-tier-0'
            : 'text-destructive',
        className,
      )}
    >
      {!flat && <Icon aria-hidden className="size-4" />}
      {formatSignedCents(cents, getLocale())}
    </span>
  )
}

function SectionHeading({
  children,
  caption,
}: {
  children: React.ReactNode
  caption?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
    </div>
  )
}

/** The median for the chosen region (or Quebec) over the period. */
export function TrendSection({
  history,
  fuel,
  region,
}: {
  history: PriceHistory
  fuel: Fuel
  region?: string
}) {
  const locale = getLocale()
  const { points } = history
  const latest = points.at(-1)
  const first = points[0]
  const trend = points.length > 1

  if (history.snapshots === 0) {
    return (
      <section className="flex flex-col gap-2 border p-6">
        <p className="text-sm text-muted-foreground">{m.history_empty()}</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4" aria-label={m.history_title()}>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {m.history_median({ fuel: fuelLabel(fuel) })} ·{' '}
          {region ?? m.whole_province()}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-5xl font-semibold tracking-tight tabular-nums">
            {latest ? formatPrice(latest.median, locale) : '—'}
          </span>
          {trend && latest && (
            <span className="text-sm text-muted-foreground">
              <Delta cents={latest.median - first.median} />{' '}
              {m.history_since({ date: formatDay(first.at, locale) })}
            </span>
          )}
        </div>
        {history.first != null && (
          <p className="text-xs text-muted-foreground">
            {m.history_tracking({
              date: formatDay(history.first, locale),
              count: history.snapshots,
            })}
          </p>
        )}
      </div>
      {trend ? (
        <figure className="flex flex-col gap-2">
          <PriceChart
            data={points.map((p) => ({
              at: p.at,
              median: p.median,
              quebec: p.quebec,
            }))}
            series={[
              {
                key: 'median',
                label: region
                  ? m.history_region_median({ region })
                  : m.quebec_median(),
                role: 'subject',
              },
              ...(region
                ? [
                    {
                      key: 'quebec',
                      label: m.quebec_median(),
                      role: 'reference' as const,
                    },
                  ]
                : []),
            ]}
          />
          <figcaption className="text-xs text-muted-foreground">
            {region ? m.history_caption_region() : m.history_caption()}
          </figcaption>
        </figure>
      ) : (
        <p className="text-sm text-muted-foreground">{m.history_short()}</p>
      )}
    </section>
  )
}

/** Every region's median now, its move over the period and its stale count. */
export function RegionTable({
  history,
  region,
}: {
  history: PriceHistory
  region?: string
}) {
  const setSearch = useSetHistorySearch()
  const locale = getLocale()
  if (!history.regions.length) return null

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading caption={m.history_regions_caption()}>
        {m.history_regions()}
      </SectionHeading>
      <RegionChart
        regions={history.regions}
        selected={region}
        label={m.history_col_median()}
        onSelect={(r) => setSearch({ region: r === region ? undefined : r })}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.history_region()}</TableHead>
            <TableHead className="text-right">
              {m.history_col_median()}
            </TableHead>
            <TableHead className="text-right">
              {m.history_col_change()}
            </TableHead>
            <TableHead
              className="text-right"
              title={m.stale_list_caption({ days: STALE_DAYS })}
            >
              {m.history_col_stale()}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.regions.map((r) => {
            const selected = r.region === region
            return (
              <TableRow
                key={r.region}
                data-state={selected ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={() =>
                  setSearch({ region: selected ? undefined : r.region })
                }
              >
                <TableCell className="max-w-48 truncate font-medium">
                  <button
                    type="button"
                    aria-pressed={selected}
                    className="truncate text-left outline-none focus-visible:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSearch({ region: selected ? undefined : r.region })
                    }}
                  >
                    {r.region}
                  </button>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPrice(r.median, locale)}
                </TableCell>
                <TableCell className="text-right">
                  {r.startMedian == null ? (
                    '—'
                  ) : (
                    <Delta cents={r.median - r.startMedian} />
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {r.stale > 0 ? (
                    <span className="text-warning">{r.stale}</span>
                  ) : (
                    0
                  )}
                  <span className="opacity-70"> / {r.count}</span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}

/** How today's prices spread across stations, from the live feed. */
export function SpreadSection({
  fuel,
  region,
}: {
  fuel: Fuel
  region?: string
}) {
  const { data, isPending } = useQuery(stationsQueryOptions)
  const prices = data?.stations
    .filter((s) => !region || s.region === region)
    .map((s) => s.prices[fuel])
    .filter((p): p is number => p != null)
    .sort((a, b) => a - b)

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading caption={m.history_spread_caption()}>
        {m.history_spread()}
        <span className="ml-2 font-normal text-muted-foreground">
          {fuelLabel(fuel)} · {region ?? m.whole_province()}
        </span>
      </SectionHeading>
      {isPending ? (
        <Skeleton className="h-48 w-full sm:h-56" />
      ) : prices && prices.length > 0 ? (
        <DistributionChart prices={prices} label={m.history_stations_unit()} />
      ) : (
        <p className="text-sm text-muted-foreground">{m.error_loading()}</p>
      )}
    </section>
  )
}

/** Stations whose prices sat unchanged for STALE_DAYS or more. */
export function StaleList({ fuel, region }: { fuel: Fuel; region?: string }) {
  const { data } = useSuspenseQuery(staleListQueryOptions(region))
  const setSearch = useSetHistorySearch()
  const locale = getLocale()

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading caption={m.stale_list_caption({ days: STALE_DAYS })}>
        {m.stale_title()}
        {data.total > 0 && (
          <span className="ml-2 font-normal text-muted-foreground tabular-nums">
            {data.total}
          </span>
        )}
      </SectionHeading>
      {data.stations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.stale_none()}</p>
      ) : (
        <ul className="flex flex-col divide-y border-y">
          {data.stations.map((s) => {
            const price = s.prices[fuel]
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSearch({ station: s.id }, { push: true })
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {title(s)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.city || s.address}
                      {!region && ` · ${s.region}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-base font-semibold text-muted-foreground tabular-nums">
                      {price == null ? '—' : formatPrice(price, locale)}
                    </span>
                    <StaleTag days={unchangedDays(s.changedAt, s.seenAt)} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {data.total > data.stations.length && (
        <p className="text-xs text-muted-foreground">
          {m.stale_more({ count: data.total - data.stations.length })}
        </p>
      )}
    </section>
  )
}

function StationSearch() {
  const setSearch = useSetHistorySearch()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced] = useDebouncedValue(query, { wait: 250 })
  const searching = debounced.trim().length >= 2
  const { data, isFetching } = useQuery(stationSearchQueryOptions(debounced))
  const results = searching ? (data ?? []) : []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-full justify-start font-normal text-muted-foreground sm:w-96"
        >
          <IconSearch data-icon="inline-start" />
          {m.history_station_search()}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={m.history_station_search()}
          />
          <CommandList>
            {searching && !isFetching && (
              <CommandEmpty>{m.no_results()}</CommandEmpty>
            )}
            {results.map((s) => (
              <CommandItem
                key={s.id}
                value={s.id}
                onSelect={() => {
                  setSearch({ station: s.id }, { push: true })
                  setOpen(false)
                }}
                className="flex flex-col items-start gap-0"
              >
                <span className="font-medium">{title(s)}</span>
                <span className="text-xs text-muted-foreground">
                  {s.address}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Search box, and the chosen station's prices over time. */
export function StationSection({
  id,
  fuel,
  range,
}: {
  id?: string
  fuel: Fuel
  range: Range
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <SectionHeading caption={id ? undefined : m.history_station_prompt()}>
          {m.history_station()}
        </SectionHeading>
        <StationSearch />
      </div>
      {id && <StationHistoryView id={id} fuel={fuel} range={range} />}
    </section>
  )
}

function StationHistoryView({
  id,
  fuel,
  range,
}: {
  id: string
  fuel: Fuel
  range: Range
}) {
  const { data } = useSuspenseQuery(
    stationHistoryQueryOptions({ id, fuel, range }),
  )
  const locale = getLocale()
  const now = useNow()
  if (!data) {
    return (
      <p className="border p-4 text-sm text-muted-foreground">
        {m.history_station_unknown()}
      </p>
    )
  }

  const { station, before, medians, first, last } = data
  const price = station.prices[fuel]
  const gone = station.seenAt < last
  // Its prices going into the range, then each change within it.
  const changes = before ? [before, ...data.changes] : data.changes

  // The station's price at each snapshot, beside its regional median.
  let c = -1
  const points = medians.map(({ at, median }) => {
    while (c + 1 < changes.length && changes[c + 1].at <= at) c++
    const value = c < 0 || at > station.seenAt ? null : changes[c].prices[fuel]
    return { at, price: value, median }
  })
  const sold = changes.some((ch) => ch.prices[fuel] != null)

  // Only the moves of the chosen fuel within the range, newest first.
  const moves = changes
    .map((ch, i) => ({
      at: ch.at,
      price: ch.prices[fuel],
      previous: i > 0 ? changes[i - 1].prices[fuel] : undefined,
    }))
    .slice(before ? 1 : 0)
    .filter((mv) => mv.previous === undefined || mv.price !== mv.previous)
    .reverse()

  return (
    <article className="flex flex-col gap-4 border p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight break-words">
            {title(station)}
          </h3>
          <p className="text-sm text-muted-foreground break-words">
            {station.address} · {station.region}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            {fuelLabel(fuel)} · ¢/L
          </p>
          <p
            className={cn(
              'text-3xl font-semibold tracking-tight tabular-nums',
              isStale(station.changedAt, station.seenAt) &&
                'text-muted-foreground',
            )}
          >
            {price == null ? '—' : formatPrice(price, locale)}
          </p>
        </div>
      </header>

      {gone ? (
        <p className="text-sm text-muted-foreground">
          {m.history_station_gone()}
        </p>
      ) : isStale(station.changedAt, station.seenAt) ? (
        <StaleNotice
          changedAt={station.changedAt}
          seenAt={station.seenAt}
          trackedSince={first}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {(station.changedAt <= first
            ? m.prices_unchanged_since_start
            : m.prices_changed)({
            time: formatRelative(
              new Date(station.changedAt * 1000),
              locale,
              now,
            ),
          })}
        </p>
      )}

      {!sold ? (
        <p className="text-sm text-muted-foreground">
          {m.history_not_sold({ fuel: fuelLabel(fuel).toLowerCase() })}
        </p>
      ) : points.length > 1 ? (
        <PriceChart
          data={points}
          series={[
            {
              key: 'price',
              label: m.history_this_station(),
              role: 'subject',
              step: true,
            },
            {
              key: 'median',
              label: m.history_region_median({ region: station.region }),
              role: 'reference',
            },
          ]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{m.history_short()}</p>
      )}

      {sold && moves.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">{m.history_changes()}</h4>
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableBody>
                {moves.map((mv) => (
                  <TableRow key={mv.at}>
                    <TableCell className="text-muted-foreground">
                      {formatDayTime(mv.at, locale)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {mv.price == null ? '—' : formatPrice(mv.price, locale)}
                    </TableCell>
                    <TableCell className="w-28 text-right">
                      {mv.previous == null || mv.price == null ? (
                        <span className="text-xs text-muted-foreground">
                          {mv.previous === undefined
                            ? m.history_first_seen()
                            : '—'}
                        </span>
                      ) : (
                        <Delta cents={mv.price - mv.previous} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" className="self-start" asChild>
        <Link to="/" search={{ station: id, fuel }}>
          <IconMapPin data-icon="inline-start" />
          {m.history_open_station()}
        </Link>
      </Button>
    </article>
  )
}
