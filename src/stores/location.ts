import { createStore } from '@tanstack/react-store'
import { createFixTracker } from '#/lib/location-fix'
import type { LngLat } from '#/lib/geo'

export type GeoStatus =
  | 'idle'
  | 'locating'
  | 'ok'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported'

export interface Fix extends LngLat {
  /** Metres, 95 % radius as reported by the device. */
  accuracy: number
  /** Degrees clockwise from north, or null when unknown (e.g. standing still). */
  heading: number | null
  /** Metres per second, or null when unknown. */
  speed: number | null
  ts: number
}

export const RADII_KM = [5, 10, 25] as const
export type RadiusKm = (typeof RADII_KM)[number]

interface LocationState {
  status: GeoStatus
  fix: Fix | null
  /** Drive mode: continuous tracking, follow camera, screen kept on. */
  driving: boolean
  /** Camera tracks the user; cleared when they pan the map. */
  follow: boolean
  radiusKm: RadiusKm
}

const RADIUS_KEY = 'plein:radius'

function storedRadius(): RadiusKm {
  try {
    const value = Number(localStorage.getItem(RADIUS_KEY))
    if ((RADII_KM as ReadonlyArray<number>).includes(value))
      return value as RadiusKm
  } catch {
    // Ignore blocked storage.
  }
  return 10
}

export const locationStore = createStore<LocationState>({
  status: 'idle',
  fix: null,
  driving: false,
  follow: false,
  radiusKm: 10,
})

const patch = (next: Partial<LocationState>) =>
  locationStore.setState((s) => ({ ...s, ...next }))

function errorStatus(err: GeolocationPositionError): GeoStatus {
  if (err.code === err.PERMISSION_DENIED) return 'denied'
  if (err.code === err.TIMEOUT) return 'timeout'
  return 'unavailable'
}

let trackFix = createFixTracker()

function onPosition(pos: GeolocationPosition) {
  patch({ status: 'ok', fix: trackFix(pos) })
}

function onError(err: GeolocationPositionError) {
  // Keep the last good fix while driving through a dead zone.
  patch({ status: errorStatus(err) })
}

const supported = () =>
  typeof navigator !== 'undefined' && 'geolocation' in navigator

export function locateOnce(): Promise<Fix | null> {
  if (!supported()) {
    patch({ status: 'unsupported' })
    return Promise.resolve(null)
  }
  patch({ status: 'locating' })
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPosition(pos)
        resolve(locationStore.state.fix)
      },
      (err) => {
        onError(err)
        resolve(null)
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
  })
}

let watchId: number | null = null

export function startDriving() {
  if (!supported()) {
    patch({ status: 'unsupported' })
    return
  }
  if (watchId == null) {
    trackFix = createFixTracker()
    if (!locationStore.state.fix) patch({ status: 'locating' })
    watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 20_000,
    })
  }
  patch({ driving: true, follow: true })
}

export function stopDriving() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId)
  watchId = null
  patch({ driving: false, follow: false })
}

export function setFollow(follow: boolean) {
  if (locationStore.state.follow !== follow) patch({ follow })
}

export function setRadius(radiusKm: RadiusKm) {
  try {
    localStorage.setItem(RADIUS_KEY, String(radiusKm))
  } catch {
    // Ignore blocked storage.
  }
  patch({ radiusKm })
}

/** Restore preferences and, if permission was already granted, locate quietly. */
export async function initLocation() {
  patch({ radiusKm: storedRadius() })
  try {
    const permission = await navigator.permissions.query({
      name: 'geolocation',
    })
    if (permission.state === 'granted') await locateOnce()
  } catch {
    // Permissions API unavailable; wait for the user to ask.
  }
}
