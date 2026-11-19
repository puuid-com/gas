import { useSelector } from '@tanstack/react-store'
import { IconHistory, IconX } from '@tabler/icons-react'
import { Button } from '#/components/ui/button'
import { CommandItem } from '#/components/ui/command'
import { forgetPlace, placesStore, savedAsPlace } from '#/stores/places'
import { m } from '#/paraglide/messages'
import type { Place } from '#/lib/places'

/**
 * Addresses navigated to before, as rows of a place picker's suggestions: tap
 * one to reuse it, or its × to forget it.
 */
export function SavedPlaces({
  onSelect,
}: {
  onSelect: (place: Place) => void
}) {
  const saved = useSelector(placesStore, (s) => s.saved)

  return saved.map((entry) => {
    const place = savedAsPlace(entry)
    return (
      <CommandItem
        key={place.id}
        value={place.id}
        onSelect={() => onSelect(place)}
        // The row ends in its own button, not the list's check mark.
        className="min-h-12 py-1 pr-1 [&>svg:last-child]:hidden"
      >
        <IconHistory className="text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{place.name}</div>
          {place.detail && (
            <div className="truncate text-xs text-muted-foreground">
              {place.detail}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 text-muted-foreground"
          aria-label={m.saved_remove({ place: place.name })}
          onClick={(e) => {
            // Forget it without also picking it.
            e.stopPropagation()
            forgetPlace(entry)
          }}
        >
          <IconX />
        </Button>
      </CommandItem>
    )
  })
}

export function useHasSavedPlaces() {
  return useSelector(placesStore, (s) => s.saved.length > 0)
}
