import { createStore } from '@tanstack/react-store'
import { z } from 'zod'
import type { LngLat } from '#/lib/geo'
import type { Place } from '#/lib/places'

/** An address the user has navigated to or from, kept on this device. */
export interface SavedPlace extends LngLat {
  name: string
  detail: string
}

const KEY = 'plein:places'
const MAX = 8

const savedSchema = z.array(
  z.object({
    name: z.string().min(1).max(120),
    detail: z.string().max(200).catch(''),
    lng: z.number().min(-180).max(180),
    lat: z.number().min(-90).max(90),
  }),
)

function stored(): Array<SavedPlace> {
  try {
    const parsed = savedSchema.safeParse(
      JSON.parse(localStorage.getItem(KEY) ?? '[]'),
    )
    return parsed.success ? parsed.data.slice(0, MAX) : []
  } catch {
    // No storage (server render, private mode) or a corrupt entry.
    return []
  }
}

export const placesStore = createStore<{
  /** Most recently used first. */
  saved: Array<SavedPlace>
}>({ saved: stored() })

/** ~100 m: the same address picked twice is one entry. */
const same = (a: LngLat, b: LngLat) =>
  Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lng - b.lng) < 0.001

function write(saved: Array<SavedPlace>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Ignore blocked storage.
  }
  placesStore.setState(() => ({ saved }))
}

/** Put a place used for navigation at the top of the saved addresses. */
export function rememberPlace({ name, detail, lng, lat }: SavedPlace) {
  const place = { name, detail, lng, lat }
  const rest = placesStore.state.saved.filter((p) => !same(p, place))
  write([place, ...rest].slice(0, MAX))
}

export function forgetPlace(place: LngLat) {
  write(placesStore.state.saved.filter((p) => !same(p, place)))
}

/** A saved address in the shape place pickers hand around. */
export function savedAsPlace(saved: SavedPlace): Place {
  return { ...saved, id: `saved:${saved.lat},${saved.lng}` }
}
