import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BurndownRow,
  DrawerContent,
  RollupRow,
  SoldGranularity,
} from "../../types/soldContracts";
import {
  buildSoldSeries,
  compactNumber,
  latestPurchasedByCustomer,
  number,
} from "../../types/soldContracts";

const soldGranularityLabel: Record<SoldGranularity, string> = {
  day: "Day",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

function SoldChart({
  title,
  unitLabel,
  rows,
  onOpenDrawer,
}: {
  title: string;
  unitLabel: string;
  rows: BurndownRow[];
  onOpenDrawer: (content: DrawerContent) => void;
}) {
  const [granularity, setGranularity] = useState<SoldGranularity>("month");
  const { points, startSold, endSold } = useMemo(
    () => buildSoldSeries(rows, granularity),
    [rows, granularity],
  );
  const growthPercent =
    startSold > 0 ? ((endSold - startSold) / startSold) * 100 : endSold > 0 ? 100 : null;

  const openBreakdown = () => {
    const breakdown = latestPurchasedByCustomer(rows);
    const total = breakdown.reduce((sum, r) => sum + r.purchased, 0);
    onOpenDrawer({
      title: `${unitLabel} Sold — By Customer`,
      subtitle: `${compactNumber.format(total)} ${unitLabel} sold across ${breakdown.length} customer${breakdown.length === 1 ? "" : "s"}`,
      sections: [
        {
          rows: breakdown.map((r) => ({
            label: r.customerName,
            value: `${number.format(r.purchased)} (${total > 0 ? ((r.purchased / total) * 100).toFixed(1) : "0"}%)`,
          })),
        },
      ],
    });
  };

  if (!rows.length) {
    return (
      <section className="burndown-card">
        <div className="burndown-header">
          <div>
            <h3>{title}</h3>
          </div>
        </div>
        <p className="burndown-empty">No Snowflake sold-units data available yet.</p>
      </section>
    );
  }

  return (
    <section className="burndown-card">
      <div className="burndown-header">
        <div>
          <h3>{title}</h3>
          <p>
            Total {unitLabel} sold (purchased entitlements), tracked since Jan 2025
            {growthPercent != null && (
              <>
                {" — "}
                {compactNumber.format(startSold)} → {compactNumber.format(endSold)}
                {" "}
                <span className={growthPercent >= 0 ? "sold-growth-up" : "sold-growth-down"}>
                  ({growthPercent >= 0 ? "+" : ""}
                  {growthPercent.toFixed(0)}%)
                </span>
              </>
            )}
          </p>
        </div>
        <div className="burndown-toggle">
          {(["day", "month", "quarter", "year"] as SoldGranularity[]).map((g) => (
            <button
              key={g}
              className={granularity === g ? "burndown-toggle-btn active" : "burndown-toggle-btn"}
              onClick={() => setGranularity(g)}
            >
              {soldGranularityLabel[g]}
            </button>
          ))}
        </div>
      </div>
      <button className="sold-chart-click-hint" onClick={openBreakdown}>
        Click chart to see each customer's share of total {unitLabel} sold
      </button>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart
          data={points.map((p) => ({ date: p.bucket, sold: p.sold }))}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          onClick={openBreakdown}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#667085" }} minTickGap={24} />
          <YAxis
            tick={{ fontSize: 11, fill: "#667085" }}
            tickFormatter={(v: number) => compactNumber.format(v)}
            width={48}
          />
          <Tooltip
            formatter={(value: number) => number.format(value)}
            contentStyle={{ fontSize: 12, borderRadius: 8, cursor: "pointer" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="sold"
            name={`${unitLabel} Sold`}
            stroke="#1570ef"
            fill="#d1e9ff"
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}

function SoldSnapshotCard({
  title,
  rows,
  onOpenDrawer,
}: {
  title: string;
  rows: { customerId: string; customerName: string; purchased: number }[];
  onOpenDrawer: (content: DrawerContent) => void;
}) {
  const total = rows.reduce((sum, r) => sum + r.purchased, 0);
  const openBreakdown = () => {
    onOpenDrawer({
      title: `${title} — By Customer`,
      subtitle: `${compactNumber.format(total)} sold across ${rows.length} customer${rows.length === 1 ? "" : "s"}`,
      sections: [
        {
          rows: rows
            .slice()
            .sort((a, b) => b.purchased - a.purchased)
            .map((r) => ({
              label: r.customerName,
              value: `${number.format(r.purchased)} (${total > 0 ? ((r.purchased / total) * 100).toFixed(1) : "0"}%)`,
            })),
        },
      ],
    });
  };
  return (
    <button className="sold-snapshot-card" onClick={openBreakdown}>
      <span>{title}</span>
      <strong>{compactNumber.format(total)}</strong>
      <small>{rows.length} customers — click for per-customer share</small>
    </button>
  );
}

export function SoldPage({
  rollups,
  platformBurndownRows,
  agentBurndownRows,
  aiBurndownRows,
  onOpenDrawer,
}: {
  rollups: RollupRow[];
  platformBurndownRows: BurndownRow[];
  agentBurndownRows: BurndownRow[];
  aiBurndownRows: BurndownRow[];
  onOpenDrawer: (content: DrawerContent) => void;
}) {
  const userRows = useMemo(
    () =>
      rollups
        .filter((r) => (r.UserLicensePurchased || 0) > 0)
        .map((r) => ({ customerId: r.CustomerId, customerName: r.CustomerName, purchased: r.UserLicensePurchased || 0 })),
    [rollups],
  );
  const unattendedRows = useMemo(
    () =>
      rollups
        .filter((r) => (r.UnattendedProdPurchased || 0) > 0)
        .map((r) => ({ customerId: r.CustomerId, customerName: r.CustomerName, purchased: r.UnattendedProdPurchased || 0 })),
    [rollups],
  );
  const testRobotRows = useMemo(
    () =>
      rollups
        .filter((r) => (r.TestRobotPurchased || 0) > 0)
        .map((r) => ({ customerId: r.CustomerId, customerName: r.CustomerName, purchased: r.TestRobotPurchased || 0 })),
    [rollups],
  );

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-text">
          <p className="eyebrow">Sales Growth</p>
          <h1>Sold — Entitlements Over Time</h1>
          <p className="subtitle">
            How much has been sold, and how fast is it growing? Platform, Agent, and AI Units track
            real purchase-date history from Snowflake since Jan 2025 — day, month, quarter, and year
            over year. Click any chart to see each customer's share of the total.
          </p>
        </div>
      </section>
      <SoldChart
        title="Platform Units Sold"
        unitLabel="Platform Units"
        rows={platformBurndownRows}
        onOpenDrawer={onOpenDrawer}
      />
      <SoldChart
        title="Agent Units Sold"
        unitLabel="Agent Units"
        rows={agentBurndownRows}
        onOpenDrawer={onOpenDrawer}
      />
      <SoldChart title="AI Units Sold" unitLabel="AI Units" rows={aiBurndownRows} onOpenDrawer={onOpenDrawer} />
      <section className="burndown-card">
        <div className="burndown-header">
          <div>
            <h3>Users &amp; Robots — Current Sold Snapshot</h3>
            <p>
              These entitlements aren't tracked with a dated purchase history yet, so day-to-day /
              month-to-month trend isn't available — this shows the current total sold. Click a card
              for the per-customer breakdown.
            </p>
          </div>
        </div>
        <div className="sold-snapshot-grid">
          <SoldSnapshotCard title="User Licenses" rows={userRows} onOpenDrawer={onOpenDrawer} />
          <SoldSnapshotCard title="Unattended Production Robots" rows={unattendedRows} onOpenDrawer={onOpenDrawer} />
          <SoldSnapshotCard title="Unattended Test Robots" rows={testRobotRows} onOpenDrawer={onOpenDrawer} />
        </div>
      </section>
    </>
  );
}
