import { DirectionsButton } from '#/components/DirectionsButton'
import { TIER_BG } from '#/components/TierMark'
import { Button } from '#/components/ui/button'
import { formatDistance } from '#/lib/geo'
import { formatCents, formatPrice } from '#/lib/format'
import { stationTitle } from '#/lib/i18n'
import { AHEAD_RANGE_KM, cheaperAhead, roadBlocks } from '#/lib/pricing'
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
  const better = cheaperAhead(stops)

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
          <div className="mt-1.5 truncate text-base font-medium">
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

      {better && (
        <Button
          variant="outline"
          onClick={() => onSelect(better.station.id)}
          className="h-auto justify-start gap-3 px-3 py-2.5 text-left whitespace-normal"
        >
          <span
            aria-hidden
            className={cn('size-3 shrink-0 rounded-full', TIER_BG[better.tier])}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">
              {m.ahead_cheaper({
                distance: formatDistance(better.distanceKm, locale),
              })}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {stationTitle(better.station)}
            </span>
          </span>
          <span className="shrink-0 text-right tabular-nums">
            <span
              className={cn(
                'block text-xl leading-none font-semibold',
                TIER_TEXT[better.tier],
              )}
            >
              {formatPrice(better.price, locale)}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {m.ahead_save({
                amount: formatCents(next.price - better.price, locale),
              })}
            </span>
          </span>
        </Button>
      )}

      <RoadStrip stops={stops} />

      <DirectionsButton to={next.station} size="lg" />
    </div>
  )
}

/** The next 100 km in ten stretches, each in the colour of its best price. */
function RoadStrip({ stops }: { stops: ReadonlyArray<RatedStop> }) {
  const blocks = roadBlocks(stops)

  return (
    <div
      role="img"
      aria-label={m.ahead_strip({ distance: `${AHEAD_RANGE_KM} km` })}
      className="flex flex-col gap-1.5"
    >
      <div className="flex gap-1">
        {blocks.map((b) => (
          <span
            key={b.fromKm}
            className={cn(
              'h-4 flex-1 rounded-sm',
              b.tier === -1 ? 'bg-muted' : TIER_BG[b.tier],
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{m.ahead_here()}</span>
        <span>{AHEAD_RANGE_KM / 2} km</span>
        <span>{AHEAD_RANGE_KM} km</span>
      </div>
    </div>
  )
}
