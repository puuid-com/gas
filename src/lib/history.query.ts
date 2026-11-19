import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import {
  fetchPriceHistory,
  fetchStaleList,
  fetchStaleStations,
  fetchStation,
  fetchStationHistory,
  fetchStationSearch,
} from './history.functions'
import type { Range } from './history'
import type { Fuel } from './stations'

// Snapshots land twice a day; nothing here goes stale quickly.
const staleTime = 10 * 60_000

export const priceHistoryQueryOptions = (input: {
  fuel: Fuel
  region?: string
  range: Range
}) =>
  queryOptions({
    queryKey: ['history', 'prices', input],
    queryFn: () => fetchPriceHistory({ data: input }),
    staleTime,
  })

/** A station's current prices and freshness, for its card on the map. */
export const stationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['history', 'station', id],
    queryFn: () => fetchStation({ data: { id } }),
    staleTime,
  })

/** A station's prices over one range, for one fuel. */
export const stationHistoryQueryOptions = (input: {
  id: string
  fuel: Fuel
  range: Range
}) =>
  queryOptions({
    queryKey: ['history', 'station-prices', input],
    queryFn: () => fetchStationHistory({ data: input }),
    staleTime,
  })

export const staleStationsQueryOptions = queryOptions({
  queryKey: ['history', 'stale'],
  queryFn: () => fetchStaleStations(),
  staleTime,
})

export const staleListQueryOptions = (region?: string) =>
  queryOptions({
    queryKey: ['history', 'stale-list', region ?? null],
    queryFn: () => fetchStaleList({ data: { region } }),
    staleTime,
  })

export const stationSearchQueryOptions = (query: string) =>
  queryOptions({
    queryKey: ['history', 'search', query],
    queryFn: () => fetchStationSearch({ data: { query } }),
    enabled: query.trim().length >= 2,
    staleTime,
    placeholderData: keepPreviousData,
  })
