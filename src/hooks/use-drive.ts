import { useSelector } from '@tanstack/react-store'
import { useAppSearch } from '#/hooks/use-app-search'
import { useStations } from '#/hooks/use-stations'
import { useTripProgress } from '#/hooks/use-trip'
import {
  decideStop,
  rateAhead,
  stationsAheadByHeading,
  stationsAheadOnRoute,
} from '#/lib/pricing'
import { locationStore } from '#/stores/location'
import type { Trip } from '#/hooks/use-trip'
import type { RatedStop, StopDecision } from '#/lib/pricing'
import type { AheadRangeKm } from '#/stores/location'

export interface DriveView {
  /** Stations ahead within range, nearest first, tiered against each other. */
  stops: Array<RatedStop>
  /** Null when nothing is in range. */
  decision: StopDecision<RatedStop> | null
  /** False until a course is known: `stops` are then simply the nearest. */
  headingKnown: boolean
  /** Following the planned route, so distances are along it. */
  onRoute: boolean
  rangeKm: AheadRangeKm
}

/**
 * Drive mode's read of the road: what's ahead and where to fill up. On a trip
 * it follows the route; otherwise, or once off it, the direction of travel.
 * Null when not driving or not located yet.
 */
export function useDriveAhead(trip: Trip): DriveView | null {
  const { stations } = useStations()
  const { fuel, region } = useAppSearch()
  const driving = useSelector(locationStore, (s) => s.driving)
  const fix = useSelector(locationStore, (s) => s.fix)
  const rangeKm = useSelector(locationStore, (s) => s.aheadKm)
  const { travelledKm } = useTripProgress(trip)
  if (!driving || !fix) return null

  const { along } = trip
  const onRoute = along != null && travelledKm != null
  const pool =
    region && !trip.active
      ? stations.filter((s) => s.region === region)
      : stations
  const stops = rateAhead(
    onRoute
      ? stationsAheadOnRoute(along, travelledKm, rangeKm)
      : stationsAheadByHeading(pool, fuel, fix, fix.heading, rangeKm),
  )

  return {
    stops,
    decision: decideStop(stops),
    headingKnown: onRoute || fix.heading != null,
    onRoute,
    rangeKm,
  }
}
