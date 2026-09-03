import React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WidgetBoundary } from '@/dashboard/chrome/WidgetBoundary'
import { LoadingState, EmptyState, DeltaBadge, ViewAllLink } from '@/dashboard/chrome'
import { RecordsTable, type ColumnDef } from '@/dashboard/chrome/RecordsTable'
import { fmtNumber, fmtPercent, fmtDuration, fmtTimeAgo } from '@/lib/format'
import { toneClass, kpiDelta, type DeltaPolarity } from '@/lib/widget'
import { Activity } from 'lucide-react'
import { fetchData } from '@/metrics/customer-license-utilization'

type Row = Record<string, unknown>

const DISPLAY_AS: string = 'data-table'
const VALUE_FIELD = ''
const VALUE_LABEL = ''
const PREVIOUS_FIELD = ''
const DELTA_POLARITY = 'neutral'
const ROW_LINK_KEY = ''
const ROW_LINK_ROUTE = ''
// Set only for a kpi-card with detail:true — makes the card clickable and adds a
// "View all" link to its record-grain detail view. Empty for plain KPIs and tables.
const KPI_DETAIL_ROUTE = ''
const COLUMNS: ColumnDef<Row>[] = [{key:"customerName",label:"Customer Name"},{key:"licenseCode",label:"Customer License ID"},{key:"subsidiaryId",label:"Subsidiary ID"},{key:"category",label:"Category"},{key:"purchased",label:"Purchased",align:"right" as const,render:(v:unknown)=>fmtNumber(Number(v))},{key:"consumedAllocated",label:"Consumed / Allocated",align:"right" as const,render:(v:unknown)=>fmtNumber(Number(v))},{key:"utilizationPercent",label:"Utilization %",align:"right" as const,render:(v:unknown)=>fmtPercent(Number(v))}]

/** Auto-detect columns from the first row when explicit columns aren't given. */
function autoColumns(rows: Row[]): ColumnDef<Row>[] {
  if (rows.length === 0) return [{ key: 'value', label: 'Value' }]
  return Object.entries(rows[0])
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .map(([k, v]) => ({
      key: k,
      label: k.replace(/([A-Z])/g, ' $1').replace(/^(.)/, (s: string) => s.toUpperCase()).trim(),
      ...(typeof v === 'number' && { align: 'right' as const }),
    }))
}

function useCustomerLicenseUtilizationData() {
  const { sdk, getToken } = useAuth()
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!sdk) return
    setLoading(true)
    fetchData(sdk, getToken)
      .then(rows => { setData(rows); setLoading(false) })
      .catch(err => { setError(err instanceof Error ? err : new Error(String(err))); setLoading(false) })
  }, [sdk])

  return { data, loading, error }
}

export function CustomerLicenseUtilization() {
  const navigate = useNavigate()
  const { data, loading, error } = useCustomerLicenseUtilizationData()
  const [customerFilter, setCustomerFilter] = useState('')
  const customers = useMemo(() => Array.from(new Set(
    data.map(row => String(row.customerName ?? '')).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b)), [data])
  const filteredData = useMemo(() => customerFilter
    ? data.filter(row => String(row.customerName ?? '') === customerFilter)
    : data, [data, customerFilter])

  const renderContent = () => {
    if (loading) return <LoadingState height="h-32" />
    if (error)   return <EmptyState message={error.message} />
    if (data.length === 0) return <EmptyState message="No data" />
    if (filteredData.length === 0) return <EmptyState message="No records match this customer" />

    if (DISPLAY_AS === 'ranked-table' || DISPLAY_AS === 'data-table') {
      const cols = COLUMNS.length ? COLUMNS : autoColumns(filteredData)
      return (
        <RecordsTable
          key={customerFilter || 'all-customers'}
          rows={filteredData}
          columns={cols}
          defaultSortKey={cols[0]?.key as string}
          defaultSortAsc={true}
          {...(ROW_LINK_KEY ? { onRowClick: (row: Row) => navigate(`${ROW_LINK_ROUTE}/${encodeURIComponent(String(row[ROW_LINK_KEY] ?? ''))}`) } : {})}
        />
      )
    }

    // kpi-card: show a specific field value or item count, with an optional
    // vs-previous-period delta badge when the metric returns a `previous` field.
    const headline = VALUE_FIELD
      ? String((data[0] as Record<string, unknown>)?.[VALUE_FIELD] ?? '—')
      : String(data.length)
    const label = VALUE_LABEL || (VALUE_FIELD ? VALUE_FIELD : `${data.length === 1 ? 'item' : 'items'}`)
    const cur = VALUE_FIELD ? Number((data[0] as Record<string, unknown>)?.[VALUE_FIELD]) : data.length
    const prevRaw = PREVIOUS_FIELD ? (data[0] as Record<string, unknown>)?.[PREVIOUS_FIELD] : undefined
    const kd = (PREVIOUS_FIELD && prevRaw !== undefined && prevRaw !== null)
      ? kpiDelta(cur, Number(prevRaw), DELTA_POLARITY as DeltaPolarity)
      : null

    return (
      <div className="flex flex-col gap-1 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-foreground">{headline}</span>
          {kd && kd.text && <DeltaBadge direction={kd.direction} text={kd.text} />}
        </div>
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
      </div>
    )
  }

  return (
    <WidgetBoundary label="Customer License Utilization">
      <Card
        className={KPI_DETAIL_ROUTE ? 'cursor-pointer hover:shadow-md transition-shadow' : undefined}
        onClick={KPI_DETAIL_ROUTE ? () => navigate(KPI_DETAIL_ROUTE) : undefined}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Activity className="h-4 w-4" />
              Customer License Utilization
            </CardTitle>
            <CardDescription>Current license utilization by customer and category</CardDescription>
          </div>
          {KPI_DETAIL_ROUTE ? <ViewAllLink to={KPI_DETAIL_ROUTE} /> : null}
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex flex-col gap-2 sm:max-w-sm">
            <label htmlFor="customer-filter" className="text-sm font-medium text-foreground">Customer</label>
            <select
              id="customer-filter"
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Customers</option>
              {customers.map(customer => <option key={customer} value={customer}>{customer}</option>)}
            </select>
          </div>
          {renderContent()}
        </CardContent>
      </Card>
    </WidgetBoundary>
  )
}
