import { IconClockExclamation } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { formatDay } from '#/lib/format'
import { STALE_DAYS, isStale, unchangedDays } from '#/lib/history'
import { staleStationsQueryOptions } from '#/lib/history.query'
import { cn } from '#/lib/utils'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'

/**
 * Days a station's prices have gone unchanged, when that's long enough that
 * they were probably not updated; undefined otherwise or while loading.
 */
export function useStaleDays(id: string) {
  const { data } = useQuery({
    ...staleStationsQueryOptions,
    select: ({ asOf, changedAt }) => {
      const since = changedAt[id] as number | undefined
      return since == null || asOf == null
        ? undefined
        : unchangedDays(since, asOf)
    },
  })
  return data
}

/** Compact "Not updated · 12 d" mark, for rows and tight cards. */
export function StaleTag({
  days,
  className,
}: {
  days: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-warning',
        className,
      )}
      title={m.stale_title()}
    >
      <IconClockExclamation aria-hidden className="size-3.5 shrink-0" />
      {m.stale_short()} · {m.stale_days({ days })}
    </span>
  )
}

/** Full warning for a station whose prices have sat unchanged. */
export function StaleNotice({
  changedAt,
  seenAt,
  trackedSince,
  className,
}: {
  changedAt: number
  seenAt: number
  /** First snapshot: an older change can't be known. */
  trackedSince: number
  className?: string
}) {
  if (!isStale(changedAt, seenAt)) return null
  const days = unchangedDays(changedAt, seenAt)
  return (
    <Alert className={cn('border-warning/40', className)}>
      <IconClockExclamation className="text-warning" />
      <AlertTitle>{m.stale_title()}</AlertTitle>
      <AlertDescription>
        {changedAt <= trackedSince
          ? m.stale_detail_start({ days: Math.max(days, STALE_DAYS) })
          : m.stale_detail({
              days,
              date: formatDay(changedAt, getLocale()),
            })}
      </AlertDescription>
    </Alert>
  )
}
