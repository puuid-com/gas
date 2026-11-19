import { median } from './pricing'
import { FUELS } from './stations'
import type { Fuel, Station } from './stations'

/** Snapshot times are unix seconds. */
export const DAY = 86_400

/**
 * Prices that haven't moved in this long were probably not updated: retail
 * prices in Quebec usually change several times a week.
 */
export const STALE_DAYS = 7

/**
 * Snapshots are taken at these hours, Quebec time: the daytime price, after
 * the overnight increases, and the evening low, after stations cut prices.
 */
const SNAPSHOT_HOURS = [10, 22]

const quebecHour = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  hour: 'numeric',
  hourCycle: 'h23',
})

/** Whether a cron firing (ms) falls on a snapshot hour in Quebec, DST included. */
export function isSnapshotHour(ms: number) {
  return SNAPSHOT_HOURS.includes(Number(quebecHour.format(ms)))
}

/** Region key for province-wide stats. */
export const QUEBEC = ''

export const RANGES = ['1w', '1m', '3m', '1y', 'all'] as const
export type Range = (typeof RANGES)[number]

const RANGE_DAYS: Record<Range, number | null> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '1y': 365,
  all: null,
}

/** Earliest snapshot time a range covers, as of `now` (seconds). */
export function rangeStart(range: Range, now: number) {
  const days = RANGE_DAYS[range]
  return days == null ? 0 : now - days * DAY
}

/** Whole days a station's prices stayed the same, as of the latest snapshot. */
export function unchangedDays(changedAt: number, seenAt: number) {
  return Math.floor((seenAt - changedAt) / DAY)
}

export function isStale(changedAt: number, seenAt: number) {
  return seenAt - changedAt >= STALE_DAYS * DAY
}

export type Prices = Record<Fuel, number | null>

export function samePrices(a: Prices, b: Prices) {
  return FUELS.every((f) => a[f] === b[f])
}

/** "Station du Coin, Saint-Jérôme" → "station du coin, saint-jerome" */
export function searchKey(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export interface SnapshotStation {
  station: Station
  /** When its current prices first appeared. */
  changedAt: number
}

export interface RegionStatRow {
  fuel: Fuel
  region: string
  count: number
  min: number
  median: number
  mean: number
  max: number
  stale: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Price spread per fuel, for every region and for all of Quebec. */
export function computeRegionStats(
  entries: ReadonlyArray<SnapshotStation>,
  at: number,
): Array<RegionStatRow> {
  const rows: Array<RegionStatRow> = []
  for (const fuel of FUELS) {
    const groups = new Map<string, { prices: Array<number>; stale: number }>()
    for (const { station, changedAt } of entries) {
      const price = station.prices[fuel]
      if (price == null) continue
      const stale = isStale(changedAt, at) ? 1 : 0
      for (const region of [QUEBEC, station.region]) {
        const group = groups.get(region)
        if (group) {
          group.prices.push(price)
          group.stale += stale
        } else groups.set(region, { prices: [price], stale })
      }
    }
    for (const [region, { prices, stale }] of groups) {
      prices.sort((a, b) => a - b)
      rows.push({
        fuel,
        region,
        count: prices.length,
        min: prices[0],
        median: median(prices),
        mean: round2(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        max: prices[prices.length - 1],
        stale,
      })
    }
  }
  return rows
}

/** Shapes returned by the history server functions. */

interface HistoryPoint {
  at: number
  median: number
  min: number
  max: number
  count: number
  stale: number
  /** Province median at the same snapshot, when a region is selected. */
  quebec: number | null
}

interface RegionSummary {
  region: string
  count: number
  median: number
  /** Median at the first snapshot in the range. */
  startMedian: number | null
  stale: number
}

export interface PriceHistory {
  /** First and latest snapshot times; null before the first run. */
  first: number | null
  last: number | null
  snapshots: number
  points: Array<HistoryPoint>
  regions: Array<RegionSummary>
}

export interface StationRecord {
  id: string
  name: string
  brand: string | null
  address: string
  city: string
  region: string
  prices: Prices
  changedAt: number
  seenAt: number
}

interface PriceChange {
  at: number
  prices: Prices
}

export interface StationSummary {
  station: StationRecord
  /** First and latest snapshot times. */
  first: number
  last: number
}

/** A station over one range, for one fuel. */
export interface StationHistory extends StationSummary {
  /** Its prices going into the range; null if first seen within it. */
  before: PriceChange | null
  /** Every distinct set of prices within the range, oldest first. */
  changes: Array<PriceChange>
  /** Its regional median for the fuel at each snapshot in the range. */
  medians: Array<{ at: number; median: number }>
}

export interface StaleStations {
  /** Latest snapshot time; null before the first run. */
  asOf: number | null
  /** Station id → when its prices last changed. */
  changedAt: Record<string, number>
}
