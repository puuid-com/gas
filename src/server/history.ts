import {
  QUEBEC,
  STALE_DAYS,
  DAY,
  computeRegionStats,
  rangeStart,
  samePrices,
  searchKey,
} from '#/lib/history'
import { FUELS } from '#/lib/stations'
import type {
  PriceHistory,
  Prices,
  Range,
  StaleStations,
  StationHistory,
  StationRecord,
} from '#/lib/history'
import type { Fuel, StationsData } from '#/lib/stations'

// D1 access for the price history. Takes the database as an argument so the
// Worker, its cron job and the snapshot script share it.

/** Rows per JSON-bound statement, well under D1's 2 MB value limit. */
const CHUNK = 500

function chunk<T>(items: ReadonlyArray<T>, size = CHUNK) {
  const chunks: Array<Array<T>> = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

interface StationRow {
  id: string
  name: string
  brand: string | null
  address: string
  city: string
  region: string
  regular: number | null
  super: number | null
  diesel: number | null
  changed_at: number
  seen_at: number
}

const pricesOf = (row: Prices): Prices => ({
  regular: row.regular,
  super: row.super,
  diesel: row.diesel,
})

function toRecord(row: StationRow): StationRecord {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    address: row.address,
    city: row.city,
    region: row.region,
    prices: pricesOf(row),
    changedAt: row.changed_at,
    seenAt: row.seen_at,
  }
}

const UPSERT_STATIONS = `
INSERT INTO stations
  (id, name, brand, address, city, region, search, regular, super, diesel, changed_at, seen_at)
SELECT
  j.value ->> 'id', j.value ->> 'name', j.value ->> 'brand', j.value ->> 'address',
  j.value ->> 'city', j.value ->> 'region', j.value ->> 'search',
  j.value ->> 'regular', j.value ->> 'super', j.value ->> 'diesel',
  j.value ->> 'changedAt', ?2
FROM json_each(?1) AS j
WHERE true
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, brand = excluded.brand, address = excluded.address,
  city = excluded.city, region = excluded.region, search = excluded.search,
  regular = excluded.regular, super = excluded.super, diesel = excluded.diesel,
  changed_at = excluded.changed_at, seen_at = excluded.seen_at`

const INSERT_CHANGES = `
INSERT INTO price_changes (station_id, at, regular, super, diesel)
SELECT j.value ->> 'id', ?2, j.value ->> 'regular', j.value ->> 'super', j.value ->> 'diesel'
FROM json_each(?1) AS j`

const INSERT_STATS = `
INSERT INTO region_stats (fuel, region, at, count, min, median, mean, max, stale)
SELECT
  j.value ->> 'fuel', j.value ->> 'region', ?2, j.value ->> 'count', j.value ->> 'min',
  j.value ->> 'median', j.value ->> 'mean', j.value ->> 'max', j.value ->> 'stale'
FROM json_each(?1) AS j`

/**
 * Record the feed as it is now: every station's current prices, a change row
 * for each station whose prices differ from its last snapshot, and the price
 * spread per region. Runs as one transaction.
 */
export async function takeSnapshot(
  db: D1Database,
  data: StationsData,
  at = Math.floor(Date.now() / 1000),
) {
  const { results: previous } = await db
    .prepare('SELECT id, regular, super, diesel, changed_at FROM stations')
    .all<Prices & { id: string; changed_at: number }>()
  const byId = new Map(previous.map((row) => [row.id, row]))

  const entries = data.stations.map((station) => {
    const before = byId.get(station.id)
    const changed = !before || !samePrices(pricesOf(before), station.prices)
    return { station, changed, changedAt: changed ? at : before.changed_at }
  })

  const rows = entries.map(({ station: s, changedAt }) => ({
    id: s.id,
    name: s.name,
    brand: s.brand,
    address: s.address,
    city: s.city,
    region: s.region,
    search: searchKey(`${s.brand ?? ''} ${s.name} ${s.address}`),
    ...s.prices,
    changedAt,
  }))
  const changes = entries
    .filter((e) => e.changed)
    .map(({ station: s }) => ({ id: s.id, ...s.prices }))

  await db.batch([
    db
      .prepare(
        'INSERT INTO snapshots (at, generated_at, station_count) VALUES (?1, ?2, ?3)',
      )
      .bind(at, data.generatedAt, data.stations.length),
    ...chunk(rows).map((c) =>
      db.prepare(UPSERT_STATIONS).bind(JSON.stringify(c), at),
    ),
    ...chunk(changes).map((c) =>
      db.prepare(INSERT_CHANGES).bind(JSON.stringify(c), at),
    ),
    db
      .prepare(INSERT_STATS)
      .bind(JSON.stringify(computeRegionStats(entries, at)), at),
  ])

  return { at, stations: rows.length, changed: changes.length }
}

async function snapshotRange(db: D1Database) {
  const row = await db
    .prepare(
      'SELECT min(at) AS first, max(at) AS last, count(*) AS n FROM snapshots',
    )
    .first<{ first: number | null; last: number | null; n: number }>()
  return {
    first: row?.first ?? null,
    last: row?.last ?? null,
    count: row?.n ?? 0,
  }
}

