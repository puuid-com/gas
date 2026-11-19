import { useSuspenseQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { stationsQueryOptions } from '#/lib/stations.query'
import { computeFuelStats } from '#/lib/pricing'
import { prefsStore } from '#/stores/prefs'
import type { FuelStats } from '#/lib/pricing'
import type { Fuel, Station, StationsData } from '#/lib/stations'

export interface IndexedStations extends StationsData {
  byId: Map<string, Station>
}

function indexStations(data: StationsData): IndexedStations {
  return { ...data, byId: new Map(data.stations.map((s) => [s.id, s])) }
}

const membersOnly = (s: Station) => /costco/i.test(s.brand ?? s.name)

function indexPublicStations(data: StationsData): IndexedStations {
  return indexStations({
    ...data,
    stations: data.stations.filter((s) => !membersOnly(s)),
  })
}

/** Every station the user can fill up at, per their preferences. */
export function useStations() {
  const costco = useSelector(prefsStore, (s) => s.costco)
  return useSuspenseQuery({
    ...stationsQueryOptions,
    // Stable functions, so the selection is only recomputed with the data.
    select: costco ? indexStations : indexPublicStations,
  }).data
}

// Stats are shared by the map, list and panels; compute once per dataset.
const statsCache = new WeakMap<ReadonlyArray<Station>, Map<Fuel, FuelStats>>()

export function getFuelStats(stations: ReadonlyArray<Station>, fuel: Fuel) {
  let perFuel = statsCache.get(stations)
  if (!perFuel) statsCache.set(stations, (perFuel = new Map()))
  let stats = perFuel.get(fuel)
  if (!stats) perFuel.set(fuel, (stats = computeFuelStats(stations, fuel)))
  return stats
}

export function useFuelStats(fuel: Fuel) {
  return getFuelStats(useStations().stations, fuel)
}
