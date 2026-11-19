import { IconFlagFilled } from '@tabler/icons-react'
import { TIER_BG } from '#/components/TierMark'
import { formatDistance } from '#/lib/geo'
import { roadBlockCount, roadBlocks } from '#/lib/pricing'
import { cn } from '#/lib/utils'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { Tier } from '#/lib/pricing'

/**
 * A stretch of road as a row of blocks, each in the colour of the best price
 * on it, with a marker where the station to stop at is. The road is either the
 * next few kilometres or, on a trip, the whole drive to the destination.
 */
export function RoadStrip({
  stops,
  rangeKm,
  markKm,
  startLabel,
  toDestination = false,
  className,
}: {
  /** Stations by distance from the start of the strip. */
  stops: ReadonlyArray<{ distanceKm: number; tier: Tier | -1 }>
  rangeKm: number
  /** Where the recommended station is, when there is one. */
  markKm?: number | null
  startLabel: string
  /** The strip ends at the trip's destination. */
  toDestination?: boolean
  className?: string
}) {
  const locale = getLocale()
  const blocks = roadBlocks(stops, rangeKm, roadBlockCount(rangeKm))
  const markAt = markKm == null ? null : Math.min(100, (markKm / rangeKm) * 100)
  const end = formatDistance(rangeKm, locale)

  return (
    <div
      role="img"
      aria-label={
        toDestination
          ? m.strip_trip({ distance: end })
          : m.ahead_strip({ distance: end })
      }
      className={cn('flex flex-col gap-1.5', className)}
    >
      <div className="relative flex gap-0.5">
        {blocks.map((b) => (
          <span
            key={b.fromKm}
            className={cn(
              'h-4 flex-1',
              b.tier === -1 ? 'bg-muted' : TIER_BG[b.tier],
            )}
          />
        ))}
        {markAt != null && (
          <span
            className="absolute -inset-y-1 w-1.5 -translate-x-1/2 bg-foreground ring-2 ring-background"
            style={{ left: `clamp(3px, ${markAt}%, calc(100% - 3px))` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs font-medium text-muted-foreground tabular-nums">
        <span>{startLabel}</span>
        <span>{formatDistance(rangeKm / 2, locale)}</span>
        <span className="flex items-center gap-1">
          {toDestination && <IconFlagFilled className="size-3" />}
          {end}
        </span>
      </div>
    </div>
  )
}
