import { describe, expect, it } from 'vitest'
import {
  DAY,
  QUEBEC,
  computeRegionStats,
  isSnapshotHour,
  isStale,
  rangeStart,
  samePrices,
  searchKey,
  unchangedDays,
} from './history'
import type { Station } from './stations'

let n = 0
const station = (
  region: string,
  regular: number | null,
  diesel: number | null = null,
): Station => ({
  id: `s${++n}`,
  name: `S${n}`,
  brand: null,
  address: '',
  city: '',
  postalCode: '',
  region,
  lng: -73.6,
  lat: 45.5,
  prices: { regular, super: null, diesel },
})

describe('staleness', () => {
  it('flags prices unchanged for a week', () => {
    expect(isStale(0, 7 * DAY)).toBe(true)
    expect(isStale(0, 7 * DAY - 1)).toBe(false)
    expect(unchangedDays(0, 9.5 * DAY)).toBe(9)
  })
})

describe('samePrices', () => {
  it('compares every fuel, including missing ones', () => {
    const a = { regular: 170.9, super: null, diesel: 190.9 }
    expect(samePrices(a, { ...a })).toBe(true)
    expect(samePrices(a, { ...a, super: 199.9 })).toBe(false)
    expect(samePrices(a, { ...a, regular: 171.9 })).toBe(false)
  })
})

describe('rangeStart', () => {
  it('counts back from the latest snapshot', () => {
    expect(rangeStart('1w', 100 * DAY)).toBe(93 * DAY)
    expect(rangeStart('all', 100 * DAY)).toBe(0)
  })
})

describe('searchKey', () => {
  it('drops case and accents', () => {
    expect(searchKey('Énergie Saint-Jérôme')).toBe('energie saint-jerome')
  })
})

describe('computeRegionStats', () => {
  const at = 30 * DAY
  const entries = [
    { station: station('A', 170, 200), changedAt: at },
    { station: station('A', 172), changedAt: at - 10 * DAY },
    { station: station('A', 180), changedAt: at - DAY },
    { station: station('B', 160), changedAt: at - 8 * DAY },
    { station: station('B', null), changedAt: 0 },
  ]
  const rows = computeRegionStats(entries, at)
  const find = (fuel: string, region: string) =>
    rows.find((r) => r.fuel === fuel && r.region === region)

  it('summarises each region and all of Quebec', () => {
    expect(find('regular', 'A')).toEqual({
      fuel: 'regular',
      region: 'A',
      count: 3,
      min: 170,
      median: 172,
      mean: 174,
      max: 180,
      stale: 1,
    })
    expect(find('regular', QUEBEC)).toMatchObject({
      count: 4,
      min: 160,
      median: 171,
      max: 180,
      stale: 2,
    })
  })

  it('skips fuels a region does not sell', () => {
    expect(find('diesel', 'A')).toMatchObject({ count: 1, median: 200 })
    expect(find('diesel', 'B')).toBeUndefined()
    expect(find('super', QUEBEC)).toBeUndefined()
  })
})

describe('isSnapshotHour', () => {
  const at = (iso: string) => Date.parse(iso)

  it('runs at 10 AM and 10 PM Quebec time in winter', () => {
    expect(isSnapshotHour(at('2026-11-18T15:00:00Z'))).toBe(true)
    expect(isSnapshotHour(at('2026-11-19T03:00:00Z'))).toBe(true)
    expect(isSnapshotHour(at('2026-11-18T14:00:00Z'))).toBe(false)
    expect(isSnapshotHour(at('2026-11-19T02:00:00Z'))).toBe(false)
  })

  it('and in summer time', () => {
    expect(isSnapshotHour(at('2026-07-15T14:00:00Z'))).toBe(true)
    expect(isSnapshotHour(at('2026-07-16T02:00:00Z'))).toBe(true)
    expect(isSnapshotHour(at('2026-07-15T15:00:00Z'))).toBe(false)
    expect(isSnapshotHour(at('2026-07-16T03:00:00Z'))).toBe(false)
  })
})
