import { createStore } from '@tanstack/react-store'
import { NAV_APPS } from '#/lib/directions'
import type { NavApp } from '#/lib/directions'

const COSTCO_KEY = 'plein:costco'
// A new key: the old one remembered whichever app was opened last, which on
// an iPhone used to start out as Apple Maps.
const NAV_KEY = 'plein:directions'

function storedCostco() {
  try {
    return localStorage.getItem(COSTCO_KEY) !== '0'
  } catch {
    // No storage (server render, private mode): include everything.
    return true
  }
}

function storedNavApp(): NavApp {
  try {
    const value = localStorage.getItem(NAV_KEY)
    if (value && (NAV_APPS as ReadonlyArray<string>).includes(value))
      return value as NavApp
  } catch {
    // No storage: the default it is.
  }
  return 'waze'
}

export const prefsStore = createStore<{
  /**
   * Costco sells gas to members only, usually well under everyone else, so
   * non-members need it out of the rankings and recommendations.
   */
  costco: boolean
  /** Where "Directions" opens. Waze unless the menu says otherwise. */
  navApp: NavApp
}>({ costco: storedCostco(), navApp: storedNavApp() })

export function setCostco(costco: boolean) {
  try {
    localStorage.setItem(COSTCO_KEY, costco ? '1' : '0')
  } catch {
    // Ignore blocked storage.
  }
  prefsStore.setState((s) => ({ ...s, costco }))
}

export function setNavApp(navApp: NavApp) {
  try {
    localStorage.setItem(NAV_KEY, navApp)
  } catch {
    // Ignore blocked storage.
  }
  prefsStore.setState((s) => ({ ...s, navApp }))
}
