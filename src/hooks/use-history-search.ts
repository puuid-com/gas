import { getRouteApi } from '@tanstack/react-router'
import type { HistorySearch } from '#/routes/history'

const historyRoute = getRouteApi('/history')

export function useHistorySearch() {
  return historyRoute.useSearch()
}

/** Merge a patch into the history page's URL, keeping the scroll position. */
export function useSetHistorySearch() {
  const navigate = historyRoute.useNavigate()
  return (patch: Partial<HistorySearch>, { push = false } = {}) =>
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, ...patch }),
      replace: !push,
      resetScroll: false,
    })
}
