import { Button } from '#/components/ui/button'
import { RegionStar, TierBar } from '#/components/TierMark'
import { formatDistance } from '#/lib/geo'
import { formatPrice } from '#/lib/format'
import { stationTitle } from '#/lib/i18n'
import { cn } from '#/lib/utils'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { Tier } from '#/lib/pricing'
import type { Station } from '#/lib/stations'

interface StationRowProps {
  station: Station
  price: number | null
  tier: Tier | -1
  /** Cheapest of its group (region or route). */
  star?: boolean
  distanceKm?: number | null
  /** Replaces the town under the name. */
  subtitle?: React.ReactNode
  /** Replaces the distance under the price. */
  meta?: React.ReactNode
  onSelect: (id: string) => void
  className?: string
}

export function StationRow({
  station,
  price,
  tier,
  star,
  distanceKm,
  subtitle,
  meta,
  onSelect,
  className,
}: StationRowProps) {
  const locale = getLocale()

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={() => onSelect(station.id)}
      className={cn(
        'flex h-auto w-full items-center justify-start gap-3 border-0 px-3 py-2.5 text-left whitespace-normal transition-colors outline-none hover:bg-muted/70 focus-visible:bg-muted',
        className,
      )}
    >
      <TierBar tier={tier} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{stationTitle(station)}</span>
          {star && <RegionStar />}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {subtitle ?? (station.city || station.address)}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={cn(
            'text-xl leading-none font-semibold tracking-tight tabular-nums',
            price == null && 'text-sm font-normal text-muted-foreground',
          )}
        >
          {price == null ? m.unavailable() : formatPrice(price, locale)}
        </div>
        {(meta != null || distanceKm != null) && (
          <div className="mt-1 text-xs text-muted-foreground tabular-nums">
            {meta ?? formatDistance(distanceKm!, locale)}
          </div>
        )}
      </div>
    </Button>
  )
}
