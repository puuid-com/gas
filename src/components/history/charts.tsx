import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '#/components/ui/chart'
import { formatDay, formatDayTime, formatPrice } from '#/lib/format'
import { getLocale } from '#/paraglide/runtime'
import type { ChartConfig } from '#/components/ui/chart'

export interface SeriesSpec {
  key: string
  label: string
  /** The subject draws solid in the accent; comparisons are dashed and grey. */
  role: 'subject' | 'reference'
  /** Steps between changes instead of joining them with a slope. */
  step?: boolean
}

/**
 * Prices over time on one ¢/L scale: the subject (a region's median, a
 * station's price) against a reference median.
 */
export function PriceChart({
  data,
  series,
  className,
}: {
  data: Array<{ at: number } & Record<string, number | null>>
  series: Array<SeriesSpec>
  className?: string
}) {
  const locale = getLocale()
  const config = Object.fromEntries(
    series.map((s) => [
      s.key,
      {
        label: s.label,
        color:
          s.role === 'subject'
            ? 'var(--chart-line)'
            : 'var(--muted-foreground)',
      },
    ]),
  ) satisfies ChartConfig
  // Reference lines go underneath the subject.
  const ordered = [...series].sort(
    (a, b) => Number(a.role === 'subject') - Number(b.role === 'subject'),
  )

  return (
    <ChartContainer
      config={config}
      className={className ?? 'aspect-auto h-56 w-full sm:h-72'}
    >
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="at"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(at: number) => formatDay(at, locale)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={40}
        />
        <YAxis
          domain={[
            (min: number) => Math.floor(min - 1),
            (max: number) => Math.ceil(max + 1),
          ]}
          allowDecimals={false}
          tickFormatter={(v: number) => String(Math.round(v))}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) => {
                const at = (payload[0]?.payload as { at?: number } | undefined)
                  ?.at
                return at == null ? null : formatDayTime(at, locale)
              }}
              formatter={(value, name) => (
                <div className="flex flex-1 items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {series.find((x) => x.key === name)?.label ?? name}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatPrice(Number(value), locale)}
                  </span>
                </div>
              )}
            />
          }
        />
        {ordered.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type={s.step ? 'stepAfter' : 'monotone'}
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            strokeDasharray={s.role === 'reference' ? '4 4' : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={
              s.role === 'subject'
                ? { r: 4, strokeWidth: 2, stroke: 'var(--background)' }
                : false
            }
            connectNulls
            isAnimationActive={false}
          />
        ))}
        {series.length > 1 && (
          <ChartLegend
            verticalAlign="top"
            align="left"
            // The subject first, then references, as listed.
            itemSorter={(item) =>
              series.findIndex((x) => x.key === item.dataKey)
            }
            content={<ChartLegendContent className="justify-start pt-0 pb-3" />}
          />
        )}
      </LineChart>
    </ChartContainer>
  )
}

/**
 * Each region's median now, cheapest first, as horizontal bars. The selected
 * region is drawn in the accent; a click selects (or clears) a region.
 */
export function RegionChart({
  regions,
  selected,
  label,
  onSelect,
}: {
  regions: Array<{ region: string; median: number }>
  selected?: string
  label: string
  onSelect: (region: string) => void
}) {
  const locale = getLocale()
  const data = [...regions].sort((a, b) => a.median - b.median)
  const config = {
    median: { label, color: 'var(--chart-line)' },
  } satisfies ChartConfig
  const values = data.map((d) => d.median)
  const low = Math.floor(Math.min(...values) - 2)
  const high = Math.ceil(Math.max(...values) + 1)

  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: data.length * 28 + 32 }}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
        barCategoryGap={4}
      >
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          domain={[low, high]}
          allowDataOverflow
          tickFormatter={(v: number) => String(Math.round(v))}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          type="category"
          dataKey="region"
          width={140}
          interval={0}
          tickFormatter={(r: string) =>
            r.length > 20 ? `${r.slice(0, 19)}…` : r
          }
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value) => (
                <span className="font-medium text-foreground tabular-nums">
                  {formatPrice(Number(value), locale)} ¢/L
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="median"
          radius={0}
          isAnimationActive={false}
          className="cursor-pointer"
          onClick={(entry) => {
            const region = (entry as { payload?: { region?: string } }).payload
              ?.region
            if (region) onSelect(region)
          }}
          label={{
            position: 'right',
            className: 'fill-muted-foreground text-xs tabular-nums',
            formatter: (v: unknown) => formatPrice(Number(v), locale),
          }}
        >
          {data.map((d) => (
            <Cell
              key={d.region}
              fill={
                !selected || d.region === selected
                  ? 'var(--color-median)'
                  : 'var(--muted-foreground)'
              }
              fillOpacity={!selected || d.region === selected ? 1 : 0.35}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

/**
 * How many stations post each price right now, in 1 ¢ bins, with the median
 * marked.
 */
export function DistributionChart({
  prices,
  label,
}: {
  /** Current prices in ¢/L, sorted ascending. */
  prices: ReadonlyArray<number>
  label: string
}) {
  const locale = getLocale()
  const low = Math.floor(prices[0])
  const high = Math.floor(prices[prices.length - 1])
  const bins = Array.from({ length: high - low + 1 }, (_, i) => ({
    price: low + i,
    count: 0,
  }))
  for (const p of prices) bins[Math.floor(p) - low].count++
  const mid = prices.length >> 1
  const median =
    prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2
  const config = {
    count: { label, color: 'var(--chart-line)' },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto h-48 w-full sm:h-56">
      <BarChart
        data={bins}
        margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
        barCategoryGap={1}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="price"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, payload) => {
                const price = (
                  payload[0]?.payload as { price?: number } | undefined
                )?.price
                return price == null
                  ? null
                  : `${formatPrice(price, locale)}–${formatPrice(price + 0.9, locale)} ¢/L`
              }}
              formatter={(value) => (
                <span className="font-medium text-foreground tabular-nums">
                  {value} {label}
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={0}
          isAnimationActive={false}
        />
        <ReferenceLine
          x={Math.floor(median)}
          stroke="var(--foreground)"
          strokeDasharray="4 4"
          label={{
            value: formatPrice(median, locale),
            position: 'top',
            className: 'fill-foreground text-xs font-medium tabular-nums',
          }}
        />
      </BarChart>
    </ChartContainer>
  )
}
