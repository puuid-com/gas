import { IconRefresh } from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { z } from 'zod'
import { FuelToggleGroup } from '#/components/FuelToggle'
import {
  RegionTable,
  SpreadSection,
  StaleList,
  StationSection,
  TrendSection,
} from '#/components/history/sections'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import {
  useHistorySearch,
  useSetHistorySearch,
} from '#/hooks/use-history-search'
import { RANGES } from '#/lib/history'
import {
  priceHistoryQueryOptions,
  staleListQueryOptions,
  stationHistoryQueryOptions,
} from '#/lib/history.query'
import { FUELS } from '#/lib/stations'
import { m } from '#/paraglide/messages'
import type { Range } from '#/lib/history'

const searchDefaults = { fuel: 'regular', range: '1m' } as const

const searchSchema = z.object({
  fuel: z.enum(FUELS).default(searchDefaults.fuel).catch(searchDefaults.fuel),
  range: z
    .enum(RANGES)
    .default(searchDefaults.range)
    .catch(searchDefaults.range),
  region: z.string().max(100).optional().catch(undefined),
  station: z.string().max(200).optional().catch(undefined),
})

export type HistorySearch = z.infer<typeof searchSchema>

const ALL_REGIONS = '__all__'

export const Route = createFileRoute('/_site/history')({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(searchDefaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([
      queryClient.ensureQueryData(
        priceHistoryQueryOptions({
          fuel: deps.fuel,
          region: deps.region,
          range: deps.range,
        }),
      ),
      queryClient.ensureQueryData(staleListQueryOptions(deps.region)),
      deps.station &&
        queryClient.ensureQueryData(
          stationHistoryQueryOptions({
            id: deps.station,
            fuel: deps.fuel,
            range: deps.range,
          }),
        ),
    ]),
  head: () => ({
    meta: [{ title: `${m.history_title()} — ${m.app_name()}` }],
  }),
  pendingComponent: () => (
    <Shell>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full max-w-lg" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    </Shell>
  ),
  errorComponent: ({ reset }) => (
    <Shell>
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm">{m.error_loading()}</p>
        <Button variant="outline" onClick={reset}>
          <IconRefresh />
          {m.retry()}
        </Button>
      </div>
    </Shell>
  ),
  component: HistoryPage,
})

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-6 pb-8">
      <h1 className="-mb-6 text-2xl font-semibold tracking-tight">
        {m.history_title()}
      </h1>
      {children}
    </div>
  )
}

function HistoryPage() {
  const { fuel, range, region, station } = useHistorySearch()
  const setSearch = useSetHistorySearch()
  const { data: history } = useSuspenseQuery(
    priceHistoryQueryOptions({ fuel, region, range }),
  )

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <FuelToggleGroup
            value={fuel}
            onValueChange={(value) => setSearch({ fuel: value })}
            className="w-auto"
            itemClassName="flex-none px-3"
          />
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={range}
            onValueChange={(value) => {
              if (value) setSearch({ range: value as Range })
            }}
            aria-label={m.history_range()}
          >
            {RANGES.map((r) => (
              <ToggleGroupItem
                key={r}
                value={r}
                className="h-9 px-3 text-[13px] data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                {rangeLabel(r)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select
            value={region ?? ALL_REGIONS}
            onValueChange={(value) =>
              setSearch({
                region: value === ALL_REGIONS ? undefined : value,
              })
            }
          >
            <SelectTrigger
              className="h-9 w-full text-[13px] sm:w-56"
              aria-label={m.history_region()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_REGIONS}>{m.whole_province()}</SelectItem>
              {[...history.regions]
                .sort((a, b) => a.region.localeCompare(b.region))
                .map((r) => (
                  <SelectItem key={r.region} value={r.region}>
                    {r.region}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {station ? (
          <StationSection id={station} fuel={fuel} range={range} />
        ) : (
          <TrendSection history={history} fuel={fuel} region={region} />
        )}
      </div>

      {station && (
        <TrendSection history={history} fuel={fuel} region={region} />
      )}
      <SpreadSection fuel={fuel} region={region} />
      <RegionTable history={history} region={region} />
      {!station && history.snapshots > 0 && (
        <StationSection fuel={fuel} range={range} />
      )}
      {history.snapshots > 0 && <StaleList fuel={fuel} region={region} />}
    </Shell>
  )
}

function rangeLabel(range: Range) {
  switch (range) {
    case '1w':
      return m.range_1w()
    case '1m':
      return m.range_1m()
    case '3m':
      return m.range_3m()
    case '1y':
      return m.range_1y()
    case 'all':
      return m.range_all()
  }
}
