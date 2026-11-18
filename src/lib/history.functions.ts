import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDb } from '#/server/db.server'
import {
  getPriceHistory,
  getStaleStations,
  getStationHistory,
  listStaleStations,
  searchStations,
} from '#/server/history'
import { RANGES } from './history'
import { FUELS } from './stations'

const region = z.string().max(100).optional()

export const fetchPriceHistory = createServerFn({ method: 'GET' })
  .validator(z.object({ fuel: z.enum(FUELS), region, range: z.enum(RANGES) }))
  .handler(({ data }) => getPriceHistory(getDb(), data))

export const fetchStationHistory = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1).max(200) }))
  .handler(({ data }) => getStationHistory(getDb(), data.id))

export const fetchStaleStations = createServerFn({ method: 'GET' }).handler(
  () => getStaleStations(getDb()),
)

export const fetchStaleList = createServerFn({ method: 'GET' })
  .validator(z.object({ region }))
  .handler(({ data }) => listStaleStations(getDb(), data))

export const fetchStationSearch = createServerFn({ method: 'GET' })
  .validator(z.object({ query: z.string().max(100) }))
  .handler(({ data }) => searchStations(getDb(), data.query))
