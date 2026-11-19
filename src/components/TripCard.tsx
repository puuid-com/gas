import { IconList } from '@tabler/icons-react'
import { DriveButton } from '#/components/DriveButton'
import { MapLegend } from '#/components/MapLegend'
import { RoadStrip } from '#/components/RoadStrip'
import {
  CorridorToggle,
  TripStatus,
  TripStopRow,
  corridorSummary,
  routeSummary,
} from '#/components/TripParts'
import { Button } from '#/components/ui/button'
import { useSetSearch } from '#/hooks/use-app-search'
import { useTrip } from '#/hooks/use-trip'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

const SHOWN = 3

/** The map's card while a trip is on: the cheapest stations along the route. */
export function TripCard({
  collapsed = false,
  onSeeList,
}: {
  collapsed?: boolean
  onSeeList: () => void
}) {
  const trip = useTrip()
  const setSearch = useSetSearch()
  const { along } = trip
  const top = along?.candidates.slice(0, SHOWN) ?? []
  const summary = routeSummary(trip)
  const line = trip.route.data?.line

  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-2 px-4 pt-1 lg:pt-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold tracking-tight">
            {m.trip_title({ place: trip.destinationName ?? m.trip_to() })}
          </h2>
          {summary && (
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {summary}
            </p>
          )}
        </div>
        <DriveButton />
      </div>

      <div
        className={cn(
          'flex min-h-8 items-center gap-3 px-4 pt-1.5 pb-1',
          collapsed && 'max-lg:hidden',
        )}
      >
        <CorridorToggle value={trip.corridorKm} />
        {along && (
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {corridorSummary(along)}
          </p>
        )}
      </div>

      <TripStatus trip={trip} onChooseStart={onSeeList} className="px-4" />

      {along && line && top.length > 0 && (
        // The whole drive at a glance: where on the way the low prices are.
        <RoadStrip
          stops={along.candidates.map((c) => ({
            distanceKm: c.alongKm,
            tier: along.tiers.get(c.station.id) ?? -1,
          }))}
          rangeKm={Math.max(1, line.lengthKm)}
          markKm={top[0].alongKm}
          startLabel={m.strip_start()}
          toDestination
          className="px-4 pt-1 pb-2"
        />
      )}

      {along && (
        <div className="flex flex-col">
          {top.map((stop, i) => (
            <TripStopRow
              key={stop.station.id}
              stop={stop}
              along={along}
              detours={trip.detours}
              onSelect={(id) => setSearch({ station: id })}
              className={cn('px-4', collapsed && i > 0 && 'max-lg:hidden')}
            />
          ))}
        </div>
      )}

      {along && along.candidates.length > SHOWN && (
        <Button
          variant="ghost"
          className={cn(
            'h-10 justify-start rounded-none border-t px-4 text-xs',
            collapsed && 'max-lg:hidden',
          )}
          onClick={onSeeList}
        >
          <IconList />
          {m.trip_see_list()}
        </Button>
      )}

      <MapLegend
        scope="route"
        className={cn('border-t px-4 py-2', collapsed && 'max-lg:hidden')}
      />
    </section>
  )
}
