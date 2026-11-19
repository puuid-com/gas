import {
  QUEBEC,
  STALE_DAYS,
  DAY,
  computeRegionStats,
  rangeStart,
  samePrices,
  searchKey,
} from '#/lib/history'
import type {
  PriceHistory,
  Prices,
  Range,
  StaleStations,
  StationHistory,
  StationRecord,
  StationSummary,
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

const UPDATE_META = `
INSERT INTO history_meta (id, first_at, last_at, snapshots) VALUES (1, ?1, ?1, 1)
ON CONFLICT (id) DO UPDATE SET
  first_at = min(first_at, excluded.first_at),
  last_at = max(last_at, excluded.last_at),
  snapshots = snapshots + 1`

/**
 * Record the feed as it is now: every station's current prices, a change row
 * for each station whose prices differ from its last snapshot, the price
 * spread per region, and the snapshot count. Runs as one transaction.
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
    db.prepare(UPDATE_META).bind(at),
  ])

  return { at, stations: rows.length, changed: changes.length }
}

/** Snapshot count and first/latest times: one row, kept by takeSnapshot. */
async function snapshotRange(db: D1Database) {
  const row = await db
    .prepare(
      'SELECT first_at, last_at, snapshots FROM history_meta WHERE id = 1',
    )
    .first<{ first_at: number; last_at: number; snapshots: number }>()
  return {
    first: row?.first_at ?? null,
    last: row?.last_at ?? null,
    count: row?.snapshots ?? 0,
  }
}

interface SeriesRow {
  at: number
  count: number
  min: number
  median: number
  max: number
  stale: number
}

interface RankingRow {
  region: string
  count: number
  median: number
  stale: number
  start_median: number | null
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

  // One region per statement: naming it keeps SQLite on the (fuel, region,
  // at) key, reading only that region's rows in the range.
  const series = (key: string) =>
    db
      .prepare(
        `SELECT at, count, min, median, max, stale FROM region_stats
         WHERE fuel = ?1 AND region = ?2 AND at >= ?3 ORDER BY at`,
      )
      .bind(fuel, key, since)

  const [ranking, points, ...quebec] = await db.batch([
    // Every region at the latest snapshot (region_stats_at), each with its
    // median at the start of the range (one key lookup per region).
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
    series(target),
    ...(target === QUEBEC ? [] : [series(QUEBEC)]),
  ])

  // Province medians beside a region's, when one is selected.
  const quebecAt = new Map(
    ((quebec.at(0)?.results ?? []) as Array<SeriesRow>).map((row) => [
      row.at,
      row.median,
    ]),
  )

  return {
    first: span.first,
    last: span.last,
    snapshots: span.count,
    points: (points.results as Array<SeriesRow>).map((row) => ({
      at: row.at,
      median: row.median,
      min: row.min,
      max: row.max,
      count: row.count,
      stale: row.stale,
      quebec: target === QUEBEC ? null : (quebecAt.get(row.at) ?? null),
    })),
    regions: (ranking.results as Array<RankingRow>).map((row) => ({
      region: row.region,
      count: row.count,
      median: row.median,
      startMedian: row.start_median,
      stale: row.stale,
    })),
  }
}

/** A station's current prices and how long snapshots go back: two rows. */
export async function getStation(
  db: D1Database,
  id: string,
): Promise<StationSummary | null> {
  const [row, span] = await Promise.all([
    db
      .prepare('SELECT * FROM stations WHERE id = ?1')
      .bind(id)
      .first<StationRow>(),
    snapshotRange(db),
  ])
  if (!row) return null
  return {
    station: toRecord(row),
    first: span.first ?? row.changed_at,
    last: span.last ?? row.seen_at,
  }
}

type PriceRow = Prices & { at: number }

const toChange = (row: PriceRow) => ({ at: row.at, prices: pricesOf(row) })

/**
 * A station's prices over a range for one fuel, with its regional median
 * alongside. Reads only that range: its changes, the one before it, and the
 * region's medians, each by key.
 */
export async function getStationHistory(
  db: D1Database,
  { id, fuel, range }: { id: string; fuel: Fuel; range: Range },
): Promise<StationHistory | null> {
  const summary = await getStation(db, id)
  if (!summary) return null
  const since = rangeStart(range, summary.last)

  const [changes, before, medians] = await db.batch([
    db
      .prepare(
        `SELECT at, regular, super, diesel FROM price_changes
         WHERE station_id = ?1 AND at >= ?2 ORDER BY at`,
      )
      .bind(id, since),
    db
      .prepare(
        `SELECT at, regular, super, diesel FROM price_changes
         WHERE station_id = ?1 AND at < ?2 ORDER BY at DESC LIMIT 1`,
      )
      .bind(id, since),
    db
      .prepare(
        `SELECT at, median FROM region_stats
         WHERE fuel = ?1 AND region = ?2 AND at >= ?3 ORDER BY at`,
      )
      .bind(fuel, summary.station.region, since),
  ])
  const previous = (before.results as Array<PriceRow>).at(0)

  return {
    ...summary,
    before: previous ? toChange(previous) : null,
    changes: (changes.results as Array<PriceRow>).map(toChange),
    medians: medians.results as Array<{ at: number; median: number }>,
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
