import { createStore } from '@tanstack/react-store'
import type { Bounds, LngLat } from '#/lib/geo'

/** A place found through the search bar, pinned on the map. */
export interface PinnedPlace extends LngLat {
  name: string
  /** Street or town, as the search listed it. */
  detail: string
}

/** Wide-screen chrome: the floating list on the left, the card on the right. */
export const PANEL_WIDTH = 400
export const CARD_WIDTH = 384
const EDGE = 16

const PANEL_KEY = 'plein:panel'

// Read up front so the first camera fit already knows how much map is free.
function storedPanelOpen() {
  try {
    return localStorage.getItem(PANEL_KEY) !== '0'
  } catch {
    // No storage (server render, private mode): open is the default.
    return true
  }
}

export const mapStore = createStore<{
  /** Visible map area, updated on move end; drives "cheapest in view". */
  bounds: Bounds | null
  zoom: number
  /** Space covered by floating chrome, in px, so camera moves avoid it. */
  insets: { top: number; bottom: number }
  /** Wide screens: whether the floating list is open. */
  panelOpen: boolean
  place: PinnedPlace | null
}>({
  bounds: null,
  zoom: 0,
  insets: { top: 0, bottom: 0 },
  panelOpen: storedPanelOpen(),
  place: null,
})

export const isWide = () =>
  typeof window !== 'undefined' && matchMedia('(min-width: 1024px)').matches

/** How much of the left edge the open list covers on wide screens, in px. */
export function panelInset(open = mapStore.state.panelOpen) {
  return open ? EDGE + PANEL_WIDTH : 0
}

export function mapPadding() {
  const { top, bottom } = mapStore.state.insets
  // On wide screens the list and the card float over the map's sides instead.
  const wide = isWide()
  return {
    top: top + 24,
    bottom: bottom + 24,
    left: 32 + (wide ? panelInset() : 0),
    right: wide ? 32 + CARD_WIDTH + EDGE : 32,
  }
}

export function setPanelOpen(panelOpen: boolean) {
  try {
    localStorage.setItem(PANEL_KEY, panelOpen ? '1' : '0')
  } catch {
    // Ignore blocked storage.
  }
  mapStore.setState((s) => ({ ...s, panelOpen }))
}

export function setPlace(place: PinnedPlace | null) {
  mapStore.setState((s) => ({ ...s, place }))
}
