import { IconCheck, IconRouteAltLeft, IconX } from '@tabler/icons-react'
import { DirectionsButton } from '#/components/DirectionsButton'
import { StationRow } from '#/components/StationRow'
import { TIER_BG } from '#/components/TierMark'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { useSetSearch } from '#/hooks/use-app-search'
import { useDriveAhead } from '#/hooks/use-drive'
import { useTrip, useTripActions, useTripProgress } from '#/hooks/use-trip'
import { formatCents, formatDollars, formatPrice } from '#/lib/format'
import { formatDistance } from '#/lib/geo'
import { stationTitle } from '#/lib/i18n'
import { roadBlocks } from '#/lib/pricing'
import { cn } from '#/lib/utils'
import { AHEAD_RANGES_KM, setAheadRange, stopDriving } from '#/stores/location'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { DriveView } from '#/hooks/use-drive'
import type { RatedStop } from '#/lib/pricing'
import type { AheadRangeKm } from '#/stores/location'

/** Litres in a typical fill-up, to turn cents per litre into dollars. */
const TANK_L = 50
/** Rows in the list; the road beyond them is still on the strip. */
const LISTED = 30

/**
 * Drive mode's card answers one question at a glance: stop at the next station
 * or keep going? The verdict comes first, then the two options side by side in
 * road order (nearer on the left) with the recommended one filled in.
 *
 * `collapsed` (phones only) hides the full list of stations ahead.
 */
