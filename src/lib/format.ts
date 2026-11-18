const priceFormats = new Map<string, Intl.NumberFormat>()

/** 189.9 → "189,9" (fr) / "189.9" (en). Prices are cents per litre. */
export function formatPrice(cents: number, locale: string) {
  let f = priceFormats.get(locale)
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    priceFormats.set(locale, f)
  }
  return f.format(cents)
}

/** Unsigned cents with unit, e.g. "6,0 ¢" / "6.0¢". */
export function formatCents(cents: number, locale: string) {
  const value = formatPrice(Math.abs(cents), locale)
  return locale.startsWith('fr') ? `${value} ¢` : `${value}¢`
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

export function formatRelative(date: Date, locale: string, now = Date.now()) {
  const diff = date.getTime() - now
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === 'minute') {
      return rtf.format(Math.round(diff / ms), unit)
    }
  }
  return rtf.format(0, 'minute')
}

/** 205 → "3 h 25" (fr) / "3 h 25 min" (en); under an hour, "45 min". */
export function formatDuration(minutes: number, locale: string) {
  const total = Math.max(1, Math.round(minutes))
  const h = Math.floor(total / 60)
  const min = total % 60
  if (h === 0) return `${min} min`
  if (locale.startsWith('fr')) return `${h} h ${String(min).padStart(2, '0')}`
  return min ? `${h} h ${min} min` : `${h} h`
}

/** 4.5 → "$4.50" (en) / "4,50 $" (fr). */
export function formatDollars(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: 'narrowSymbol',
  }).format(amount)
}

/** Quebec's clock, so the server and every browser agree on dates. */
const TIME_ZONE = 'America/Toronto'
const dateFormats = new Map<string, Intl.DateTimeFormat>()

function dateFormat(
  locale: string,
  key: string,
  options: Intl.DateTimeFormatOptions,
) {
  const id = `${locale}|${key}`
  let f = dateFormats.get(id)
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, ...options })
    dateFormats.set(id, f)
  }
  return f
}

/** Unix seconds → "17 nov." (fr) / "Nov 17" (en); adds the year when it isn't this one. */
export function formatDay(seconds: number, locale: string, now = Date.now()) {
  const date = new Date(seconds * 1000)
  const thisYear =
    dateFormat(locale, 'y', { year: 'numeric' }).format(date) ===
    dateFormat(locale, 'y', { year: 'numeric' }).format(now)
  return dateFormat(locale, thisYear ? 'md' : 'ymd', {
    month: 'short',
    day: 'numeric',
    ...(thisYear ? {} : { year: 'numeric' }),
  }).format(date)
}

/** Unix seconds → "17 nov., 18 h" (fr) / "Nov 17, 6 PM" (en). */
export function formatDayTime(seconds: number, locale: string) {
  return dateFormat(locale, 'mdh', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  }).format(new Date(seconds * 1000))
}

/** Signed cents with unit, e.g. "+2,3 ¢" / "−1.0¢". */
export function formatSignedCents(cents: number, locale: string) {
  if (Math.abs(cents) < 0.05) return formatCents(0, locale)
  return `${cents > 0 ? '+' : '−'}${formatCents(cents, locale)}`
}
