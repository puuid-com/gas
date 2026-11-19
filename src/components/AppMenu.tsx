import { IconDots } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-store'
import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { useAppSearch, useSetSearch } from '#/hooks/use-app-search'
import { NAV_APPS, navAppLabel } from '#/lib/directions'
import { fuelLabel } from '#/lib/i18n'
import { FUELS } from '#/lib/stations'
import type { Fuel } from '#/lib/stations'
import { useNow } from '#/hooks/use-now'
import { useStations } from '#/hooks/use-stations'
import { formatRelative } from '#/lib/format'
import { prefsStore, setCostco, setNavApp } from '#/stores/prefs'
import { setThemePreference, themeStore } from '#/stores/theme'
import { getLocale, setLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import type { NavApp } from '#/lib/directions'
import type { ThemePreference } from '#/stores/theme'

const LANGUAGES = [
  { locale: 'fr', label: 'Français' },
  { locale: 'en', label: 'English' },
] as const

export function AppMenu({
  onPlanTrip,
  className,
}: {
  onPlanTrip?: () => void
  /** Sizes the trigger to the bar it sits in. */
  className?: string
}) {
  const { fuel } = useAppSearch()
  const setSearch = useSetSearch()
  const preference = useSelector(themeStore, (s) => s.preference)
  const costco = useSelector(prefsStore, (s) => s.costco)
  const navApp = useSelector(prefsStore, (s) => s.navApp)
  const { generatedAt } = useStations()
  const now = useNow()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label={m.menu()}
        >
          <IconDots />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
        <DropdownMenuCheckboxItem
          checked={costco}
          onCheckedChange={(checked) => setCostco(checked === true)}
        >
          {m.costco_member()}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {onPlanTrip && (
          <DropdownMenuItem onSelect={onPlanTrip}>
            {m.trip_plan()}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/history" search={{ fuel }}>
            {m.price_history()}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{m.directions_app()}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={navApp}
          onValueChange={(value) => setNavApp(value as NavApp)}
        >
          {NAV_APPS.map((app) => (
            <DropdownMenuRadioItem key={app} value={app}>
              {navAppLabel(app, getLocale())}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
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