/** Median and spread over time for a region (or Quebec), plus every region now. */
export async function getPriceHistory(
  db: D1Database,
  { fuel, region, range }: { fuel: Fuel; region?: string; range: Range },
): Promise<PriceHistory> {
  const span = await snapshotRange(db)
  if (span.last == null) {
    return { first: null, last: null, snapshots: 0, points: [], regions: [] }
  }
  const since = rangeStart(range, span.last)
  const target = region ?? QUEBEC

  const [series, regions] = await db.batch<{
    region: string
    at: number
    count: number
    min: number
    median: number
    max: number
    stale: number
    start_median: number | null
  }>([
    db
      .prepare(
        `SELECT region, at, count, min, median, max, stale FROM region_stats
         WHERE fuel = ?1 AND region IN (?2, ?3) AND at >= ?4 ORDER BY at`,
      )
      .bind(fuel, QUEBEC, target, since),
    db
      .prepare(
        `SELECT r.region, r.count, r.median, r.stale,
           (SELECT o.median FROM region_stats o
            WHERE o.fuel = r.fuel AND o.region = r.region AND o.at >= ?3
            ORDER BY o.at LIMIT 1) AS start_median
         FROM region_stats r
         WHERE r.fuel = ?1 AND r.at = ?2 AND r.region != ''
         ORDER BY r.median`,
      )
      .bind(fuel, span.last, since),
  ])

  const quebec = new Map<number, number>()
  for (const row of series.results) {
    if (row.region === QUEBEC) quebec.set(row.at, row.median)
  }
  const points = series.results
    .filter((row) => row.region === target)
    .map((row) => ({
      at: row.at,
      median: row.median,
      min: row.min,
      max: row.max,
      count: row.count,
      stale: row.stale,
      quebec: target === QUEBEC ? null : (quebec.get(row.at) ?? null),
    }))

  return {
    first: span.first,
    last: span.last,
    snapshots: span.count,
    points,
    regions: regions.results.map((row) => ({
      region: row.region,
      count: row.count,
      median: row.median,
      startMedian: row.start_median,
      stale: row.stale,
    })),
  }
}

/** Every price a station has had, with its regional median alongside. */
export async function getStationHistory(
  db: D1Database,
  id: string,
): Promise<StationHistory | null> {
  const row = await db
    .prepare('SELECT * FROM stations WHERE id = ?1')
    .bind(id)
    .first<StationRow>()
  if (!row) return null

  const [changes, medians, span] = await Promise.all([
    db
      .prepare(
        'SELECT at, regular, super, diesel FROM price_changes WHERE station_id = ?1 ORDER BY at',
      )
      .bind(id)
      .all<Prices & { at: number }>(),
    db
      .prepare(
        // Naming every fuel lets SQLite use the (fuel, region, at) key
        // instead of scanning the whole table, which grows every run.
        `SELECT fuel, at, median FROM region_stats
         WHERE fuel IN (${FUELS.map((_, i) => `?${i + 2}`).join(', ')}) AND region = ?1
         ORDER BY at`,
      )
      .bind(row.region, ...FUELS)
      .all<{ fuel: Fuel; at: number; median: number }>(),
    snapshotRange(db),
  ])

  const regionMedians: StationHistory['regionMedians'] = {
    regular: [],
    super: [],
    diesel: [],
  }
  for (const m of medians.results) {
    if (FUELS.includes(m.fuel)) {
      regionMedians[m.fuel].push({ at: m.at, median: m.median })
    }
  }

  return {
    station: toRecord(row),
    changes: changes.results.map((c) => ({ at: c.at, prices: pricesOf(c) })),
    regionMedians,
    first: span.first ?? row.changed_at,
    last: span.last ?? row.seen_at,
  }
}

/** Stations still in the feed whose prices haven't changed in STALE_DAYS. */
export async function getStaleStations(db: D1Database): Promise<StaleStations> {
  const { last } = await snapshotRange(db)
  if (last == null) return { asOf: null, changedAt: {} }
  const { results } = await db
    .prepare(
      'SELECT id, changed_at FROM stations WHERE seen_at = ?1 AND changed_at <= ?2',
    )
    .bind(last, last - STALE_DAYS * DAY)
    .all<{ id: string; changed_at: number }>()
  return {
    asOf: last,
    changedAt: Object.fromEntries(results.map((r) => [r.id, r.changed_at])),
  }
}

/** Stale stations with their details, longest unchanged first. */
export async function listStaleStations(
  db: D1Database,
  { region, limit = 50 }: { region?: string; limit?: number },
) {
  const { last } = await snapshotRange(db)
  if (last == null) return { total: 0, stations: [] as Array<StationRecord> }
  const where = `seen_at = ?1 AND changed_at <= ?2 ${region ? 'AND region = ?3' : ''}`
  const params = [last, last - STALE_DAYS * DAY, ...(region ? [region] : [])]
  const [count, rows] = await db.batch<StationRow & { n: number }>([
    db
      .prepare(`SELECT count(*) AS n FROM stations WHERE ${where}`)
      .bind(...params),
    db
      .prepare(
        `SELECT * FROM stations WHERE ${where} ORDER BY changed_at, id LIMIT ${Math.floor(limit)}`,
      )
      .bind(...params),
  ])
  return {
    total: count.results[0]?.n ?? 0,
    stations: rows.results.map(toRecord),
  }
}

/** Stations whose name, brand or address contain every word of the query. */
export async function searchStations(db: D1Database, query: string) {
  const words = searchKey(query).split(/\s+/).filter(Boolean).slice(0, 5)
  if (!words.length) return []
  const like = (s: string) => `%${s.replace(/[\\%_]/g, '\\$&')}%`
  const { results } = await db
    .prepare(
      `SELECT * FROM stations
       WHERE ${words.map((_, i) => `search LIKE ?${i + 1} ESCAPE '\\'`).join(' AND ')}
       ORDER BY seen_at DESC, name LIMIT 20`,
    )
    .bind(...words.map(like))
    .all<StationRow>()
  return results.map(toRecord)
}
