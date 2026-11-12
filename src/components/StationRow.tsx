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
  ahead?: boolean
  size?: 'default' | 'lg'
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
  ahead,
  size = 'default',
  onSelect,
  className,
}: StationRowProps) {
  const locale = getLocale()
  const lg = size === 'lg'

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={() => onSelect(station.id)}
      className={cn(
        'flex h-auto w-full items-center justify-start gap-3 border-0 px-3 text-left whitespace-normal transition-colors outline-none hover:bg-muted/70 focus-visible:bg-muted',
        lg ? 'py-3' : 'py-2.5',
        className,
      )}
    >
      <TierBar tier={tier} />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'flex items-center gap-1.5 font-medium',
            lg ? 'text-base' : 'text-sm',
          )}
        >
          <span className="truncate">{stationTitle(station)}</span>
          {star && <RegionStar />}
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 truncate text-muted-foreground',
            lg ? 'text-sm' : 'text-xs',
          )}
        >
          {ahead && (
            <span className="font-medium text-foreground uppercase tracking-wide">
              {m.ahead()}
            </span>
          )}
          <span className="truncate">
            {subtitle ?? (station.city || station.address)}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={cn(
            'leading-none font-semibold tabular-nums tracking-tight',
            lg ? 'text-[2.75rem] font-bold' : 'text-xl',
            price == null && 'text-sm font-normal text-muted-foreground',
          )}
        >
          {price == null ? m.unavailable() : formatPrice(price, locale)}
        </div>
        {(meta != null || distanceKm != null) && (
          <div
            className={cn(
              'mt-1 tabular-nums',
              lg ? 'text-base font-medium' : 'text-xs text-muted-foreground',
            )}
          >
            {meta ?? formatDistance(distanceKm!, locale)}
          </div>
        )}
      </div>
    </Button>
  )
}
