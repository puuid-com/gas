import { DirectionsButton } from '#/components/DirectionsButton'
import { TIER_BG } from '#/components/TierMark'
import { Button } from '#/components/ui/button'
import { formatDistance } from '#/lib/geo'
import { formatPrice } from '#/lib/format'
import { stationTitle } from '#/lib/i18n'
import { AHEAD_RANGE_KM, roadSegments } from '#/lib/pricing'
import { cn } from '#/lib/utils'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { AheadStop, Tier } from '#/lib/pricing'

export interface RatedStop extends AheadStop {
  tier: Tier | -1
}

const TIER_TEXT: Record<Tier | -1, string> = {
  [-1]: 'text-muted-foreground',
  0: 'text-tier-0',
  1: 'text-tier-1',
  2: 'text-foreground',
  3: 'text-tier-3',
  4: 'text-tier-4',
}

const TIER_LABEL: Record<Tier | -1, () => string> = {
  [-1]: () => '',
  0: m.tier_0,
  1: m.tier_1,
  2: m.tier_2,
  3: m.tier_3,
  4: m.tier_4,
}

/**
 * Drive mode: the closest station in the direction of travel, big enough to
 * read at a glance, and the next 100 km coloured by price.
 */
export function DriveAhead({
  stops,
  headingKnown,
  onSelect,
  className,
}: {
  /** Nearest first. */
  stops: ReadonlyArray<RatedStop>
  /** False: no course yet, so `stops` are simply the nearest. */
  headingKnown: boolean
  onSelect: (id: string) => void
  className?: string
}) {
  const locale = getLocale()
  const next = stops.at(0)

  if (!next) {
    return (
      <p className={cn('py-3 text-sm text-muted-foreground', className)}>
        {m.ahead_none({ distance: `${AHEAD_RANGE_KM} km` })}
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3 py-3', className)}>
      <Button
        variant="ghost"
        onClick={() => onSelect(next.station.id)}
        className="-mx-2 h-auto items-stretch justify-start gap-3 px-2 py-1 text-left whitespace-normal"
      >
        <span
          aria-hidden
          className={cn('w-1.5 shrink-0 rounded-full', TIER_BG[next.tier])}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {headingKnown ? m.ahead_closest() : m.ahead_nearest()}
          </div>
          <div className="text-5xl leading-none font-bold tracking-tight tabular-nums">
            {formatDistance(next.distanceKm, locale)}
          </div>
          <div className="mt-1.5 truncate text-sm font-medium">
            {stationTitle(next.station)}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-end">
          <div
            className={cn(
              'text-3xl leading-none font-semibold tracking-tight tabular-nums',
              TIER_TEXT[next.tier],
            )}
          >
            {formatPrice(next.price, locale)}
          </div>
          {next.tier !== -1 && (
            <div
              className={cn('mt-1 text-xs font-medium', TIER_TEXT[next.tier])}
            >
              {TIER_LABEL[next.tier]()}
            </div>
          )}
        </div>
      </Button>

      <RoadStrip stops={stops} currentId={next.station.id} />

      <DirectionsButton to={next.station} size="lg" />
    </div>
  )
}

/** 0–100 km ahead; each stretch takes the colour of its closest station. */
function RoadStrip({
  stops,
  currentId,
}: {
  stops: ReadonlyArray<RatedStop>
  currentId: string
}) {
  const segments = roadSegments(stops)
  const pct = (km: number) =>
    `${(Math.min(km, AHEAD_RANGE_KM) / AHEAD_RANGE_KM) * 100}%`
  const current = stops.find((s) => s.station.id === currentId)

  return (
    <div aria-label={m.ahead_strip({ distance: `${AHEAD_RANGE_KM} km` })}>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        {segments.map((seg) => (
          <span
            key={seg.fromKm}
            className={cn('absolute inset-y-0', TIER_BG[seg.tier])}
            style={{ left: pct(seg.fromKm), width: pct(seg.toKm - seg.fromKm) }}
          />
        ))}
        {stops.map((s) => (
          <span
            key={s.station.id}
            aria-hidden
            className="absolute inset-y-0 w-px bg-background/70"
            style={{ left: pct(s.distanceKm) }}
          />
        ))}
      </div>
      <div className="relative h-3">
        {current && (
          <span
            aria-hidden
            className="absolute top-0.5 size-0 -translate-x-1/2 border-x-[6px] border-b-[7px] border-x-transparent border-b-foreground"
            style={{ left: pct(current.distanceKm) }}
          />
        )}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>0 km</span>
        <span>{AHEAD_RANGE_KM / 2} km</span>
        <span>{AHEAD_RANGE_KM} km</span>
      </div>
    </div>
  )
}
