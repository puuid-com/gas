import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import {
  fetchPriceHistory,
  fetchStaleList,
  fetchStaleStations,
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

export const stationHistoryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['history', 'station', id],
    queryFn: () => fetchStationHistory({ data: { id } }),
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
