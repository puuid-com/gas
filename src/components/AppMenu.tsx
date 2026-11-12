import { IconDots } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { useAppSearch, useSetSearch } from '#/hooks/use-app-search'
import { fuelLabel } from '#/lib/i18n'
import { FUELS } from '#/lib/stations'
import type { Fuel } from '#/lib/stations'
import { useNow } from '#/hooks/use-now'
import { useStations } from '#/hooks/use-stations'
import { formatRelative } from '#/lib/format'
import { setThemePreference, themeStore } from '#/stores/theme'
import { getLocale, setLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { ThemePreference } from '#/stores/theme'

const LANGUAGES = [
  { locale: 'fr', label: 'Français' },
  { locale: 'en', label: 'English' },
] as const

export function AppMenu({ onPlanTrip }: { onPlanTrip?: () => void }) {
  const { fuel } = useAppSearch()
  const setSearch = useSetSearch()
  const preference = useSelector(themeStore, (s) => s.preference)
  const { generatedAt } = useStations()
  const now = useNow()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={m.menu()}>
          <IconDots />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{m.fuel_label()}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={fuel}
          onValueChange={(value) => setSearch({ fuel: value as Fuel })}
        >
          {FUELS.map((type) => (
            <DropdownMenuRadioItem key={type} value={type}>
              {fuelLabel(type)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {onPlanTrip && (
          <>
            <DropdownMenuItem onSelect={onPlanTrip}>
              {m.trip_plan()}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>{m.language_label()}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={getLocale()}
          onValueChange={(value) => setLocale(value as 'fr' | 'en')}
        >
          {LANGUAGES.map((l) => (
            <DropdownMenuRadioItem key={l.locale} value={l.locale}>
              {l.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{m.theme_label()}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) =>
            setThemePreference(value as ThemePreference)
          }
        >
          <DropdownMenuRadioItem value="system">
            {m.theme_system()}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            {m.theme_light()}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            {m.theme_dark()}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal" title={generatedAt}>
          {m.updated({
            time: formatRelative(new Date(generatedAt), getLocale(), now),
          })}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
