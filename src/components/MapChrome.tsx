import { useEffect, useRef, useState } from 'react'
import { useSelector } from '@tanstack/react-store'
import { IconChartLine, IconRoute, IconX } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { AppHeader } from '#/components/AppHeader'
import { AppMenu } from '#/components/AppMenu'
import { DriveCard } from '#/components/DriveCard'
import { FuelToggle } from '#/components/FuelToggle'
import { MapControls } from '#/components/MapControls'
import { MapSearch } from '#/components/MapSearch'
import { NearbyCard } from '#/components/NearbyCard'
import { Panel } from '#/components/Panel'
import { StationDetail } from '#/components/StationDetail'
import { TripCard } from '#/components/TripCard'
import { Button } from '#/components/ui/button'
import { useAppSearch, useSetSearch } from '#/hooks/use-app-search'
import { useGeoErrorToasts } from '#/hooks/use-geo-error-toasts'
import { useStations } from '#/hooks/use-stations'
import { useTripActions } from '#/hooks/use-trip'
import { cn } from '#/lib/utils'
import { locationStore } from '#/stores/location'
import { isWide, mapStore, setPanelOpen, setPlace } from '#/stores/map'
import { m } from '#/paraglide/messages'
import type { AppSearch } from '#/routes/index'

/** Report how much of the map a floating element covers (0 when hidden). */
function useInset(
  ref: React.RefObject<HTMLElement | null>,
  edge: 'top' | 'bottom',
) {
  useEffect(() => {
    const el = ref.current
    const parent = el?.offsetParent ?? el?.parentElement
    if (!el || !parent) return
    const update = () => {
      const r = el.getBoundingClientRect()
      const p = parent.getBoundingClientRect()
      // On wide screens the sheet is a corner card, not a band across the map.
      const visible =
        !(edge === 'bottom' && isWide()) &&
        el.offsetParent !== null &&
        r.height > 0
      const value = !visible
        ? 0
        : edge === 'top'
          ? r.bottom - p.top
          : p.bottom - r.top
      mapStore.setState((s) => ({
        ...s,
        insets: { ...s.insets, [edge]: Math.max(0, value) },
      }))
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [ref, edge])
}

const CHIP =
  'h-9 min-w-0 bg-background px-3 text-[13px] shadow-md shadow-black/10 dark:bg-background'

/**
 * Everything that floats over the map, laid out like a map site: the search
 * bar and filter chips along the top, the map's own buttons bottom right, the
 * list down the left on wide screens and a sheet (a corner card on wide
 * screens) for whatever is in focus. Drive mode on a phone strips it down to
 * the menu and the drive card.
 */
export function MapChrome() {
  const { station: selected, region, to, toName, view, fuel } = useAppSearch()
  const { byId } = useStations()
  // A stale link, or a station the preferences now hide, selects nothing.
  const station = selected && byId.has(selected) ? selected : undefined
  const setSearch = useSetSearch()
  const { clear: clearTrip, setDestination } = useTripActions()
  const driving = useSelector(locationStore, (s) => s.driving)
  const panelOpen = useSelector(mapStore, (s) => s.panelOpen)
  const place = useSelector(mapStore, (s) => s.place)
  const [expanded, setExpanded] = useState(false)
  const swipe = useSheetSwipe(setExpanded)
  const headerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  useInset(headerRef, 'top')
  useInset(sheetRef, 'bottom')
  useGeoErrorToasts()

  const openList = (tab?: AppSearch['tab']) => {
    setPanelOpen(true)
    setSearch({ view: 'list', ...(tab && { tab }) }, { push: true })
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] lg:p-4">
      <div
        ref={headerRef}
        className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-4"
      >
        <MapSearch
          onOpenList={() => openList()}
          className={cn(
            'pointer-events-auto lg:w-[400px] lg:shrink-0',
            driving && 'max-lg:hidden',
          )}
        />
        <div className="flex min-w-0 items-start gap-2 lg:min-h-12 lg:flex-1 lg:items-center">
          <div className="pointer-events-auto flex min-w-0 flex-wrap items-center gap-2">
            <FuelToggle
              className={cn(
                'w-auto shadow-md shadow-black/10',
                driving && 'max-lg:hidden',
              )}
              itemClassName="flex-none bg-background px-3 dark:bg-background"
            />
            <Button
              variant="outline"
              className={cn(CHIP, driving && 'max-lg:hidden')}
              asChild
            >
              <Link to="/history" search={{ fuel }}>
                <IconChartLine data-icon="inline-start" />
                {m.price_history()}
              </Link>
            </Button>
            {region && (
              <Button
                variant="outline"
                className={CHIP}
                onClick={() => setSearch({ region: undefined })}
              >
                <span className="truncate">{region}</span>
                <IconX data-icon="inline-end" />
                <span className="sr-only">{m.whole_province()}</span>
              </Button>
            )}
            {to && (
              <Button variant="outline" className={CHIP} onClick={clearTrip}>
                <IconRoute data-icon="inline-start" />
                <span className="truncate">{toName ?? m.trip_to()}</span>
                <IconX data-icon="inline-end" />
                <span className="sr-only">{m.trip_clear()}</span>
              </Button>
            )}
            {place && !to && (
              <Button
                className={cn(CHIP, 'bg-primary dark:bg-primary')}
                onClick={() => {
                  setDestination({ ...place, id: place.name })
                  setPlace(null)
                }}
              >
                <IconRoute data-icon="inline-start" />
                <span className="truncate">
                  {m.search_trip_here({ place: place.name })}
                </span>
              </Button>
            )}
          </div>
          {driving && (
            <div className="pointer-events-auto ml-auto border bg-background shadow-md shadow-black/10 lg:hidden">
              <AppMenu
                className="size-11"
                onPlanTrip={() => openList('trip')}
              />
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-auto mt-auto self-end">
        <MapControls />
      </div>

      <div
        ref={sheetRef}
        className={cn(
          'pointer-events-auto w-full border bg-background shadow-xl shadow-black/10 lg:absolute lg:top-[4.75rem] lg:right-4 lg:w-96',
          !station && 'max-lg:touch-none',
        )}
        {...(station ? {} : swipe)}
      >
        {station ? (
          <StationDetail id={station} />
        ) : (
          <>
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? m.sheet_collapse() : m.sheet_expand()}
              className="flex h-6 w-full items-center justify-center outline-none lg:hidden"
              onClick={() => setExpanded(!expanded)}
            >
              <span className="h-1 w-9 rounded-full bg-muted-foreground/40" />
            </button>
            {driving ? (
              <DriveCard collapsed={!expanded} />
            ) : to ? (
              <TripCard
                collapsed={!expanded}
                onSeeList={() => openList('trip')}
              />
            ) : (
              <NearbyCard collapsed={!expanded} />
            )}
          </>
        )}
      </div>

      <aside
        className={cn(
          'pointer-events-auto flex-col bg-background',
          // Phones: the list takes the whole screen.
          'max-lg:absolute max-lg:inset-0 max-lg:z-20',
          view === 'list' ? 'max-lg:flex' : 'max-lg:hidden',
          // Wide screens: it floats under the search bar.
          'lg:absolute lg:top-[4.75rem] lg:bottom-4 lg:left-4 lg:w-[400px] lg:border lg:shadow-xl lg:shadow-black/10',
          panelOpen ? 'lg:flex' : 'lg:hidden',
        )}
      >
        <AppHeader className="border-b p-3 pt-[max(env(safe-area-inset-top),0.75rem)] lg:hidden" />
        <Panel />
      </aside>
    </div>
  )
}

/** Swipe up/down anywhere on the phone sheet to expand or collapse it. */
function useSheetSwipe(onChange: (expanded: boolean) => void) {
  const startY = useRef<number | null>(null)
  const swiped = useRef(false)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      startY.current = e.clientY
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (startY.current == null) return
      const dy = e.clientY - startY.current
      startY.current = null
      swiped.current = Math.abs(dy) > 24
      if (swiped.current) onChange(dy < 0)
    },
    // A swipe that ends on a station row must not also select it.
    onClickCapture: (e: React.MouseEvent) => {
      if (swiped.current) e.stopPropagation()
      swiped.current = false
    },
    onPointerCancel: () => {
      startY.current = null
    },
  }
}
