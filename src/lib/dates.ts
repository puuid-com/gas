const formatters = new Map<string, Intl.DateTimeFormat>()

/** A calendar day such as `2026-11-02`, the same in every time zone. */
export function formatDay(day: string, locale: string) {
  let format = formatters.get(locale)
  if (!format) {
    // Building a formatter is slow, so keep one per locale.
    format = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    })
    formatters.set(locale, format)
  }
  return format.format(new Date(`${day}T00:00:00Z`))
}
