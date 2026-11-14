import { IconSteeringWheel } from '@tabler/icons-react'
import { Button } from '#/components/ui/button'
import { startDriving } from '#/stores/location'
import { m } from '#/paraglide/messages'

/** The way into drive mode, from whichever card is showing. */
export function DriveButton() {
  return (
    <Button className="h-11 shrink-0 px-4 text-sm" onClick={startDriving}>
      <IconSteeringWheel />
      {m.drive_start()}
    </Button>
  )
}
