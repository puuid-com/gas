import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { useAppSearch, useSetSearch } from '#/hooks/use-app-search'
import { fuelLabel } from '#/lib/i18n'
import { cn } from '#/lib/utils'
import { FUELS } from '#/lib/stations'
import { m } from '#/paraglide/messages'
import type { Fuel } from '#/lib/stations'

interface FuelToggleProps {
  className?: string
  itemClassName?: string
}

/** The map's fuel, kept in its URL. */
export function FuelToggle(props: FuelToggleProps) {
  const { fuel } = useAppSearch()
  const setSearch = useSetSearch()
  return (
    <FuelToggleGroup
      {...props}
      value={fuel}
      onValueChange={(value) => setSearch({ fuel: value })}
    />
  )
}

export function FuelToggleGroup({
  value,
  onValueChange,
  className,
  itemClassName,
}: FuelToggleProps & {
  value: Fuel
  onValueChange: (fuel: Fuel) => void
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as Fuel)
      }}
      aria-label={m.fuel_label()}
      className={cn('w-full', className)}
    >
      {FUELS.map((f) => (
        <ToggleGroupItem
          key={f}
          value={f}
          className={cn(
            'h-9 flex-1 text-[13px] data-[state=on]:bg-foreground data-[state=on]:text-background',
            itemClassName,
          )}
        >
          {fuelLabel(f)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
