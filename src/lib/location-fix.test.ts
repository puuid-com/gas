import { describe, expect, it } from 'vitest'
import { createFixTracker } from './location-fix'

function position(
  lng: number,
  ts: number,
  heading: number | null = null,
  speed: number | null = null,
  accuracy = 5,
): GeolocationPosition {
  return {
    coords: {
      latitude: 45,
      longitude: lng,
      accuracy,
      heading,
      speed,
      altitude: null,
      altitudeAccuracy: null,
      toJSON: () => ({}),
    },
    timestamp: ts,
    toJSON: () => ({}),
  }
}

describe('drive mode GPS course', () => {
  it('accepts a native heading even when speed is unavailable, including north', () => {
    const track = createFixTracker()
    expect(track(position(-73, 1000, 90)).heading).toBe(90)
    expect(track(position(-73, 2000, 0)).heading).toBe(0)
  })

  it('accumulates short steps to find direction when the device omits motion', () => {
    const track = createFixTracker()
    track(position(-73, 1000))
    expect(track(position(-72.9999, 2000)).heading).toBeNull()
    const east = track(position(-72.9998, 3000))
    expect(east.heading).toBeCloseTo(90, 2)
    expect(east.speed).toBeGreaterThan(3)
    track(position(-72.9999, 4000))
    expect(track(position(-73, 5000)).heading).toBeCloseTo(270, 2)
  })

  it('holds the last direction at a stop and ignores GPS jitter', () => {
    const track = createFixTracker()
    track(position(-73, 1000, 90, 10))
    expect(track(position(-73, 2000, 0, 0)).heading).toBe(90)
    expect(track(position(-72.99999, 3000)).heading).toBe(90)
  })

  it('does not infer travel inside either fix’s accuracy radius', () => {
    const track = createFixTracker()
    track(position(-73, 1000, null, null, 100))
    expect(track(position(-72.9995, 2000)).heading).toBeNull()
  })

  it('discards stale directions after a GPS gap and rejects invalid device values', () => {
    const track = createFixTracker()
    track(position(-73, 1000, 90))
    const fix = track(position(-72, 40_000, NaN, Infinity))
    expect(fix.heading).toBeNull()
    expect(fix.speed).toBeNull()
  })
})
