import { createStore } from '@tanstack/react-store'

const COSTCO_KEY = 'plein:costco'

function storedCostco() {
  try {
    return localStorage.getItem(COSTCO_KEY) !== '0'
  } catch {
    // No storage (server render, private mode): include everything.
    return true
  }
}

export const prefsStore = createStore<{
  /**
   * Costco sells gas to members only, usually well under everyone else, so
   * non-members need it out of the rankings and recommendations.
   */
  costco: boolean
}>({ costco: storedCostco() })

export function setCostco(costco: boolean) {
  try {
    localStorage.setItem(COSTCO_KEY, costco ? '1' : '0')
  } catch {
    // Ignore blocked storage.
  }
  prefsStore.setState(() => ({ costco }))
}
