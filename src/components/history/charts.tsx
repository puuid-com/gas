import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
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
