import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { rankItem, rankings } from '@tanstack/match-sorter-utils'
import { Command as CommandPrimitive } from 'cmdk'
import { useMap } from 'react-map-gl/maplibre'
import {
  IconGasStation,
  IconLayoutSidebar,
  IconList,
  IconLoader2,
  IconMapPin,
  IconX,
} from '@tabler/icons-react'
import { Logo } from '#/components/AppHeader'
import { AppMenu } from '#/components/AppMenu'
import { MAP_ID } from '#/components/map/StationMap'
import { SavedPlaces, useHasSavedPlaces } from '#/components/SavedPlaces'
import { Button } from '#/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { useAppSearch, useSetSearch } from '#/hooks/use-app-search'
import { useStations } from '#/hooks/use-stations'
import { useTripActions } from '#/hooks/use-trip'
import { formatPrice } from '#/lib/format'
import { distanceKm } from '#/lib/geo'
import { stationTitle } from '#/lib/i18n'
import { placesQueryOptions } from '#/lib/trip.query'
import { cn } from '#/lib/utils'
import { locationStore, setFollow } from '#/stores/location'
import { mapPadding, mapStore, setPanelOpen, setPlace } from '#/stores/map'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { LngLat } from '#/lib/geo'
import type { Place } from '#/lib/places'
import type { Station } from '#/lib/stations'

const STATIONS_SHOWN = 4
/** Close enough to read a town's stations, far enough to see them all. */
const PLACE_ZOOM = 12

/**
 * Stations matching every word, nearest to `near` first. `byName` says a brand
 * or name matched, not just a street: "costco" means the stations, while
 * "sherbrooke" more likely means the city than rue Sherbrooke.
 */
function findStations(
  stations: ReadonlyArray<Station>,
  text: string,
  near: LngLat | null,
) {
  const words = text.split(/\s+/)
  const matches = (haystack: string) =>
    words.every(
      (word) =>
        rankItem(haystack, word, { threshold: rankings.CONTAINS }).passed,
    )
  const names = (s: Station) => `${stationTitle(s)} ${s.name}`
  const hits = stations.filter((s) =>
    matches(`${names(s)} ${s.address} ${s.postalCode}`),
  )
  if (near) {
    const far = new Map(hits.map((s) => [s, distanceKm(near, s)]))
    hits.sort((a, b) => far.get(a)! - far.get(b)!)
  }
  const shown = hits.slice(0, STATIONS_SHOWN)
  return { hits: shown, byName: shown.some((s) => matches(names(s))) }
}

/**
 * The map's search bar: type a town or an address to move the map there, or a
 * station to open it. Before anything is typed it offers the addresses
 * navigated to before, one tap from a trip. Also carries the list toggle and
 * the menu.
 */
