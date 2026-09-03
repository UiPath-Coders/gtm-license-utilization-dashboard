import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { <ICON> } from 'lucide-react'
<HOOK_IMPORT>
<RESPONSE_TYPE_IMPORT>
<SDK_IMPORT_LINE>
import { DeltaBadge, ViewAllLink, LoadingState, EmptyState } from '@/dashboard/chrome'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { fmtNumber } from '@/lib/format'
import { headline, delta } from '@/lib/widget'

export function <COMPONENT_NAME>() {
  const navigate = useNavigate()
  // Empty when the metric has no record-grain drill-down (registry noDetail):
  // the card renders non-clickable and no "View all" link is shown.
  const detailRoute = '<DETAIL_ROUTE>'
  const { data, loading, error } = <DATA_HOOK>
  const chartData: Record<string, unknown>[] = <DATA_SELECTOR>
  // Card chrome (header + title) always renders; only the body swaps for
  // loading/error/empty. `ready` guards the headline + delta so they aren't
  // computed on an empty array while data is still loading.
  const isEmpty = !chartData || (chartData as unknown[]).length === 0
  const ready = !loading && !error && !isEmpty
  const head = ready ? fmtNumber(headline(chartData, '<Y_KEY>', '<HEADLINE_MODE>')) : null
  const d = ready ? delta(chartData, '<Y_KEY>', '<DELTA_POLARITY>') : null

  return (
    <Card
      className={detailRoute ? 'cursor-pointer hover:shadow-md transition-shadow' : undefined}
      onClick={detailRoute ? () => navigate(detailRoute) : undefined}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-2">
            <<ICON> className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base"><TITLE></CardTitle>
            <CardDescription><SUBTITLE></CardDescription>
          </div>
        </div>
        {detailRoute ? <ViewAllLink to={detailRoute} /> : null}
      </CardHeader>
      {ready && (
        <div className="px-6 pb-2 flex items-baseline gap-3">
          <span className="text-3xl font-semibold tabular-nums">{head}</span>
          {d && d.text && <DeltaBadge direction={d.direction} text={d.text} />}
        </div>
      )}
      <CardContent className="pt-0">
        {loading ? (
          <LoadingState height="h-[180px]" />
        ) : error ? (
          <EmptyState message={error.message} />
        ) : isEmpty ? (
          <EmptyState message="<EMPTY_MESSAGE>" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="<X_KEY>"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string | number) => {
                  const dt = new Date(String(v))
                  return isNaN(dt.getTime()) ? String(v) : dt.toLocaleDateString([], { month: 'short', day: 'numeric' })
                }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="<Y_KEY>" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
