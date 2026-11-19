import { useMap } from 'react-map-gl/maplibre'
import { IconMinus, IconPlus } from '@tabler/icons-react'
import { LocateButton } from '#/components/LocateButton'
import { MAP_ID } from '#/components/map/StationMap'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

/** The map's own buttons: zoom where there's no pinch, and "where am I". */
export function MapControls() {
  const map = useMap()[MAP_ID]

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="hidden flex-col divide-y border bg-background shadow-lg shadow-black/10 lg:flex">
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label={m.zoom_in()}
          onClick={() => map?.zoomIn()}
        >
          <IconPlus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label={m.zoom_out()}
          onClick={() => map?.zoomOut()}
        >
          <IconMinus />
        </Button>
      </div>
      <LocateButton />
    </div>
  )
}