export function MapSearch({
  onOpenList,
  className,
}: {
  /** Phones: open the full-screen list. */
  onOpenList: () => void
  className?: string
}) {
  const locale = getLocale()
  const map = useMap()[MAP_ID]
  const { stations } = useStations()
  const { fuel } = useAppSearch()
  const setSearch = useSetSearch()
  const { setDestination } = useTripActions()
  const hasSaved = useHasSavedPlaces()
  const fix = useSelector(locationStore, (s) => s.fix)
  const place = useSelector(mapStore, (s) => s.place)
  const panelOpen = useSelector(mapStore, (s) => s.panelOpen)
  const inputRef = useRef<HTMLInputElement>(null)
  // null while not editing, so the bar shows the place it went to.
  const [query, setQuery] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const [debounced] = useDebouncedValue(query ?? '', { wait: 250 })
  const places = useQuery(placesQueryOptions(debounced, locale, fix))

  const text = (query ?? '').trim()
  const searching = text.length >= 2
  const found = useMemo(() => {
    if (!searching) return null
    const center = map?.getCenter()
    return findStations(stations, text, fix ?? center ?? null)
  }, [searching, stations, text, fix, map])
  const stationHits = found?.hits ?? []
  const placeHits = searching ? (places.data ?? []) : []
  const settled = searching && !places.isFetching && debounced === query
  const empty = stationHits.length === 0 && placeHits.length === 0

  const done = () => {
    setQuery(null)
    inputRef.current?.blur()
  }

  const goToPlace = (target: Place) => {
    done()
    setPlace({
      lng: target.lng,
      lat: target.lat,
      name: target.name,
      detail: target.detail,
    })
    setFollow(false)
    setSearch({ station: undefined, region: undefined, view: 'map' })
    map?.flyTo({
      center: [target.lng, target.lat],
      zoom: PLACE_ZOOM,
      padding: mapPadding(),
      duration: 1200,
    })
  }

  const openStation = (station: Station) => {
    done()
    setSearch({ station: station.id, view: 'map' })
  }

  /** A saved address is somewhere to drive to: go straight to the trip. */
  const tripTo = (target: Place) => {
    done()
    setPlace(null)
    setDestination(target)
  }

  return (
    <Command
      shouldFilter={false}
      loop
      className={cn(
        'relative size-auto overflow-visible bg-transparent',
        className,
      )}
    >
      <div className="flex h-12 items-center border bg-background pr-1 pl-3 shadow-lg shadow-black/10 focus-within:border-ring">
        <Logo />
        <CommandPrimitive.Input
          ref={inputRef}
          aria-label={m.search_map_placeholder()}
          placeholder={m.search_map_placeholder()}
          value={query ?? place?.name ?? ''}
          onValueChange={setQuery}
          onFocus={(e) => {
            setFocused(true)
            // Coming back to the window refocuses the field: keep the draft.
            if (query != null) return
            setQuery(place?.name ?? '')
            const input = e.currentTarget
            requestAnimationFrame(() => input.select())
          }}
          onBlur={() => {
            setFocused(false)
            if (document.hasFocus()) setQuery(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') inputRef.current?.blur()
          }}
          className="h-full min-w-0 flex-1 truncate bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        {focused && places.isFetching && (
          <IconLoader2 className="mx-2 size-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        {(place || text) && (
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            aria-label={m.search_clear()}
            // Keep focus in the field so clearing doesn't close the keyboard.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setPlace(null)
              setQuery(focused ? '' : null)
            }}
          >
            <IconX />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-10 lg:hidden"
          aria-label={m.view_list()}
          onClick={onOpenList}
        >
          <IconList />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-10 lg:inline-flex"
          aria-label={panelOpen ? m.panel_hide() : m.panel_show()}
          aria-pressed={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <IconLayoutSidebar />
        </Button>
        <AppMenu className="size-10" />
      </div>

      {focused && !searching && hasSaved && (
        <CommandList
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-[min(26rem,60dvh)] border bg-popover shadow-lg shadow-black/10"
        >
          <CommandGroup heading={m.search_saved()}>
            <SavedPlaces onSelect={tripTo} />
          </CommandGroup>
        </CommandList>
      )}

      {focused && searching && (
        <CommandList
          // Keep focus in the input so a tap selects before blur closes the list.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-[min(26rem,60dvh)] border bg-popover shadow-lg shadow-black/10 **:[[cmdk-list-sizer]]:flex **:[[cmdk-list-sizer]]:flex-col"
        >
          {placeHits.length > 0 && (
            <CommandGroup heading={m.search_places()}>
              {placeHits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={`place:${hit.id}`}
                  onSelect={() => goToPlace(hit)}
                  className="py-2"
                >
                  <IconMapPin className="text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{hit.name}</div>
                    {hit.detail && (
                      <div className="truncate text-xs text-muted-foreground">
                        {hit.detail}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {stationHits.length > 0 && (
            <CommandGroup
              heading={m.tab_stations()}
              className={found?.byName ? 'order-first' : undefined}
            >
              {stationHits.map((station) => {
                const price = station.prices[fuel]
                return (
                  <CommandItem
                    key={station.id}
                    value={`station:${station.id}`}
                    onSelect={() => openStation(station)}
                    className="py-2"
                  >
                    <IconGasStation className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        {stationTitle(station)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {station.address}
                      </div>
                    </div>
                    {price != null && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatPrice(price, locale)}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
          {empty && !settled && (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {m.places_searching()}
            </p>
          )}
          {empty && settled && (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {places.isError ? m.places_failed() : m.no_results()}
            </p>
          )}
        </CommandList>
      )}
    </Command>
  )
}
