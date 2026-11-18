import { IconChartLine } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { StaleNotice } from '#/components/StaleMark'
import { Button } from '#/components/ui/button'
import { useNow } from '#/hooks/use-now'
import { formatRelative } from '#/lib/format'
import { isStale } from '#/lib/history'
import { stationHistoryQueryOptions } from '#/lib/history.query'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { Fuel } from '#/lib/stations'

/** When the station's prices last moved, a warning if long ago, and a link to its history. */
export function StationFreshness({ id, fuel }: { id: string; fuel: Fuel }) {
  const { data } = useQuery(stationHistoryQueryOptions(id))
  const now = useNow()
  const station = data?.station

  return (
    <div className="flex flex-col gap-2">
      {station &&
        (isStale(station.changedAt, station.seenAt) ? (
          <StaleNotice
            changedAt={station.changedAt}
            seenAt={station.seenAt}
            trackedSince={data.first}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {(station.changedAt <= data.first
              ? m.prices_unchanged_since_start
              : m.prices_changed)({
              time: formatRelative(
                new Date(station.changedAt * 1000),
                getLocale(),
                now,
              ),
            })}
          </p>
        ))}
      <Button variant="outline" size="sm" className="self-start" asChild>
        <Link to="/history" search={{ station: id, fuel }}>
          <IconChartLine data-icon="inline-start" />
          {m.price_history()}
        </Link>
      </Button>
    </div>
  )
}
