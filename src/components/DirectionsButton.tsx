import { useSelector } from '@tanstack/react-store'
import { IconNavigation } from '@tabler/icons-react'
import { Button } from '#/components/ui/button'
import { directionsUrl, navAppLabel, supportsStops } from '#/lib/directions'
import { cn } from '#/lib/utils'
import { prefsStore } from '#/stores/prefs'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { LngLat } from '#/lib/geo'

const SIZES = {
  default: { button: 'h-10 text-[13px]', icon: 'size-4' },
  lg: { button: 'h-14 gap-2.5 text-base', icon: 'size-5' },
  xl: { button: 'h-16 gap-3 text-lg', icon: 'size-6' },
}

/**
 * One tap hands the station to the navigation app: Waze, unless another one
 * was chosen in the menu.
 */
export function DirectionsButton({
  to,
  then,
  size = 'default',
  className,
}: {
  to: LngLat
  /** On a trip: stop at `to` on the way here, where the app allows it. */
  then?: LngLat
  size?: keyof typeof SIZES
  className?: string
}) {
  const app = useSelector(prefsStore, (s) => s.navApp)
  const asStop = then != null && supportsStops(app)

  return (
    <Button asChild className={cn('w-full', SIZES[size].button, className)}>
      <a
        href={directionsUrl(app, to, then)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <IconNavigation className={SIZES[size].icon} />
        {asStop ? m.directions_stop() : m.directions()}
        <span className="font-normal opacity-70">
          · {navAppLabel(app, getLocale())}
        </span>
      </a>
    </Button>
  )
}
