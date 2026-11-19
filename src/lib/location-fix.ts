import { bearingDeg, distanceKm } from './geo'
import type { Fix } from '#/stores/location'

/** Keep a movement anchor so frequent, short GPS steps still yield a course. */
export function createFixTracker() {
  let anchor: Fix | null = null
  let previous: Fix | null = null

  return (pos: GeolocationPosition): Fix => {
    const {
      latitude: lat,
      longitude: lng,
      accuracy,
      heading,
      speed,
    } = pos.coords
    const fresh = previous != null && pos.timestamp - previous.ts <= 30_000
    if (!fresh) anchor = null
    const validHeading =
      heading != null &&
      Number.isFinite(heading) &&
      heading >= 0 &&
      heading < 360
    const validSpeed = speed != null && Number.isFinite(speed) && speed >= 0
    const next: Fix = {
      lat,
      lng,
      accuracy,
      ts: pos.timestamp,
      speed: validSpeed ? speed : null,
      // Ignore a device's noisy compass course at a standstill.
      heading:
        validHeading && (!validSpeed || speed >= 1)
          ? heading
          : fresh
            ? previous!.heading
            : null,
    }

    if (anchor) {
      const metres = distanceKm(anchor, next) * 1000
      const seconds = (next.ts - anchor.ts) / 1000
      if (seconds > 0 && metres > Math.max(15, anchor.accuracy, accuracy)) {
        if (next.speed == null) next.speed = metres / seconds
        if (!validHeading && next.speed >= 1)
          next.heading = bearingDeg(anchor, next)
        anchor = next
      }
    } else {
      anchor = next
    }
    // Keep nearby ranking responsive between course-anchor updates.
    if (next.speed == null && fresh && previous && next.ts > previous.ts) {
      next.speed =
        (distanceKm(previous, next) * 1_000_000) / (next.ts - previous.ts)
    }
    previous = next
    return next
  }
}

/** ~25 km/h: faster than a walk or a jog, slow enough for city traffic. */
const DRIVING_MPS = 7
/** Network-based positions jump around; only GPS-grade fixes count. */
const DRIVING_ACCURACY_M = 50
/** Ground to cover at that speed before it counts as a drive. */
const DRIVING_RUN_M = 60

/**
 * True once the device has kept up car speed over real ground: an unbroken
 * run of fast fixes that ends well outside where it began. A jittery position
 * can fake a speed, but not a distance.
 */
export function createDriveDetector() {
  let origin: Fix | null = null
  return (fix: Fix) => {
    const fast =
      fix.speed != null &&
      fix.speed >= DRIVING_MPS &&
      fix.accuracy <= DRIVING_ACCURACY_M
    if (!fast) {
      origin = null
      return false
    }
    origin ??= fix
    const needed = Math.max(
      DRIVING_RUN_M,
      2 * Math.max(origin.accuracy, fix.accuracy),
    )
    return distanceKm(origin, fix) * 1000 >= needed
  }
}