export function DriveCard({ collapsed = false }: { collapsed?: boolean }) {
  const trip = useTrip()
  const view = useDriveAhead(trip)
  const { offRoute } = useTripProgress(trip)
  const { rerouteFromHere } = useTripActions()
  const setSearch = useSetSearch()
  const select = (id: string) => setSearch({ station: id })
  const verdict = view && verdictText(view)
  const decision = view?.decision

  return (
    <section className="flex flex-col gap-3 pb-3">
      <div className="flex items-start gap-3 px-4 pt-1 lg:pt-4">
        <div className="min-w-0 flex-1" aria-live="polite">
          {verdict ? (
            <>
              <h2 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
                {verdict.title}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                {verdict.detail}
              </p>
            </>
          ) : view ? (
            <h2 className="text-base leading-snug font-medium text-balance">
              {m.ahead_none({ distance: `${view.rangeKm} km` })}
            </h2>
          ) : (
            <h2 className="text-base leading-snug font-medium">
              {m.drive_locating()}
            </h2>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={m.drive_exit()}
          onClick={stopDriving}
        >
          <IconX />
        </Button>
      </div>

      {trip.active && offRoute && (
        <div className="flex items-center gap-2 px-4">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {m.off_route_notice()}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={rerouteFromHere}
          >
            <IconRouteAltLeft />
            {m.reroute()}
          </Button>
        </div>
      )}

      {!view && (
        <div className="grid grid-cols-2 gap-2 px-4" aria-hidden>
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {view && decision && (
        <>
          <div
            className={cn(
              'grid gap-2 px-4',
              decision.other ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            <StopTile
              stop={decision.next}
              label={view.headingKnown ? m.drive_next() : m.drive_nearest()}
              chosen={decision.verdict === 'stop'}
              versus={decision.pick}
              onSelect={select}
            />
            {decision.other && (
              <StopTile
                stop={decision.verdict === 'go' ? decision.pick : decision.other}
                label={
                  decision.verdict === 'go'
                    ? m.drive_best()
                    : m.drive_otherwise()
                }
                chosen={decision.verdict === 'go'}
                versus={decision.pick}
                onSelect={select}
              />
            )}
          </div>

          <RoadStrip view={view} className="px-4" />

          <DirectionsButton
            to={decision.pick.station}
            then={view.onRoute ? (trip.destination ?? undefined) : undefined}
            size="lg"
            className="px-4"
          />
        </>
      )}

      {view && (
        <div
          className={cn(
            'flex flex-col border-t',
            // With nothing in range the toggle is the way out: keep it in reach.
            collapsed && decision && 'max-lg:hidden',
          )}
        >
          <div className="flex items-center gap-3 px-4 pt-3 pb-1">
            <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
              {m.drive_list_title()}
            </h3>
            <RangeToggle value={view.rangeKm} />
          </div>
          <div className="max-h-[36dvh] overflow-y-auto overscroll-contain lg:max-h-[max(8rem,calc(100dvh-38rem))]">
            {view.stops.slice(0, LISTED).map((stop) => (
              <StationRow
                key={stop.station.id}
                station={stop.station}
                price={stop.price}
                tier={stop.tier}
                star={stop === decision?.pick}
                distanceKm={stop.distanceKm}
                onSelect={select}
                className="px-4"
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function verdictText(view: DriveView) {
  const { decision, headingKnown } = view
  if (!decision) return null
  const locale = getLocale()
  const range = `${view.rangeKm} km`

  if (decision.verdict === 'go') {
    const saved = m.drive_go_sub({
      amount: formatCents(decision.saving, locale),
      distance: formatDistance(decision.pick.distanceKm, locale),
    })
    const tank = m.drive_tank({
      amount: formatDollars((decision.saving * TANK_L) / 100, locale),
      litres: TANK_L,
    })
    return {
      title: headingKnown ? m.drive_go() : m.drive_near_go(),
      detail: `${saved} · ${tank}`,
    }
  }

  const { next, other } = decision
  return {
    title: headingKnown ? m.drive_fill() : m.drive_near_fill(),
    detail: !other
      ? m.drive_fill_only({ distance: range })
      : other.price < next.price
        ? m.drive_fill_close({
            amount: formatCents(next.price - other.price, locale),
            distance: formatDistance(other.distanceKm, locale),
          })
        : m.drive_fill_sub({ distance: range }),
  }
}

/** One of the two options. The recommended one is filled, the other outlined. */
function StopTile({
  stop,
  label,
  chosen,
  versus,
  onSelect,
}: {
  stop: RatedStop
  label: string
  chosen: boolean
  /** The recommended stop, to say how this one's price compares. */
  versus: RatedStop
  onSelect: (id: string) => void
}) {
  const locale = getLocale()
  const gap = stop.price - versus.price
  const delta =
    chosen || Math.abs(gap) < 0.05
      ? null
      : `${gap > 0 ? '+' : '−'}${formatCents(gap, locale)}`

  return (
    <Button
      variant={chosen ? 'default' : 'outline'}
      onClick={() => onSelect(stop.station.id)}
      className="h-auto min-w-0 flex-col items-stretch gap-1.5 p-3 text-left whitespace-normal"
    >
      <span className="flex items-center gap-1.5 text-xs font-medium">
        <span
          aria-hidden
          className={cn('size-2.5 shrink-0 rounded-full', TIER_BG[stop.tier])}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {chosen ? (
          <IconCheck aria-label={m.drive_recommended()} />
        ) : (
          delta && (
            <span className="shrink-0 font-semibold tabular-nums">{delta}</span>
          )
        )}
      </span>
      <span className="text-4xl leading-none font-bold tracking-tight tabular-nums">
        {formatPrice(stop.price, locale)}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="shrink-0 text-lg leading-none font-semibold tabular-nums">
          {formatDistance(stop.distanceKm, locale)}
        </span>
        <span className="min-w-0 truncate text-xs font-normal opacity-70">
          {stationTitle(stop.station)}
        </span>
      </span>
    </Button>
  )
}

/**
 * The road ahead in ten stretches, each in the colour of its best price, with
 * a marker where the recommended station is.
 */
function RoadStrip({
  view,
  className,
}: {
  view: DriveView
  className?: string
}) {
  const { stops, rangeKm, decision } = view
  const blocks = roadBlocks(stops, rangeKm)
  const pickAt = decision
    ? Math.min(100, (decision.pick.distanceKm / rangeKm) * 100)
    : null

  return (
    <div
      role="img"
      aria-label={m.ahead_strip({ distance: `${rangeKm} km` })}
      className={cn('flex flex-col gap-1', className)}
    >
      <div className="relative flex gap-0.5">
        {blocks.map((b) => (
          <span
            key={b.fromKm}
            className={cn(
              'h-3 flex-1',
              b.tier === -1 ? 'bg-muted' : TIER_BG[b.tier],
            )}
          />
        ))}
        {pickAt != null && (
          <span
            className="absolute -inset-y-1 w-1 -translate-x-1/2 bg-foreground ring-2 ring-background"
            style={{ left: `clamp(2px, ${pickAt}%, calc(100% - 2px))` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{m.ahead_here()}</span>
        <span>{new Intl.NumberFormat(getLocale()).format(rangeKm / 2)} km</span>
        <span>{rangeKm} km</span>
      </div>
    </div>
  )
}

function RangeToggle({ value }: { value: AheadRangeKm }) {
  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        spacing={0}
        value={String(value)}
        onValueChange={(next) =>
          next && setAheadRange(Number(next) as AheadRangeKm)
        }
        aria-label={m.drive_range_label()}
      >
        {AHEAD_RANGES_KM.map((km) => (
          <ToggleGroupItem
            key={km}
            value={String(km)}
            className="h-9 px-2.5 tabular-nums data-[state=on]:bg-foreground data-[state=on]:text-background"
          >
            {km}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <span className="text-xs text-muted-foreground">km</span>
    </div>
  )
}
