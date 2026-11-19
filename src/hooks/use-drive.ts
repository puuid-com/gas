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
import type { TripRange } from '#/stores/location'

export interface DriveView {
  /** Stations ahead within range, nearest first, tiered against each other. */
  stops: Array<RatedStop>
  /** Null when nothing is in range. */
  decision: StopDecision<RatedStop> | null
  /** False until a course is known: `stops` are then simply the nearest. */
  headingKnown: boolean
  /** Following the planned route, so distances are along it. */
  onRoute: boolean
  /** How far ahead `stops` reach, in km: never past the destination. */
  rangeKm: number
  /** The range ends at the trip's destination rather than at a set distance. */
  toDestination: boolean
  /** What the range toggle is set to. */
  range: TripRange
}

/**
 * Drive mode's read of the road: what's ahead and where to fill up. On a trip
 * it follows the route and looks all the way to the destination; otherwise, or
 * once off the route, a set distance in the direction of travel.
 * Null when not driving or not located yet.
 */
export function useDriveAhead(trip: Trip): DriveView | null {
  const { stations } = useStations()
  const { fuel, region } = useAppSearch()
  const driving = useSelector(locationStore, (s) => s.driving)
  const fix = useSelector(locationStore, (s) => s.fix)
  const aheadKm = useSelector(locationStore, (s) => s.aheadKm)
  const tripRange = useSelector(locationStore, (s) => s.tripRange)
  const { travelledKm } = useTripProgress(trip)
  if (!driving || !fix) return null

  const { along } = trip
  const line = trip.route.data?.line
  const onRoute = along != null && line != null && travelledKm != null
  if (onRoute) {
    const remainingKm = Math.max(0, line.lengthKm - travelledKm)
    const limit = tripRange === 'trip' ? Infinity : tripRange
    const toDestination = limit >= remainingKm
    // Never zero, so the last metres still have a road to draw.
    const rangeKm = Math.max(1, Math.min(limit, remainingKm))
    const stops = rateAhead(stationsAheadOnRoute(along, travelledKm, rangeKm))
    return {
      stops,
      decision: decideStop(stops),
      headingKnown: true,
      onRoute,
      rangeKm,
      toDestination,
      range: tripRange,
    }
  }

  const pool =
    region && !trip.active
      ? stations.filter((s) => s.region === region)
      : stations
  const stops = rateAhead(
    stationsAheadByHeading(pool, fuel, fix, fix.heading, aheadKm),
  )
  return {
    stops,
    decision: decideStop(stops),
    headingKnown: fix.heading != null,
    onRoute,
    rangeKm: aheadKm,
    toDestination: false,
    range: aheadKm,
  }
}
