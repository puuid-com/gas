import { RegionList } from '#/components/RegionList'
import { StationList } from '#/components/StationList'
import { TripPanel } from '#/components/TripPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAppSearch, useSetSearch } from '#/hooks/use-app-search'
import { useNow } from '#/hooks/use-now'
import { useStations } from '#/hooks/use-stations'
import { formatRelative } from '#/lib/format'
import { SOURCE_URL } from '#/lib/stations'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'

/** Stations / Trip / Regions: a floating list on desktop, a full screen on phones. */
export function Panel() {
  const { tab } = useAppSearch()
  const setSearch = useSetSearch()
  const { generatedAt } = useStations()
  const now = useNow()

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setSearch({ tab: value as typeof tab })}
      className="min-h-0 flex-1 gap-0"
    >
      <TabsList variant="line" className="w-full justify-start gap-4 border-b px-3">
        <TabsTrigger value="stations" className="flex-none px-0 text-[13px]">
          {m.tab_stations()}
        </TabsTrigger>
        <TabsTrigger value="trip" className="flex-none px-0 text-[13px]">
          {m.tab_trip()}
        </TabsTrigger>
        <TabsTrigger value="regions" className="flex-none px-0 text-[13px]">
          {m.tab_regions()}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="stations" className="flex min-h-0 flex-col data-[state=inactive]:hidden">
        <StationList />
      </TabsContent>
      <TabsContent value="trip" className="flex min-h-0 flex-col data-[state=inactive]:hidden">
        <TripPanel />
      </TabsContent>
      <TabsContent value="regions" className="flex min-h-0 flex-col data-[state=inactive]:hidden">
        <RegionList />
      </TabsContent>
      <footer className="flex flex-wrap gap-x-3 border-t px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] text-[11px] text-muted-foreground lg:pb-2">
        <a
          href={new URL('/', SOURCE_URL).href}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          {m.source_credit()}
        </a>
        <span className="ml-auto" title={generatedAt}>
          {m.updated({
            time: formatRelative(new Date(generatedAt), getLocale(), now),
          })}
        </span>
      </footer>
    </Tabs>
  )
}
