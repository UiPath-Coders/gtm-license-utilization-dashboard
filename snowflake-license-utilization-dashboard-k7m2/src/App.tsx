import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ErrorInfo, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  DollarSign,
  Download,
  Gauge,
  Info,
  RotateCcw,
  Search,
  Settings,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Entities } from "@uipath/uipath-typescript/entities";
import type { EntityRecord } from "@uipath/uipath-typescript/entities";
import type {
  PaginatedResponse,
  PaginationCursor,
} from "@uipath/uipath-typescript/core";
import { AuthProvider, useAuth } from "./hooks/useAuth";

type DetailRow = {
  Id: string;
  CustomerName: string;
  CustomerId: string;
  LicenseCode: string;
  LicenseType: string;
  DeploymentType: string;
  LicenseCategory: string;
  AsOfDate: string;
  PurchasedUnits: number;
  PurchasedEntitlements?: number;
  UtilizedUnits?: number;
  UtilizationPercent?: number;
  RecordStatus: string;
  CustomerGeo: string;
  CustomerRegion: string;
  CustomerArea: string;
  CurrentContractEndDate: string;
  LicenseStatus: string;
  RobotBoughtHoursMonthly?: number;
  RobotExecutionHoursMonthly?: number;
  RobotMonthlyExecutionPercent?: number;
  UpdateTime?: string;
};
type RollupRow = {
  Id: string;
  CustomerName: string;
  ParentCompanyName: string;
  CustomerId: string;
  ActiveLicenseKeyCount: number;
  LatestAsOfDate: string;
  DeploymentType: string;
  CustomerGeo: string;
  CustomerRegion: string;
  CustomerArea: string;
  EarliestActiveContractEndDate: string;
  LatestActiveContractEndDate: string;
  AccountOwnerName: string;
  CsdName: string;
  CustomerSuccessManagerName: string;
  TamName: string;
  CustomerSupportPackage: string;
  UnattendedProdEntitlements?: number;
  UnattendedProdPurchased: number;
  UnattendedProdUtilized: number;
  UnattendedProdUtilizationPercent?: number;
  TestRobotEntitlements?: number;
  TestRobotPurchased: number;
  TestRobotUtilized: number;
  TestRobotUtilizationPercent?: number;
  UserLicenseEntitlements?: number;
  UserLicensePurchased: number;
  UserLicenseUtilized: number;
  UserLicenseUtilizationPercent?: number;
  AiUnitsEntitlements?: number;
  AiUnitsPurchased: number;
  AiUnitsUtilized: number;
  AiUnitsUtilizationPercent?: number;
  AgentUnitsEntitlements?: number;
  AgentUnitsPurchased: number;
  AgentUnitsUtilized: number;
  AgentUnitsUtilizationPercent?: number;
  PlatformUnitsEntitlements?: number;
  PlatformUnitsPurchased: number;
  PlatformUnitsUtilized: number;
  PlatformUnitsUtilizationPercent?: number;
  UpdateTime?: string;
};
type CategoryMetric = {
  entitlements: number | null;
  purchased: number;
  utilized: number;
  percentage: number | null;
  present: boolean;
};
type HomeSortColumn =
  | "customerName"
  | "accountOwner"
  | "region"
  | "renewalDate"
  | "arr"
  | "utilization"
  | "risk";
const riskSeverity: Record<RiskLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};
type AccountUtilizationSummary = {
  percent: number | null;
  isOnPrem: boolean;
  hasData: boolean;
};
type PivotRow = RollupRow & {
  key: string;
  metrics: Record<string, CategoryMetric>;
  metricsAvailable: boolean;
  section: "Cloud" | "OnPrem";
  quarter: string;
  lastUpdated?: string;
};
const onPremCapabilities = new Set(["MSI", "Automation Suite"]);
type DrawerRow = { label: string; value: ReactNode };
type DrawerSection = { heading?: string; rows: DrawerRow[] };
type DrawerContent = { title: string; subtitle?: string; sections: DrawerSection[] };
type SortDirection = "asc" | "desc";
type FilterKey =
  | "customer"
  | "geo"
  | "area"
  | "region"
  | "deploymentType"
  | "accountOwner"
  | "csd"
  | "csm"
  | "tam"
  | "supportPackage"
  | "search";
type DetailFilterKey = "licenseCode" | "category" | "deploymentType";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const rollupEntityId = "02990c8f-c6a8-f111-9b33-6045bda94b17"; // CustomerAccountRollup
const detailEntityId = "92d4b637-c8a8-f111-9b33-6045bda94b17"; // LicenseKeyDetail
const purchasedEntitlementsEntityId = "cdc5ab9b-c6a8-f111-9b33-6045bda94b17"; // PurchasedEntitlements
const msiUtilizationEntityId = "5da516cd-c5a8-f111-9b33-6045bda94b17"; // OnPremUtilization
const platformBurndownEntityId = "27441ea7-c5a8-f111-9b33-6045bda94b17"; // PlatformUnitDailyBurndown
const agentBurndownEntityId = "762c6fad-c5a8-f111-9b33-6045bda94b17"; // AgentUnitDailyBurndown
const aiBurndownEntityId = "962c6fad-c5a8-f111-9b33-6045bda94b17"; // AiUnitDailyBurndown
type BurndownRow = {
  CustomerId: string;
  CustomerName: string;
  LicenseCode: string;
  EntitlementStartDate?: string;
  EntitlementEndDate?: string;
  PurchasedUnits?: number;
  ConsumptionDate: string;
  DailyConsumedUnits?: number;
  CumulativeConsumedUnits?: number;
  AvailableUnits?: number;
  UtilizationPercent?: number;
};
type MsiUtilizationRecord = {
  CustomerId: string;
  UserLicensesPurchased?: number;
  UserLicensesUtilized?: number;
  UnattendedProdPurchased?: number;
  UnattendedProdUtilized?: number;
  TestRobotPurchased?: number;
  TestRobotUtilized?: number;
  AiUnitsPurchased?: number;
  AiUnitsUtilized?: number;
  PlatformUnitsPurchased?: number;
  PlatformUnitsUtilized?: number;
  AgentUnitsPurchased?: number;
  AgentUnitsUtilized?: number;
  SubmittedAt?: string;
  FiscalQuarter?: string;
};
const msiCategoryFieldPrefix: Record<string, string> = {
  "User Licenses": "UserLicenses",
  "Unattended Production License": "UnattendedProd",
  "Unattended Test Robot License": "TestRobot",
  "AI Units": "AiUnits",
  "Platform Units": "PlatformUnits",
  "Agent Units": "AgentUnits",
};
const entitlementCategoryGroups: Record<string, string[]> = {
  "User Licenses": [
    "User Licenses",
    "Basic",
    "Pro",
    "Plus",
    "Automation Developer - Named User",
    "Citizen Developer - Named User",
    "Attended - Named User",
    "Action Center - Named User",
    "Tester - Named User",
    "App Tester - Named User",
    "App Test Developer - Named User",
  ],
  "Unattended Production License": ["Unattended Robot"],
  "Unattended Test Robot License": ["Test Robot"],
  "AI Units": ["AI Units"],
  "Platform Units": ["Platform Units"],
  "Agent Units": ["Agentic Units"],
};
const rollupEntitlementFields: Record<string, keyof RollupRow> = {
  "User Licenses": "UserLicenseEntitlements",
  "Unattended Production License": "UnattendedProdEntitlements",
  "Unattended Test Robot License": "TestRobotEntitlements",
  "AI Units": "AiUnitsEntitlements",
  "Platform Units": "PlatformUnitsEntitlements",
  "Agent Units": "AgentUnitsEntitlements",
};
const categories = [
  { source: "User Licenses", label: "User Licenses" },
  { source: "Unattended Production License", label: "Unattended Production" },
  { source: "Unattended Test Robot License", label: "Unattended Test" },
  { source: "AI Units", label: "AI Units" },
  { source: "Platform Units", label: "Platform Units" },
  { source: "Agent Units", label: "Agent Units" },
];
const identityLabels = [
  "Customer Name",
  "Deployment Type",
  "Contract Expiry Date",
  "License Count",
];
const metadataLabels = [
  "Geo",
  "Region",
  "Area",
  "Earliest Active Contract End Date",
  "AE",
  "CSD",
  "CSM",
  "TAM",
  "Customer Support Package",
  "Customer ID",
  "Parent Company Name",
  "Latest As of Date",
  "Quarter",
  "Last Updated",
];
const metricMeasures = ["Purchased", "Allocated", "Utilized", "Percentage"];
const metricLabels = categories.flatMap((c) =>
  metricMeasures.map((m) => `${c.label} ${m}`),
);
const columnLabels = [...identityLabels, ...metricLabels, ...metadataLabels];
const defaultColumnWidths = [
  230,
  150,
  180,
  120,
  ...categories.flatMap(() => [100, 105, 105, 110]),
  90,
  270,
  130,
  175,
  175,
  180,
  160,
  180,
  180,
  170,
  190,
  220,
  110,
  115,
  130,
];
const identitySortFields: Record<string, keyof RollupRow> = {
  "Customer Name": "CustomerName",
  "Deployment Type": "DeploymentType",
  "Contract Expiry Date": "LatestActiveContractEndDate",
  "License Count": "ActiveLicenseKeyCount",
};
const metadataSortFields: Record<string, keyof RollupRow | "quarter" | "lastUpdated"> = {
  Geo: "CustomerGeo",
  Region: "CustomerRegion",
  Area: "CustomerArea",
  "Earliest Active Contract End Date": "EarliestActiveContractEndDate",
  AE: "AccountOwnerName",
  CSD: "CsdName",
  CSM: "CustomerSuccessManagerName",
  TAM: "TamName",
  "Customer Support Package": "CustomerSupportPackage",
  "Customer ID": "CustomerId",
  "Parent Company Name": "ParentCompanyName",
  "Latest As of Date": "LatestAsOfDate",
  Quarter: "quarter",
  "Last Updated": "lastUpdated",
};
const metricSortFields: Record<
  string,
  { source: string; field: "entitlements" | "purchased" | "utilized" | "percentage" }
> = (() => {
  const map: Record<
    string,
    { source: string; field: "entitlements" | "purchased" | "utilized" | "percentage" }
  > = {};
  categories.forEach((c) => {
    map[`${c.label} Purchased`] = { source: c.source, field: "entitlements" };
    map[`${c.label} Allocated`] = { source: c.source, field: "purchased" };
    map[`${c.label} Utilized`] = { source: c.source, field: "utilized" };
    map[`${c.label} Percentage`] = { source: c.source, field: "percentage" };
  });
  return map;
})();
const getSortValue = (row: PivotRow, column: string): string | number | null => {
  if (column in identitySortFields) {
    return row[identitySortFields[column]] as string | number;
  }
  if (column in metadataSortFields) {
    return row[metadataSortFields[column]] as string | number;
  }
  const metricField = metricSortFields[column];
  if (metricField) {
    const metric = row.metrics[metricField.source];
    if (metricField.field === "entitlements") return metric.entitlements;
    return metric.present ? metric[metricField.field] : null;
  }
  return null;
};
const compareSortValues = (
  a: string | number | null,
  b: string | number | null,
) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};
const optionList = (allLabel: string, values: string[]) => [
  allLabel,
  ...Array.from(new Set(values.filter(Boolean))).sort(),
];
type ExportValue = string | number | null | undefined;
const escapeCsvValue = (value: ExportValue) => {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
const exportCsv = (
  filename: string,
  headers: string[],
  rows: ExportValue[][],
) => {
  const lines = [headers, ...rows].map((line) =>
    line.map(escapeCsvValue).join(","),
  );
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  downloadBlob(blob, filename);
};
const exportXlsx = (
  filename: string,
  sheetName: string,
  headers: string[],
  rows: ExportValue[][],
) => {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
};
const detailSortFields: Record<string, keyof DetailRow> = {
  "License Code": "LicenseCode",
  "License Type": "LicenseType",
  "License Category": "LicenseCategory",
  Deployment: "DeploymentType",
  "As of Date": "AsOfDate",
  Purchased: "PurchasedEntitlements",
  Allocated: "PurchasedUnits",
  Utilized: "UtilizedUnits",
  Utilization: "UtilizationPercent",
  "Robot Bought Hours / Month": "RobotBoughtHoursMonthly",
  "Robot Execution Hours / Month": "RobotExecutionHoursMonthly",
  "Robot Monthly Execution %": "RobotMonthlyExecutionPercent",
  "Contract End": "CurrentContractEndDate",
  "License Status": "LicenseStatus",
};
const getDetailSortValue = (
  row: DetailRow,
  column: string,
): string | number | null => {
  if (column === "Utilization") {
    return row.PurchasedEntitlements != null && row.PurchasedEntitlements > 0
      ? ((Number(row.UtilizedUnits) || 0) / row.PurchasedEntitlements) * 100
      : null;
  }
  if (column === "Quarter") return fiscalQuarter(row.UpdateTime);
  if (column === "Last Updated") return row.UpdateTime ?? null;
  const field = detailSortFields[column];
  if (!field) return null;
  const value = row[field];
  return value == null ? null : (value as string | number);
};
const deploymentCapabilities = (value: string | null | undefined) => {
  const normalized = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const capabilities: string[] = [];
  if (normalized.includes("automationcloud")) capabilities.push("Automation Cloud");
  if (normalized.includes("msi")) capabilities.push("MSI");
  if (normalized.includes("automationsuite")) capabilities.push("Automation Suite");
  if (normalized.includes("dedicated")) capabilities.push("Dedicated");
  return capabilities;
};
// UiPath fiscal year: Feb 1 - Jan 31, labeled by the calendar year Jan 31 falls in.
// Q1 Feb-Apr, Q2 May-Jul, Q3 Aug-Oct, Q4 Nov-Jan.
// The Entities SDK returns custom fields using whatever casing the field was
// created with (e.g. "customerName"), while the `uip df` CLI normalizes to
// PascalCase for display. Every entity field in this app is authored and read
// as PascalCase (CustomerName, DeploymentType, ...), so normalize every raw
// record's keys to PascalCase right after fetching, before anything reads it.
const toPascalRecord = <T,>(record: Record<string, unknown>): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    result[pascalKey] = value;
  }
  return result as T;
};
const toPascalRecords = <T,>(records: unknown[]): T[] =>
  (records as Record<string, unknown>[]).map((r) => toPascalRecord<T>(r));
const fiscalQuarter = (dateInput?: string | null): string => {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "—";
  const month = d.getUTCMonth(); // 0 = Jan
  const year = d.getUTCFullYear();
  if (month === 0) return `FY${year} Q4`;
  if (month <= 3) return `FY${year + 1} Q1`;
  if (month <= 6) return `FY${year + 1} Q2`;
  if (month <= 9) return `FY${year + 1} Q3`;
  return `FY${year + 1} Q4`;
};
const formatUpdateDate = (dateInput?: string | null) =>
  dateInput && !Number.isNaN(new Date(dateInput).getTime())
    ? new Date(dateInput).toLocaleDateString()
    : "—";
const percentageClass = (value: number) =>
  value >= 70 ? "high" : value >= 40 ? "medium" : "low";
type RiskLevel = "high" | "medium" | "low" | "unknown";
const computeAccountRisk = (
  utilization: AccountUtilizationSummary | undefined,
  renewalDate?: string,
): { level: RiskLevel; label: string; reason: string } => {
  const percent = utilization?.hasData ? utilization.percent : null;
  let daysToRenewal: number | null = null;
  if (renewalDate) {
    const parsed = new Date(renewalDate);
    if (!Number.isNaN(parsed.getTime())) {
      daysToRenewal = Math.round((parsed.getTime() - Date.now()) / 86400000);
    }
  }
  if (percent == null) {
    return {
      level: "unknown",
      label: "No Data",
      reason: "No utilization data available yet for this account.",
    };
  }
  const renewalSoon = daysToRenewal != null && daysToRenewal <= 180;
  const renewalNote =
    daysToRenewal == null
      ? ""
      : daysToRenewal < 0
        ? " and the renewal date has passed"
        : ` and renews in ${daysToRenewal} day${daysToRenewal === 1 ? "" : "s"}`;
  if (percent < 25 || (percent < 40 && renewalSoon)) {
    return {
      level: "high",
      label: "High Risk",
      reason: `Only ${percent.toFixed(0)}% of purchased licenses are utilized${renewalNote} — flag for CS/AE follow-up before renewal.`,
    };
  }
  if (percent < 60) {
    return {
      level: "medium",
      label: "Watch",
      reason: `${percent.toFixed(0)}% utilized${renewalNote} — below-healthy adoption, worth a check-in.`,
    };
  }
  return {
    level: "low",
    label: "Healthy",
    reason: `${percent.toFixed(0)}% utilized${renewalNote} — healthy adoption.`,
  };
};
type BurndownPoint = {
  date: string;
  consumed: number;
  cumulative: number;
  available: number;
  forecast?: boolean;
};
const monthKey = (isoDate: string) => isoDate.slice(0, 7);
const addDaysIso = (isoDate: string, days: number) => {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const addMonthsIso = (isoDate: string, months: number) => {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 7);
};
const buildDailySeries = (rows: BurndownRow[]): { points: BurndownPoint[]; purchased: number } => {
  const sorted = [...rows].sort((a, b) => a.ConsumptionDate.localeCompare(b.ConsumptionDate));
  const purchased = sorted.length ? Number(sorted[sorted.length - 1].PurchasedUnits) || 0 : 0;
  const points = sorted.map((r) => ({
    date: r.ConsumptionDate,
    consumed: Number(r.DailyConsumedUnits) || 0,
    cumulative: Number(r.CumulativeConsumedUnits) || 0,
    available: Number(r.AvailableUnits ?? Math.max(purchased - (Number(r.CumulativeConsumedUnits) || 0), 0)),
  }));
  return { points, purchased };
};
const buildMonthlySeries = (rows: BurndownRow[]): { points: BurndownPoint[]; purchased: number } => {
  const { points: daily, purchased } = buildDailySeries(rows);
  const byMonth = new Map<string, number>();
  daily.forEach((p) => {
    const key = monthKey(p.date);
    byMonth.set(key, (byMonth.get(key) ?? 0) + p.consumed);
  });
  const months = Array.from(byMonth.keys()).sort();
  let cumulative = 0;
  const points = months.map((m) => {
    const consumed = byMonth.get(m) ?? 0;
    cumulative += consumed;
    return {
      date: m,
      consumed,
      cumulative,
      available: Math.max(purchased - cumulative, 0),
    };
  });
  return { points, purchased };
};
const forecastSeries = (
  points: BurndownPoint[],
  purchased: number,
  horizon: number,
  unit: "day" | "month",
): BurndownPoint[] => {
  if (points.length < 2) return [];
  const first = points[0];
  const last = points[points.length - 1];
  const span = points.length - 1;
  const rate = (last.cumulative - first.cumulative) / Math.max(span, 1);
  const forecastPoints: BurndownPoint[] = [];
  let cumulative = last.cumulative;
  let date = last.date;
  for (let i = 0; i < horizon; i++) {
    date = unit === "day" ? addDaysIso(date, 1) : addMonthsIso(date, 1);
    cumulative += rate;
    forecastPoints.push({
      date,
      consumed: rate,
      cumulative,
      available: Math.max(purchased - cumulative, 0),
      forecast: true,
    });
  }
  return forecastPoints;
};
const aggregateBurndownAcrossCustomers = (
  rows: BurndownRow[],
): { points: BurndownPoint[]; purchased: number } => {
  const latestPurchasedByCustomer = new Map<string, number>();
  const sortedForPurchased = [...rows].sort((a, b) => a.ConsumptionDate.localeCompare(b.ConsumptionDate));
  sortedForPurchased.forEach((r) => {
    latestPurchasedByCustomer.set(r.CustomerId, Number(r.PurchasedUnits) || 0);
  });
  const purchased = Array.from(latestPurchasedByCustomer.values()).reduce((a, b) => a + b, 0);
  const consumedByDate = new Map<string, number>();
  rows.forEach((r) => {
    consumedByDate.set(
      r.ConsumptionDate,
      (consumedByDate.get(r.ConsumptionDate) ?? 0) + (Number(r.DailyConsumedUnits) || 0),
    );
  });
  const dates = Array.from(consumedByDate.keys()).sort();
  let cumulative = 0;
  const points = dates.map((date) => {
    const consumed = consumedByDate.get(date) ?? 0;
    cumulative += consumed;
    return { date, consumed, cumulative, available: Math.max(purchased - cumulative, 0) };
  });
  return { points, purchased };
};
const aggregateBurndownMonthly = (rows: BurndownRow[]): { points: BurndownPoint[]; purchased: number } => {
  const { points: daily, purchased } = aggregateBurndownAcrossCustomers(rows);
  const byMonth = new Map<string, number>();
  daily.forEach((p) => {
    const key = monthKey(p.date);
    byMonth.set(key, (byMonth.get(key) ?? 0) + p.consumed);
  });
  const months = Array.from(byMonth.keys()).sort();
  let cumulative = 0;
  const points = months.map((m) => {
    const consumed = byMonth.get(m) ?? 0;
    cumulative += consumed;
    return { date: m, consumed, cumulative, available: Math.max(purchased - cumulative, 0) };
  });
  return { points, purchased };
};
const daysBetweenIso = (a: string, b: string) => {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
};
type ContractTermType = "Short-Term" | "1-Year" | "Multi-Year" | "Unknown";
const classifyContractTerm = (startDate?: string, endDate?: string): ContractTermType => {
  if (!startDate || !endDate) return "Unknown";
  const totalDays = daysBetweenIso(startDate, endDate) + 1;
  if (totalDays < 330) return "Short-Term";
  if (totalDays <= 400) return "1-Year";
  return "Multi-Year";
};
type PaceRow = {
  customerId: string;
  customerName: string;
  unitLabel: string;
  purchased: number;
  utilized: number;
  utilizationPercent: number | null;
  termElapsedPercent: number | null;
  paceRatio: number | null;
  burnTrendPercent: number | null;
  entitlementStartDate?: string;
  entitlementEndDate?: string;
  contractTermType: ContractTermType;
  dailyBurnRate: number;
  monthlyBurnRate: number;
  projectedConsumedByTermEnd: number | null;
  projectedRemainingByTermEnd: number | null;
  projectedUtilizationPercentByTermEnd: number | null;
  underConsumptionRisk: boolean;
};
const computePaceRows = (rows: BurndownRow[], unitLabel: string): PaceRow[] => {
  const byCustomer = new Map<string, BurndownRow[]>();
  rows.forEach((r) => {
    const list = byCustomer.get(r.CustomerId) ?? [];
    list.push(r);
    byCustomer.set(r.CustomerId, list);
  });
  const todayIso = new Date().toISOString().slice(0, 10);
  const result: PaceRow[] = [];
  byCustomer.forEach((custRows, customerId) => {
    const sorted = [...custRows].sort((a, b) => a.ConsumptionDate.localeCompare(b.ConsumptionDate));
    const last = sorted[sorted.length - 1];
    const purchased = Number(last.PurchasedUnits) || 0;
    const utilized = Number(last.CumulativeConsumedUnits) || 0;
    const utilizationPercent = purchased > 0 ? (utilized / purchased) * 100 : null;

    let termElapsedPercent: number | null = null;
    if (last.EntitlementStartDate && last.EntitlementEndDate) {
      const totalDays = daysBetweenIso(last.EntitlementStartDate, last.EntitlementEndDate) + 1;
      const elapsedDays = Math.min(
        daysBetweenIso(last.EntitlementStartDate, todayIso) + 1,
        totalDays,
      );
      termElapsedPercent = totalDays > 0 ? (Math.max(elapsedDays, 0) / totalDays) * 100 : null;
    }
    const paceRatio =
      utilizationPercent != null && termElapsedPercent != null && termElapsedPercent > 0.01
        ? utilizationPercent / termElapsedPercent
        : null;

    const windowSize = Math.min(30, Math.floor(sorted.length / 2)) || Math.min(sorted.length, 7);
    const recentWindow = sorted.slice(-windowSize);
    const priorWindow = sorted.slice(-windowSize * 2, -windowSize);
    const avg = (list: BurndownRow[]) =>
      list.length ? list.reduce((sum, r) => sum + (Number(r.DailyConsumedUnits) || 0), 0) / list.length : 0;
    const recentRate = avg(recentWindow);
    const priorRate = avg(priorWindow);
    const burnTrendPercent =
      priorWindow.length > 0
        ? priorRate > 0
          ? ((recentRate - priorRate) / priorRate) * 100
          : recentRate > 0
            ? 100
            : 0
        : null;

    const contractTermType = classifyContractTerm(last.EntitlementStartDate, last.EntitlementEndDate);

    const dailyBurnRate = recentRate;
    const monthlyBurnRate = recentRate * 30.44;
    let projectedConsumedByTermEnd: number | null = null;
    let projectedRemainingByTermEnd: number | null = null;
    let projectedUtilizationPercentByTermEnd: number | null = null;
    let underConsumptionRisk = false;
    if (last.EntitlementEndDate) {
      const daysRemainingInTerm = Math.max(
        daysBetweenIso(last.ConsumptionDate, last.EntitlementEndDate),
        0,
      );
      const projectedAdditional = dailyBurnRate * daysRemainingInTerm;
      projectedConsumedByTermEnd = utilized + projectedAdditional;
      projectedRemainingByTermEnd = purchased - projectedConsumedByTermEnd;
      projectedUtilizationPercentByTermEnd =
        purchased > 0 ? (projectedConsumedByTermEnd / purchased) * 100 : null;
      underConsumptionRisk =
        projectedUtilizationPercentByTermEnd != null && projectedUtilizationPercentByTermEnd < 95;
    }

    result.push({
      customerId,
      customerName: last.CustomerName,
      unitLabel,
      purchased,
      utilized,
      utilizationPercent,
      termElapsedPercent,
      paceRatio,
      burnTrendPercent,
      entitlementStartDate: last.EntitlementStartDate,
      entitlementEndDate: last.EntitlementEndDate,
      contractTermType,
      dailyBurnRate,
      monthlyBurnRate,
      projectedConsumedByTermEnd,
      projectedRemainingByTermEnd,
      projectedUtilizationPercentByTermEnd,
      underConsumptionRisk,
    });
  });
  return result;
};
const hasMetricData = (
  allocated?: number | null,
  utilized?: number | null,
  percentage?: number | null,
) =>
  percentage != null || Number(allocated) > 0 || Number(utilized) > 0;
const fitColumn = (
  label: string,
  values: unknown[],
  min: number,
  max: number,
) => {
  const longest = Math.max(
    label.length,
    ...values.map((value) => String(value ?? "—").length),
  );
  return Math.min(max, Math.max(min, longest * 7 + 28));
};
const mainAutoFitWidths = (rows: RollupRow[]) => {
  const values = (field: keyof RollupRow) => rows.map((row) => row[field]);
  const metricFields: [
    keyof RollupRow,
    keyof RollupRow,
    keyof RollupRow,
    keyof RollupRow,
  ][] = [
    ["UserLicenseEntitlements", "UserLicensePurchased", "UserLicenseUtilized", "UserLicenseUtilizationPercent"],
    ["UnattendedProdEntitlements", "UnattendedProdPurchased", "UnattendedProdUtilized", "UnattendedProdUtilizationPercent"],
    ["TestRobotEntitlements", "TestRobotPurchased", "TestRobotUtilized", "TestRobotUtilizationPercent"],
    ["AiUnitsEntitlements", "AiUnitsPurchased", "AiUnitsUtilized", "AiUnitsUtilizationPercent"],
    ["PlatformUnitsEntitlements", "PlatformUnitsPurchased", "PlatformUnitsUtilized", "PlatformUnitsUtilizationPercent"],
    ["AgentUnitsEntitlements", "AgentUnitsPurchased", "AgentUnitsUtilized", "AgentUnitsUtilizationPercent"],
  ];
  return [
    fitColumn("Customer Name", values("CustomerName"), 180, 320),
    fitColumn("Deployment Type", values("DeploymentType"), 130, 230),
    fitColumn("Contract Expiry Date", values("LatestActiveContractEndDate"), 155, 220),
    fitColumn("License Count", values("ActiveLicenseKeyCount"), 105, 135),
    ...metricFields.flatMap(([entitlements, purchased, utilized, percent]) => [
      fitColumn("Purchased", values(entitlements), 90, 140),
      fitColumn("Allocated", values(purchased), 95, 145),
      fitColumn("Utilized", values(utilized), 95, 145),
      fitColumn("Percentage", values(percent), 105, 145),
    ]),
    fitColumn("Geo", values("CustomerGeo"), 75, 110),
    fitColumn("Region", values("CustomerRegion"), 130, 290),
    fitColumn("Area", values("CustomerArea"), 105, 190),
    fitColumn("Earliest Active Contract End Date", values("EarliestActiveContractEndDate"), 185, 230),
    fitColumn("AE", values("AccountOwnerName"), 120, 230),
    fitColumn("CSD", values("CsdName"), 110, 230),
    fitColumn("CSM", values("CustomerSuccessManagerName"), 110, 230),
    fitColumn("TAM", values("TamName"), 110, 230),
    fitColumn("Customer Support Package", values("CustomerSupportPackage"), 165, 220),
    fitColumn("Customer ID", values("CustomerId"), 175, 210),
    fitColumn("Parent Company Name", values("ParentCompanyName"), 170, 320),
    fitColumn("Latest As of Date", values("LatestAsOfDate"), 115, 150),
    fitColumn(
      "Quarter",
      values("UpdateTime").map((v) => fiscalQuarter(v as string)),
      95,
      115,
    ),
    fitColumn(
      "Last Updated",
      values("UpdateTime").map((v) => formatUpdateDate(v as string)),
      105,
      135,
    ),
  ];
};
const detailLabels = [
  "License Code",
  "License Type",
  "License Category",
  "Deployment",
  "As of Date",
  "Purchased",
  "Allocated",
  "Utilized",
  "Utilization",
  "Robot Bought Hours / Month",
  "Robot Execution Hours / Month",
  "Robot Monthly Execution %",
  "Contract End",
  "License Status",
  "Quarter",
  "Last Updated",
];
const detailAutoFitWidths = (rows: DetailRow[]) => [
  fitColumn(detailLabels[0], rows.map((r) => r.LicenseCode), 150, 190),
  fitColumn(detailLabels[1], rows.map((r) => r.LicenseType), 115, 190),
  fitColumn(detailLabels[2], rows.map((r) => r.LicenseCategory), 150, 245),
  fitColumn(detailLabels[3], rows.map((r) => r.DeploymentType), 120, 220),
  fitColumn(detailLabels[4], rows.map((r) => r.AsOfDate), 105, 140),
  fitColumn(detailLabels[5], rows.map((r) => r.PurchasedEntitlements), 95, 135),
  fitColumn(detailLabels[6], rows.map((r) => r.PurchasedUnits), 95, 135),
  fitColumn(detailLabels[7], rows.map((r) => r.UtilizedUnits), 95, 135),
  fitColumn(detailLabels[8], rows.map((r) => r.UtilizationPercent), 105, 140),
  fitColumn(detailLabels[9], rows.map((r) => r.RobotBoughtHoursMonthly), 175, 225),
  fitColumn(detailLabels[10], rows.map((r) => r.RobotExecutionHoursMonthly), 190, 245),
  fitColumn(detailLabels[11], rows.map((r) => r.RobotMonthlyExecutionPercent), 185, 235),
  fitColumn(detailLabels[12], rows.map((r) => r.CurrentContractEndDate), 115, 155),
  fitColumn(detailLabels[13], rows.map((r) => r.LicenseStatus), 115, 170),
  fitColumn(detailLabels[14], rows.map((r) => fiscalQuarter(r.UpdateTime)), 95, 115),
  fitColumn(detailLabels[15], rows.map((r) => formatUpdateDate(r.UpdateTime)), 105, 135),
];

function MultiSelectFilter({
  options,
  selected,
  onChange,
  allLabel,
  formatOption,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  formatOption?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);
  const display = (v: string) => (formatOption ? formatOption(v) : v);
  const toggleValue = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };
  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? display(selected[0])
        : `${selected.length} selected`;
  return (
    <div className="multiselect" ref={ref}>
      <button
        type="button"
        className="multiselect-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="multiselect-summary" title={summary}>
          {summary}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="multiselect-menu">
          <button
            type="button"
            className="multiselect-clear"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
          >
            Clear ({allLabel})
          </button>
          <div className="multiselect-options">
            {options.map((opt) => (
              <label key={opt} className="multiselect-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggleValue(opt)}
                />
                <span>{display(opt)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
const customerAccountDirectoryEntityId = "0f441ea7-c5a8-f111-9b33-6045bda94b17";
type DirectoryRow = {
  Id: string;
  CustomerId: string;
  CustomerName: string;
  AccountOwnerName: string;
  CustomerGeo: string;
  CustomerArea: string;
  CustomerRegion: string;
  ActiveCustomer?: boolean;
  CsdName: string;
  TamName: string;
  CustomerSuccessManagerName: string;
  ParentCompanyName: string;
  LastSyncedAt?: string;
  RenewalDate?: string;
  ActiveFinancialArr?: number;
};
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
type BurndownMode = "daily" | "monthly";
function BurndownChart({
  title,
  rows,
  aggregate,
  unitLabel,
}: {
  title: string;
  rows: BurndownRow[];
  aggregate?: boolean;
  unitLabel: string;
}) {
  const [mode, setMode] = useState<BurndownMode>("daily");
  const { chartData, purchased, hasData } = useMemo(() => {
    if (!rows.length) return { chartData: [], purchased: 0, hasData: false };
    const { points, purchased } =
      mode === "daily"
        ? aggregate
          ? aggregateBurndownAcrossCustomers(rows)
          : buildDailySeries(rows)
        : aggregate
          ? aggregateBurndownMonthly(rows)
          : buildMonthlySeries(rows);
    if (!points.length) return { chartData: [], purchased, hasData: false };
    let horizon = 10;
    if (!aggregate) {
      const entitlementEndDate = [...rows].sort((a, b) =>
        a.ConsumptionDate.localeCompare(b.ConsumptionDate),
      )[rows.length - 1].EntitlementEndDate;
      const lastPointDate = points[points.length - 1].date;
      if (entitlementEndDate) {
        horizon =
          mode === "daily"
            ? Math.max(daysBetweenIso(lastPointDate, entitlementEndDate), 0)
            : Math.max(
                daysBetweenIso(lastPointDate + "-01", monthKey(entitlementEndDate) + "-01") / 30,
                0,
              );
        horizon = Math.round(horizon);
      }
    }
    const forecastPts = forecastSeries(points, purchased, horizon, mode === "daily" ? "day" : "month");
    const data: Array<{ date: string; available?: number; availableForecast?: number }> = points.map((p) => ({
      date: p.date,
      available: Math.round(p.available * 100) / 100,
    }));
    if (forecastPts.length && data.length) {
      data[data.length - 1] = { ...data[data.length - 1], availableForecast: data[data.length - 1].available };
      forecastPts.forEach((p) => {
        data.push({ date: p.date, availableForecast: Math.round(p.available * 100) / 100 });
      });
    }
    return { chartData: data, purchased, hasData: true };
  }, [rows, mode, aggregate]);
  const paceRow = useMemo(
    () => (aggregate ? null : computePaceRows(rows, unitLabel)[0]),
    [rows, aggregate, unitLabel],
  );

  return (
    <section className="burndown-card">
      <div className="burndown-header">
        <div>
          <h3>{title}</h3>
          <p>
            {unitLabel} burndown
            {aggregate
              ? ` vs. next ${mode === "daily" ? "10 days" : "10 months"} forecast`
              : " — forecast runs to the entitlement term end"}
            {purchased > 0 && ` — ${compactNumber.format(purchased)} purchased`}
          </p>
        </div>
        <div className="burndown-toggle">
          <button
            className={mode === "daily" ? "burndown-toggle-btn active" : "burndown-toggle-btn"}
            onClick={() => setMode("daily")}
          >
            Daily
          </button>
          <button
            className={mode === "monthly" ? "burndown-toggle-btn active" : "burndown-toggle-btn"}
            onClick={() => setMode("monthly")}
          >
            Monthly
          </button>
        </div>
      </div>
      {paceRow && (
        <div className={`burndown-callout${paceRow.underConsumptionRisk ? " risk" : ""}`}>
          {paceRow.projectedUtilizationPercentByTermEnd != null ? (
            paceRow.underConsumptionRisk ? (
              <>
                <AlertTriangle size={14} />
                {paceRow.contractTermType !== "Unknown" && `${paceRow.contractTermType} contract — `}
                if consumption doesn't pick up, {paceRow.customerName} will only reach{" "}
                <strong>{Math.max(paceRow.projectedUtilizationPercentByTermEnd, 0).toFixed(0)}%</strong>{" "}
                utilization by contract end
                {paceRow.entitlementEndDate ? ` (${paceRow.entitlementEndDate})` : ""}, forfeiting{" "}
                <strong>
                  {number.format(Math.max(paceRow.projectedRemainingByTermEnd ?? 0, 0))} {unitLabel}
                </strong>{" "}
                of unused entitlement.
              </>
            ) : (
              <>
                {paceRow.contractTermType !== "Unknown" && `${paceRow.contractTermType} contract — `}
                on pace to reach{" "}
                <strong>{Math.max(paceRow.projectedUtilizationPercentByTermEnd, 0).toFixed(0)}%</strong>{" "}
                utilization by contract end{paceRow.entitlementEndDate ? ` (${paceRow.entitlementEndDate})` : ""} —
                full entitlement on track to be used.
              </>
            )
          ) : (
            <>No consumption data yet — utilization at contract end can't be projected.</>
          )}
          {paceRow.paceRatio != null && (
            <span className="burndown-pace-chip">
              Pace {paceRow.paceRatio.toFixed(2)}x term
            </span>
          )}
        </div>
      )}
      {paceRow && (
        <div className="burndown-stat-grid">
          <div className="burndown-stat">
            <span>Daily Burn Rate</span>
            <strong>{number.format(paceRow.dailyBurnRate)}</strong>
          </div>
          <div className="burndown-stat">
            <span>Monthly Burn Rate</span>
            <strong>{number.format(paceRow.monthlyBurnRate)}</strong>
          </div>
          <div className="burndown-stat">
            <span>Contract Term ({paceRow.contractTermType})</span>
            <strong className="burndown-stat-term">
              {paceRow.entitlementStartDate || "—"} → {paceRow.entitlementEndDate || "—"}
            </strong>
          </div>
          <div className={`burndown-stat${paceRow.underConsumptionRisk ? " risk" : ""}`}>
            <span>Projected Utilization by Contract End</span>
            <strong>
              {paceRow.projectedUtilizationPercentByTermEnd != null
                ? `${Math.max(paceRow.projectedUtilizationPercentByTermEnd, 0).toFixed(0)}%`
                : "—"}
            </strong>
            {paceRow.underConsumptionRisk && (
              <small className="burndown-stat-flag">
                <AlertTriangle size={11} /> Unused entitlement will be lost — flag for CS/AE
              </small>
            )}
          </div>
          <div className={`burndown-stat${paceRow.underConsumptionRisk ? " risk" : ""}`}>
            <span>Units at Risk of Forfeiture</span>
            <strong>
              {paceRow.projectedRemainingByTermEnd != null
                ? number.format(Math.max(paceRow.projectedRemainingByTermEnd, 0))
                : "—"}
            </strong>
          </div>
        </div>
      )}
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#667085" }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#667085" }}
              tickFormatter={(v: number) => compactNumber.format(v)}
              width={48}
            />
            <Tooltip
              formatter={(value: number) => number.format(value)}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="available"
              name="Available (actual)"
              stroke="#f04b23"
              fill="#fde6de"
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="availableForecast"
              name="Available (forecast)"
              stroke="#98a2b3"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="burndown-empty">No Snowflake consumption data available for this selection yet.</p>
      )}
    </section>
  );
}
type PaceBand = "fast" | "onpace" | "slow" | "unknown";
const paceBand = (ratio: number | null): PaceBand => {
  if (ratio == null) return "unknown";
  if (ratio > 1.2) return "fast";
  if (ratio < 0.8) return "slow";
  return "onpace";
};
const paceBandLabel: Record<PaceBand, string> = {
  fast: "Burning Fast",
  onpace: "On Pace",
  slow: "Under-Pace",
  unknown: "New / No Term Data",
};
function PaceLeaderboard({
  sources,
  onSelectCustomer,
  onOpenDrawer,
}: {
  sources: { unitLabel: string; rows: BurndownRow[] }[];
  onSelectCustomer: (customerId: string) => void;
  onOpenDrawer: (content: DrawerContent) => void;
}) {
  const [unitFilter, setUnitFilter] = useState<string>("All");
  const paceRows = useMemo(() => {
    const all = sources.flatMap(({ unitLabel, rows }) => computePaceRows(rows, unitLabel));
    return all.sort((a, b) => {
      const ra = a.paceRatio ?? -1;
      const rb = b.paceRatio ?? -1;
      return rb - ra;
    });
  }, [sources]);
  const filtered =
    unitFilter === "All" ? paceRows : paceRows.filter((r) => r.unitLabel === unitFilter);
  const fastCount = paceRows.filter((r) => paceBand(r.paceRatio) === "fast").length;

  if (!paceRows.length) return null;

  return (
    <section className="burndown-card">
      <div className="burndown-header">
        <div>
          <h3>Consumption Pace — All Accounts</h3>
          <p>
            Utilization% vs. term-elapsed% per account, so a Feb–Feb term and a Dec–Dec term compare
            fairly. Entitlements not consumed by contract end are forfeited — risk below reflects
            projected utilization at contract end, not a future burn-out date.{" "}
            {fastCount > 0 && `${fastCount} account${fastCount === 1 ? "" : "s"} burning faster than their term pace.`}
          </p>
        </div>
        <div className="burndown-toggle">
          {["All", ...sources.map((s) => s.unitLabel)].map((label) => (
            <button
              key={label}
              className={unitFilter === label ? "burndown-toggle-btn active" : "burndown-toggle-btn"}
              onClick={() => setUnitFilter(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <table className="condensed-table no-scroll-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Unit</th>
            <th>Purchased</th>
            <th>Utilized</th>
            <th>Pace</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const band = paceBand(r.paceRatio);
            const openDetails = () =>
              onOpenDrawer({
                title: r.customerName,
                subtitle: `${r.unitLabel} — pace &amp; contract detail`.replace("&amp;", "&"),
                sections: [
                  {
                    rows: [
                      { label: "Utilization %", value: r.utilizationPercent != null ? `${r.utilizationPercent.toFixed(0)}%` : "—" },
                      { label: "Term Elapsed %", value: r.termElapsedPercent != null ? `${r.termElapsedPercent.toFixed(0)}%` : "—" },
                      {
                        label: "Burn Trend",
                        value:
                          r.burnTrendPercent != null
                            ? `${r.burnTrendPercent > 0 ? "▲" : r.burnTrendPercent < 0 ? "▼" : "→"} ${Math.abs(r.burnTrendPercent).toFixed(0)}%`
                            : "—",
                      },
                      { label: "Contract Term", value: r.contractTermType },
                      {
                        label: "Contract Dates",
                        value: `${r.entitlementStartDate || "—"} → ${r.entitlementEndDate || "—"}`,
                      },
                      {
                        label: "Projected Utilization @ Contract End",
                        value:
                          r.projectedUtilizationPercentByTermEnd != null
                            ? `${Math.max(r.projectedUtilizationPercentByTermEnd, 0).toFixed(0)}%${r.underConsumptionRisk ? " ⚠" : ""}`
                            : "—",
                      },
                      {
                        label: "Units at Risk of Forfeiture",
                        value:
                          r.underConsumptionRisk && r.projectedRemainingByTermEnd != null
                            ? number.format(Math.max(r.projectedRemainingByTermEnd, 0))
                            : "—",
                      },
                    ],
                  },
                ],
              });
            return (
              <tr key={`${r.customerId}-${r.unitLabel}`}>
                <td className="customer">
                  <button className="customer-link" onClick={() => onSelectCustomer(r.customerId)}>
                    {r.customerName}
                  </button>
                </td>
                <td>{r.unitLabel}</td>
                <td>{compactNumber.format(r.purchased)}</td>
                <td>{compactNumber.format(r.utilized)}</td>
                <td>
                  <span className={`risk-badge risk-${band === "fast" ? "high" : band === "slow" ? "medium" : band === "onpace" ? "low" : "unknown"}`}>
                    {r.paceRatio != null ? `${r.paceRatio.toFixed(2)}x` : "—"} · {paceBandLabel[band]}
                    {r.underConsumptionRisk ? " ⚠" : ""}
                  </span>
                </td>
                <td>
                  <button className="details-trigger" onClick={openDetails}>
                    Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
function HomePage({
  entities,
  isAuthenticated,
  onSelectCustomer,
  onOpenDrawer,
  accountUtilization,
  platformBurndownRows,
  agentBurndownRows,
  aiBurndownRows,
}: {
  entities: Entities;
  isAuthenticated: boolean;
  onSelectCustomer: (customerId: string) => void;
  onOpenDrawer: (content: DrawerContent) => void;
  accountUtilization: Map<string, AccountUtilizationSummary>;
  platformBurndownRows: BurndownRow[];
  agentBurndownRows: BurndownRow[];
  aiBurndownRows: BurndownRow[];
}) {
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterRegion, setFilterRegion] = useState<string[]>([]);
  const [filterGeo, setFilterGeo] = useState<string[]>([]);
  const [filterCsd, setFilterCsd] = useState<string[]>([]);
  const [filterRisk, setFilterRisk] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<HomeSortColumn>("customerName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const toggleSort = (column: HomeSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const all: EntityRecord[] = [];
      let cursor: PaginationCursor | undefined;
      do {
        const result = (await entities.getAllRecords(
          customerAccountDirectoryEntityId,
          { pageSize: 1000, cursor },
        )) as PaginatedResponse<EntityRecord>;
        all.push(...result.items);
        cursor = result.hasNextPage ? result.nextCursor : undefined;
      } while (cursor);
      const records = toPascalRecords<DirectoryRow>(all);
      records.sort((a, b) => (a.CustomerName || "").localeCompare(b.CustomerName || ""));
      setRows(records);
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load active accounts",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (isAuthenticated) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const filterOptions = useMemo(
    () => ({
      regions: optionList("All Regions", rows.map((r) => r.CustomerRegion)),
      geos: optionList("All Geos", rows.map((r) => r.CustomerGeo)),
      csds: optionList("All CSDs", rows.map((r) => r.CsdName)),
      risks: ["All Risk Levels", "High Risk", "Watch", "Healthy", "No Data"],
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = rows.filter((r) => {
      if (q && !(r.CustomerName || "").toLowerCase().includes(q)) return false;
      if (filterRegion.length && !filterRegion.includes(r.CustomerRegion)) return false;
      if (filterGeo.length && !filterGeo.includes(r.CustomerGeo)) return false;
      if (filterCsd.length && !filterCsd.includes(r.CsdName)) return false;
      if (filterRisk.length) {
        const label = computeAccountRisk(accountUtilization.get(r.CustomerId), r.RenewalDate).label;
        if (!filterRisk.includes(label)) return false;
      }
      return true;
    });
    const dir = sortDirection === "asc" ? 1 : -1;
    const sorted = [...matches].sort((a, b) => {
      switch (sortColumn) {
        case "accountOwner":
          return (a.AccountOwnerName || "").localeCompare(b.AccountOwnerName || "") * dir;
        case "region":
          return (a.CustomerRegion || "").localeCompare(b.CustomerRegion || "") * dir;
        case "renewalDate":
          return (
            (a.RenewalDate || "").localeCompare(b.RenewalDate || "", undefined, {
              numeric: true,
            }) * dir
          );
        case "arr":
          return ((a.ActiveFinancialArr ?? -1) - (b.ActiveFinancialArr ?? -1)) * dir;
        case "utilization": {
          const ua = accountUtilization.get(a.CustomerId);
          const ub = accountUtilization.get(b.CustomerId);
          const va = ua?.hasData && ua.percent != null ? ua.percent : -1;
          const vb = ub?.hasData && ub.percent != null ? ub.percent : -1;
          return (va - vb) * dir;
        }
        case "risk": {
          const ra = computeAccountRisk(accountUtilization.get(a.CustomerId), a.RenewalDate);
          const rb = computeAccountRisk(accountUtilization.get(b.CustomerId), b.RenewalDate);
          return (riskSeverity[ra.level] - riskSeverity[rb.level]) * dir;
        }
        case "customerName":
        default:
          return (a.CustomerName || "").localeCompare(b.CustomerName || "") * dir;
      }
    });
    return sorted;
  }, [
    rows,
    search,
    filterRegion,
    filterGeo,
    filterCsd,
    filterRisk,
    sortColumn,
    sortDirection,
    accountUtilization,
  ]);

  const activeFilterCount =
    filterRegion.length + filterGeo.length + filterCsd.length + filterRisk.length;

  const stats = useMemo(() => {
    const regionCounts: Record<string, number> = {};
    let missingCsd = 0;
    let missingTam = 0;
    let lastSynced: string | undefined;
    let renewingSoon = 0;
    let arrRenewingSoon = 0;
    let atRisk = 0;
    let totalArr = 0;
    let arrAtRisk = 0;
    let utilizationSum = 0;
    let utilizationCount = 0;
    const now = new Date();
    const sixMonthsOut = new Date(now);
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
    const allAccounts: DrawerRow[] = [];
    const arrAccounts: DrawerRow[] = [];
    const renewingAccounts: DrawerRow[] = [];
    const atRiskAccounts: DrawerRow[] = [];
    const utilizationAccounts: DrawerRow[] = [];
    rows.forEach((r) => {
      if (r.CustomerRegion) {
        regionCounts[r.CustomerRegion] = (regionCounts[r.CustomerRegion] || 0) + 1;
      }
      if (!r.CsdName) missingCsd += 1;
      if (!r.TamName) missingTam += 1;
      if (r.LastSyncedAt && (!lastSynced || r.LastSyncedAt > lastSynced)) {
        lastSynced = r.LastSyncedAt;
      }
      allAccounts.push({ label: r.CustomerName, value: r.CustomerRegion || "—" });
      arrAccounts.push({
        label: r.CustomerName,
        value: r.ActiveFinancialArr != null ? currency.format(r.ActiveFinancialArr) : "—",
      });
      if (r.RenewalDate) {
        const renewal = new Date(r.RenewalDate);
        if (!Number.isNaN(renewal.getTime()) && renewal >= now && renewal <= sixMonthsOut) {
          renewingSoon += 1;
          if (r.ActiveFinancialArr != null) arrRenewingSoon += r.ActiveFinancialArr;
          renewingAccounts.push({
            label: r.CustomerName,
            value: `${r.RenewalDate}${r.ActiveFinancialArr != null ? ` — ${currency.format(r.ActiveFinancialArr)}` : ""}`,
          });
        }
      }
      if (r.ActiveFinancialArr != null) totalArr += r.ActiveFinancialArr;
      const risk = computeAccountRisk(accountUtilization.get(r.CustomerId), r.RenewalDate);
      if (risk.level === "high") {
        atRisk += 1;
        if (r.ActiveFinancialArr != null) arrAtRisk += r.ActiveFinancialArr;
        atRiskAccounts.push({
          label: r.CustomerName,
          value: `${risk.label}${r.ActiveFinancialArr != null ? ` — ${currency.format(r.ActiveFinancialArr)}` : ""}`,
        });
      }
      const util = accountUtilization.get(r.CustomerId);
      if (util?.hasData && util.percent != null) {
        utilizationSum += util.percent;
        utilizationCount += 1;
        utilizationAccounts.push({ label: r.CustomerName, value: `${util.percent.toFixed(0)}%` });
      }
    });
    const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
    arrAccounts.sort((a, b) => a.label.localeCompare(b.label));
    renewingAccounts.sort((a, b) => (a.value as string).localeCompare(b.value as string));
    atRiskAccounts.sort((a, b) => a.label.localeCompare(b.label));
    utilizationAccounts.sort((a, b) => a.label.localeCompare(b.label));
    return {
      total: rows.length,
      regionCount: topRegions.length,
      topRegions: topRegions.slice(0, 6),
      missingCsd,
      missingTam,
      lastSynced,
      renewingSoon,
      arrRenewingSoon,
      atRisk,
      totalArr,
      arrAtRisk,
      avgUtilization: utilizationCount > 0 ? utilizationSum / utilizationCount : null,
      allAccounts,
      arrAccounts,
      renewingAccounts,
      atRiskAccounts,
      utilizationAccounts,
    };
  }, [rows, accountUtilization]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-text">
          <p className="eyebrow">{greeting}</p>
          <h1>Active Customer Accounts</h1>
          <p className="subtitle">
            Synced straight from Salesforce, refreshed automatically twice a
            day — always up to date.
          </p>
        </div>
        <div className="home-stat-grid">
          <button
            className="home-stat-card accent-orange"
            onClick={() =>
              onOpenDrawer({
                title: "Active Accounts",
                subtitle: `${stats.total.toLocaleString()} customers`,
                sections: [{ rows: stats.allAccounts }],
              })
            }
          >
            <Users size={22} />
            <strong>{stats.total.toLocaleString()}</strong>
            <span>Active Accounts</span>
          </button>
          <button
            className="home-stat-card accent-teal"
            onClick={() =>
              onOpenDrawer({
                title: "Total Active ARR",
                subtitle: currency.format(stats.totalArr),
                sections: [{ rows: stats.arrAccounts }],
              })
            }
          >
            <DollarSign size={22} />
            <strong>{currency.format(stats.totalArr)}</strong>
            <span>Total Active ARR</span>
          </button>
          <button
            className="home-stat-card accent-purple"
            onClick={() =>
              onOpenDrawer({
                title: "Renewing in Next 6 Months",
                subtitle: `${stats.renewingSoon.toLocaleString()} customers`,
                sections: [{ rows: stats.renewingAccounts }],
              })
            }
          >
            <CalendarClock size={22} />
            <strong>{stats.renewingSoon.toLocaleString()}</strong>
            <span>Renewing in Next 6 Months</span>
          </button>
          <button
            className="home-stat-card accent-blue"
            onClick={() =>
              onOpenDrawer({
                title: "ARR Renewing in Next 6 Months",
                subtitle: currency.format(stats.arrRenewingSoon),
                sections: [{ rows: stats.renewingAccounts }],
              })
            }
          >
            <Wallet size={22} />
            <strong>{currency.format(stats.arrRenewingSoon)}</strong>
            <span>ARR Renewing in Next 6 Months</span>
          </button>
          <button
            className="home-stat-card accent-red"
            onClick={() =>
              onOpenDrawer({
                title: "Accounts at Risk",
                subtitle: `${stats.atRisk.toLocaleString()} customers${stats.arrAtRisk > 0 ? ` — ${currency.format(stats.arrAtRisk)} ARR` : ""}`,
                sections: [{ rows: stats.atRiskAccounts }],
              })
            }
          >
            <AlertTriangle size={22} />
            <strong>{stats.atRisk}</strong>
            <span>Accounts at Risk</span>
            {stats.arrAtRisk > 0 && (
              <small className="home-stat-subtext">
                {currency.format(stats.arrAtRisk)} ARR
              </small>
            )}
          </button>
          <button
            className="home-stat-card accent-green"
            onClick={() =>
              onOpenDrawer({
                title: "Average Utilization",
                subtitle:
                  stats.avgUtilization != null ? `${stats.avgUtilization.toFixed(0)}% average` : undefined,
                sections: [{ rows: stats.utilizationAccounts }],
              })
            }
          >
            <Gauge size={22} />
            <strong>
              {stats.avgUtilization != null ? `${stats.avgUtilization.toFixed(0)}%` : "—"}
            </strong>
            <span>Average Utilization</span>
          </button>
        </div>
      </section>
      {stats.topRegions.length > 0 && (
        <section className="home-region-card">
          <h3>Accounts by Region</h3>
          <div className="region-bars">
            {stats.topRegions.map(([region, count]) => (
              <div className="region-bar-row" key={region}>
                <span className="region-bar-label" title={region}>
                  {region}
                </span>
                <div className="region-bar-track">
                  <div
                    className="region-bar-fill"
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  />
                </div>
                <span className="region-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <PaceLeaderboard
        sources={[
          { unitLabel: "Platform Units", rows: platformBurndownRows },
          { unitLabel: "Agent Units", rows: agentBurndownRows },
          { unitLabel: "AI Units", rows: aiBurndownRows },
        ]}
        onSelectCustomer={onSelectCustomer}
        onOpenDrawer={onOpenDrawer}
      />
    <section className="table-card home-page">
      <div className="home-toolbar-compact">
        <h2>Browse All Accounts</h2>
        <span className="home-toolbar-count">
          {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()}
        </span>
        <label className="search-compact">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts"
          />
        </label>
        <button
          className={`filter-toggle-btn${activeFilterCount ? " active" : ""}`}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          <ChevronDown
            size={14}
            className={filtersOpen ? "chevron-open" : undefined}
          />
        </button>
        <button
          className="icon-btn-small"
          onClick={() => void load()}
          disabled={loading}
          title="Refresh"
        >
          <RotateCcw size={13} className={loading ? "spin" : ""} />
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {filtersOpen && (
        <section className="filters home-filters-panel">
          <label>
            Region
            <MultiSelectFilter
              options={filterOptions.regions.slice(1)}
              selected={filterRegion}
              onChange={setFilterRegion}
              allLabel="All Regions"
            />
          </label>
          <label>
            Geo
            <MultiSelectFilter
              options={filterOptions.geos.slice(1)}
              selected={filterGeo}
              onChange={setFilterGeo}
              allLabel="All Geos"
            />
          </label>
          <label>
            CSD
            <MultiSelectFilter
              options={filterOptions.csds.slice(1)}
              selected={filterCsd}
              onChange={setFilterCsd}
              allLabel="All CSDs"
            />
          </label>
          <label>
            Risk
            <MultiSelectFilter
              options={filterOptions.risks.slice(1)}
              selected={filterRisk}
              onChange={setFilterRisk}
              allLabel="All Risk Levels"
            />
          </label>
          <div className="filter-action">
            <button
              className="reset-filters"
              onClick={() => {
                setFilterRegion([]);
                setFilterGeo([]);
                setFilterCsd([]);
                setFilterRisk([]);
              }}
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </section>
      )}
      <div className="table-wrap">
        <table className="condensed-table">
          <thead>
            <tr>
              {(
                [
                  ["customerName", "Customer Name"],
                  ["accountOwner", "Account Owner"],
                  ["region", "Region"],
                  ["renewalDate", "Renewal Date"],
                  ["arr", "Active ARR"],
                  ["utilization", "Utilization"],
                  ["risk", "Risk"],
                ] as [HomeSortColumn, string][]
              ).map(([col, label]) => (
                <th key={col}>
                  <span
                    className="sortable-label"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort(col)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSort(col);
                      }
                    }}
                  >
                    {label}
                    {sortColumn === col && (
                      <span className="sort-arrow">
                        {sortDirection === "asc" ? " ▲" : " ▼"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="state">
                  Loading active accounts…
                </td>
              </tr>
            ) : filteredRows.length ? (
              filteredRows.map((r) => {
                const util = accountUtilization.get(r.CustomerId);
                const risk = computeAccountRisk(util, r.RenewalDate);
                return (
                <tr key={r.Id}>
                  <td className="customer">
                    <button
                      className="customer-link"
                      onClick={() => onSelectCustomer(r.CustomerId)}
                    >
                      {r.CustomerName}
                    </button>
                  </td>
                  <td title={r.AccountOwnerName}>{r.AccountOwnerName}</td>
                  <td title={r.CustomerRegion}>{r.CustomerRegion}</td>
                  <td>{r.RenewalDate || "—"}</td>
                  <td>
                    {r.ActiveFinancialArr != null ? currency.format(r.ActiveFinancialArr) : "—"}
                  </td>
                  <td>
                    {util?.hasData && util.percent != null ? (
                      <span className="util-cell">
                        <span className="util-bar-track">
                          <span
                            className={`util-bar-fill risk-${risk.level}`}
                            style={{ width: `${Math.min(100, Math.max(0, util.percent))}%` }}
                          />
                        </span>
                        <span className="util-cell-pct">{util.percent.toFixed(0)}%</span>
                      </span>
                    ) : (
                      <span className="util-cell-na">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`risk-badge risk-${risk.level}`} title={risk.reason}>
                      {risk.label}
                    </span>
                  </td>
                  <td>
                    <button
                      className="details-trigger"
                      onClick={() =>
                        onOpenDrawer({
                          title: r.CustomerName,
                          subtitle: r.CustomerId,
                          sections: [
                            {
                              heading: "Renewal Risk",
                              rows: [
                                {
                                  label: "Overall Utilization",
                                  value:
                                    util?.hasData && util.percent != null
                                      ? `${util.percent.toFixed(0)}%`
                                      : "No data",
                                },
                                {
                                  label: "Risk Level",
                                  value: (
                                    <span className={`risk-badge risk-${risk.level}`}>
                                      {risk.label}
                                    </span>
                                  ),
                                },
                                { label: "Why", value: risk.reason },
                              ],
                            },
                            {
                              heading: "Account Details",
                              rows: [
                                { label: "Account Owner", value: r.AccountOwnerName },
                                { label: "Geo", value: r.CustomerGeo },
                                { label: "Area", value: r.CustomerArea },
                                { label: "Region", value: r.CustomerRegion },
                                { label: "CSD", value: r.CsdName },
                                { label: "TAM", value: r.TamName },
                                { label: "CSM", value: r.CustomerSuccessManagerName },
                                { label: "Parent Account", value: r.ParentCompanyName },
                                { label: "Renewal Date", value: r.RenewalDate || "—" },
                                {
                                  label: "Active ARR",
                                  value:
                                    r.ActiveFinancialArr != null
                                      ? currency.format(r.ActiveFinancialArr)
                                      : "—",
                                },
                              ],
                            },
                          ],
                        })
                      }
                    >
                      Details
                    </button>
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="state">
                  No matching accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer>
        {updatedAt && `Page loaded ${new Date(updatedAt).toLocaleString()}`}
      </footer>
    </section>
    </>
  );
}
function LicensePortal({
  onOpenAdmin,
  onOpenMsiSubmission,
}: {
  onOpenAdmin: () => void;
  onOpenMsiSubmission: () => void;
}) {
  const {
    sdk,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    getToken,
  } = useAuth();
  const entities = useMemo(() => new Entities(sdk), [sdk]);
  const [details, setDetails] = useState<DetailRow[]>([]),
    [rollups, setRollups] = useState<RollupRow[]>([]);
  const [msiByCustomerId, setMsiByCustomerId] = useState<
    Map<string, MsiUtilizationRecord>
  >(new Map());
  const [platformBurndownRows, setPlatformBurndownRows] = useState<BurndownRow[]>([]);
  const [agentBurndownRows, setAgentBurndownRows] = useState<BurndownRow[]>([]);
  const [aiBurndownRows, setAiBurndownRows] = useState<BurndownRow[]>([]);
  const [customer, setCustomer] = useState<string[]>([]),
    [geo, setGeo] = useState<string[]>([]),
    [area, setArea] = useState<string[]>([]),
    [region, setRegion] = useState<string[]>([]),
    [deploymentType, setDeploymentType] = useState<string[]>([]);
  const [accountOwner, setAccountOwner] = useState<string[]>([]),
    [csd, setCsd] = useState<string[]>([]),
    [csm, setCsm] = useState<string[]>([]),
    [tam, setTam] = useState<string[]>([]),
    [supportPackage, setSupportPackage] = useState<string[]>([]);
  const [search, setSearch] = useState(""),
    [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [mainFiltersOpen, setMainFiltersOpen] = useState(false);
  const [detailLicenseCode, setDetailLicenseCode] = useState<string[]>([]),
    [detailCategory, setDetailCategory] = useState<string[]>([]),
    [detailDeploymentType, setDetailDeploymentType] = useState<string[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [updatedAt, setUpdatedAt] = useState("");
  const [view, setView] = useState<"home" | "utilization">("home");
  const [page, setPage] = useState(1),
    [onPremPage, setOnPremPage] = useState(1),
    [detailPage, setDetailPage] = useState(1);
  const [sortColumn, setSortColumn] = useState("Customer Name"),
    [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [detailSortColumn, setDetailSortColumn] = useState("As of Date"),
    [detailSortDirection, setDetailSortDirection] =
      useState<SortDirection>("desc");
  const [columnWidths, setColumnWidths] =
      useState<number[]>(defaultColumnWidths),
    [detailColumnWidths, setDetailColumnWidths] = useState<number[]>(
      detailAutoFitWidths([]),
    );
  const pageSize = 50,
    detailPageSize = 25;
  const [drawer, setDrawer] = useState<DrawerContent | null>(null);

  const fetchAll = async (entityId: string) => {
    const all: EntityRecord[] = [];
    let cursor: PaginationCursor | undefined;
    do {
      const result = (await entities.getAllRecords(entityId, {
        pageSize: 1000,
        cursor,
      })) as PaginatedResponse<EntityRecord>;
      all.push(...result.items);
      cursor = result.hasNextPage ? result.nextCursor : undefined;
    } while (cursor);
    return all;
  };
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [r, d, p, m, pb, ab, aib, dir] = await Promise.all([
        fetchAll(rollupEntityId),
        fetchAll(detailEntityId),
        fetchAll(purchasedEntitlementsEntityId),
        fetchAll(msiUtilizationEntityId),
        fetchAll(platformBurndownEntityId),
        fetchAll(agentBurndownEntityId),
        fetchAll(aiBurndownEntityId),
        fetchAll(customerAccountDirectoryEntityId),
      ]);
      const platformBurndown = toPascalRecords<BurndownRow>(pb);
      const agentBurndown = toPascalRecords<BurndownRow>(ab);
      const aiBurndown = toPascalRecords<BurndownRow>(aib);
      setPlatformBurndownRows(platformBurndown);
      setAgentBurndownRows(agentBurndown);
      setAiBurndownRows(aiBurndown);
      const latestBurndownByCustomer = (burndownRows: BurndownRow[]) => {
        const map = new Map<string, BurndownRow>();
        [...burndownRows]
          .sort((a, b) => a.ConsumptionDate.localeCompare(b.ConsumptionDate))
          .forEach((row) => map.set(row.CustomerId, row));
        return map;
      };
      const latestPlatformByCustomer = latestBurndownByCustomer(platformBurndown);
      const latestAgentByCustomer = latestBurndownByCustomer(agentBurndown);
      const latestAiByCustomer = latestBurndownByCustomer(aiBurndown);
      setMsiByCustomerId(
        new Map(
          toPascalRecords<MsiUtilizationRecord>(m).map((row) => [
            row.CustomerId,
            row,
          ]),
        ),
      );
      const rollupRecords = toPascalRecords<RollupRow>(r);
      const customerIdByRollupId = new Map(
        rollupRecords.map((row) => [row.Id.toLowerCase(), row.CustomerId]),
      );
      const purchasedByCustomerCategory = new Map<string, number>();
      for (const rec of toPascalRecords<{
        CustomerAccount: string;
        LicenseCategory: string;
        EntitlementsPurchased: number;
      }>(p)) {
        const customerId = customerIdByRollupId.get(
          (rec.CustomerAccount ?? "").toLowerCase(),
        );
        if (!customerId) continue;
        const key = `${customerId}|||${rec.LicenseCategory}`;
        purchasedByCustomerCategory.set(
          key,
          (purchasedByCustomerCategory.get(key) ?? 0) +
            (Number(rec.EntitlementsPurchased) || 0),
        );
      }
      const entitlementsFor = (customerId: string, group: string) => {
        const cats = entitlementCategoryGroups[group] ?? [];
        let total = 0,
          any = false;
        for (const cat of cats) {
          const v = purchasedByCustomerCategory.get(`${customerId}|||${cat}`);
          if (v != null) {
            total += v;
            any = true;
          }
        }
        return any ? total : undefined;
      };
      const enrichedRollups = rollupRecords.map((row) => {
        const enriched: RollupRow = { ...row };
        for (const [group, field] of Object.entries(rollupEntitlementFields)) {
          (enriched as Record<string, unknown>)[field] = entitlementsFor(
            row.CustomerId,
            group,
          );
        }
        const platformLatest = latestPlatformByCustomer.get(row.CustomerId);
        if (platformLatest) {
          enriched.PlatformUnitsEntitlements = platformLatest.PurchasedUnits;
          enriched.PlatformUnitsPurchased = platformLatest.PurchasedUnits ?? 0;
          enriched.PlatformUnitsUtilized = platformLatest.CumulativeConsumedUnits ?? 0;
        }
        const agentLatest = latestAgentByCustomer.get(row.CustomerId);
        if (agentLatest) {
          enriched.AgentUnitsEntitlements = agentLatest.PurchasedUnits;
          enriched.AgentUnitsPurchased = agentLatest.PurchasedUnits ?? 0;
          enriched.AgentUnitsUtilized = agentLatest.CumulativeConsumedUnits ?? 0;
        }
        const aiLatest = latestAiByCustomer.get(row.CustomerId);
        if (aiLatest) {
          enriched.AiUnitsEntitlements = aiLatest.PurchasedUnits;
          enriched.AiUnitsPurchased = aiLatest.PurchasedUnits ?? 0;
          enriched.AiUnitsUtilized = aiLatest.CumulativeConsumedUnits ?? 0;
        }
        return enriched;
      });
      const enrichedDetails = toPascalRecords<DetailRow>(d).map((row) => ({
        ...row,
        PurchasedEntitlements: purchasedByCustomerCategory.get(
          `${row.CustomerId}|||${row.LicenseCategory}`,
        ),
      }));
      // Every active account (CustomerAccountDirectory) must show up consistently across
      // Home, Sold, Contracts, and Utilized — even ones with no rollup/utilization data yet.
      const directoryRecords = toPascalRecords<DirectoryRow>(dir);
      const rollupCustomerIds = new Set(enrichedRollups.map((row) => row.CustomerId));
      const placeholderRollups: RollupRow[] = directoryRecords
        .filter((row) => !rollupCustomerIds.has(row.CustomerId))
        .map((row) => ({
          Id: row.Id,
          CustomerName: row.CustomerName,
          ParentCompanyName: row.ParentCompanyName,
          CustomerId: row.CustomerId,
          ActiveLicenseKeyCount: 0,
          LatestAsOfDate: "",
          DeploymentType: "",
          CustomerGeo: row.CustomerGeo,
          CustomerRegion: row.CustomerRegion,
          CustomerArea: row.CustomerArea,
          EarliestActiveContractEndDate: "",
          LatestActiveContractEndDate: "",
          AccountOwnerName: row.AccountOwnerName,
          CsdName: row.CsdName,
          CustomerSuccessManagerName: row.CustomerSuccessManagerName,
          TamName: row.TamName,
          CustomerSupportPackage: "",
          UnattendedProdPurchased: 0,
          UnattendedProdUtilized: 0,
          TestRobotPurchased: 0,
          TestRobotUtilized: 0,
          UserLicensePurchased: 0,
          UserLicenseUtilized: 0,
          AiUnitsPurchased: 0,
          AiUnitsUtilized: 0,
          PlatformUnitsPurchased: 0,
          PlatformUnitsUtilized: 0,
          AgentUnitsPurchased: 0,
          AgentUnitsUtilized: 0,
        }));
      const allRollups = [...enrichedRollups, ...placeholderRollups];
      setRollups(allRollups);
      setDetails(enrichedDetails);
      setColumnWidths(mainAutoFitWidths(allRollups));
      setDetailColumnWidths(
        detailAutoFitWidths(
          selectedCustomerId
            ? enrichedDetails.filter((row) => row.CustomerId === selectedCustomerId)
            : enrichedDetails,
        ),
      );
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load Data Fabric records",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, entities]);

  const deploymentTypes = [
    "All Deployment Types",
    "Automation Cloud",
    "MSI",
    "Automation Suite",
    "Dedicated",
  ];
  const filterPredicates = useMemo(() => {
    const selectedCustomerIds = customer.map((c) => c.split("|||")[1]);
    const q = search.trim().toLowerCase();
    const checks: Record<FilterKey, (r: RollupRow) => boolean> = {
      customer: (r) =>
        selectedCustomerIds.length === 0 ||
        selectedCustomerIds.includes(r.CustomerId),
      geo: (r) => geo.length === 0 || geo.includes(r.CustomerGeo),
      area: (r) => area.length === 0 || area.includes(r.CustomerArea),
      region: (r) => region.length === 0 || region.includes(r.CustomerRegion),
      deploymentType: (r) =>
        deploymentType.length === 0 ||
        deploymentType.some((dt) =>
          deploymentCapabilities(r.DeploymentType).includes(dt),
        ),
      accountOwner: (r) =>
        accountOwner.length === 0 || accountOwner.includes(r.AccountOwnerName),
      csd: (r) => csd.length === 0 || csd.includes(r.CsdName),
      csm: (r) => csm.length === 0 || csm.includes(r.CustomerSuccessManagerName),
      tam: (r) => tam.length === 0 || tam.includes(r.TamName),
      supportPackage: (r) =>
        supportPackage.length === 0 ||
        supportPackage.includes(r.CustomerSupportPackage),
      search: (r) =>
        !q ||
        [r.CustomerName, r.CustomerId].some((v) => (v || "").toLowerCase().includes(q)),
    };
    return checks;
  }, [
    customer,
    geo,
    area,
    region,
    deploymentType,
    accountOwner,
    csd,
    csm,
    tam,
    supportPackage,
    search,
  ]);
  const facetOptions = useMemo(() => {
    const filterKeys = Object.keys(filterPredicates) as FilterKey[];
    const rowsExcluding = (excludeKey: FilterKey) =>
      rollups.filter((r) =>
        filterKeys.every((k) => k === excludeKey || filterPredicates[k](r)),
      );
    return {
      customers: [
        "All Customers",
        ...rowsExcluding("customer")
          .slice()
          .sort((a, b) => (a.CustomerName || "").localeCompare(b.CustomerName || ""))
          .map((r) => `${r.CustomerName}|||${r.CustomerId}`),
      ],
      geos: optionList("All Geos", rowsExcluding("geo").map((r) => r.CustomerGeo)),
      areas: optionList("All Areas", rowsExcluding("area").map((r) => r.CustomerArea)),
      regions: optionList(
        "All Regions",
        rowsExcluding("region").map((r) => r.CustomerRegion),
      ),
      accountOwners: optionList(
        "All Account Owners",
        rowsExcluding("accountOwner").map((r) => r.AccountOwnerName),
      ),
      csds: optionList("All CSDs", rowsExcluding("csd").map((r) => r.CsdName)),
      csms: optionList(
        "All CSMs",
        rowsExcluding("csm").map((r) => r.CustomerSuccessManagerName),
      ),
      tams: optionList("All TAMs", rowsExcluding("tam").map((r) => r.TamName)),
      supportPackages: optionList(
        "All Support Packages",
        rowsExcluding("supportPackage").map((r) => r.CustomerSupportPackage),
      ),
    };
  }, [rollups, filterPredicates]);
  const {
    customers,
    geos,
    areas,
    regions,
    accountOwners,
    csds,
    csms,
    tams,
    supportPackages,
  } = facetOptions;
  const filteredAccounts = useMemo(() => {
    const filterKeys = Object.keys(filterPredicates) as FilterKey[];
    return rollups.filter((r) => filterKeys.every((k) => filterPredicates[k](r)));
  }, [rollups, filterPredicates]);
  const accountUtilizationSummary = useMemo(() => {
    const map = new Map<string, AccountUtilizationSummary>();
    rollups.forEach((account) => {
      const isOnPrem = deploymentCapabilities(account.DeploymentType).some((c) =>
        onPremCapabilities.has(c),
      );
      const msi = msiByCustomerId.get(account.CustomerId);
      let utilizedTotal = 0;
      let baseTotal = 0;
      let anyPresent = false;
      categories.forEach((c) => {
        const field = rollupEntitlementFields[c.source];
        const entitlements = account[field] as number | undefined;
        const purchased = (account as Record<string, unknown>)[
          `${field.toString().replace("Entitlements", "Purchased")}`
        ] as number | undefined;
        const utilized = (account as Record<string, unknown>)[
          `${field.toString().replace("Entitlements", "Utilized")}`
        ] as number | undefined;
        if (isOnPrem) {
          const prefix = msiCategoryFieldPrefix[c.source];
          const msiPurchased = msi?.[`${prefix}Purchased` as keyof MsiUtilizationRecord] as
            | number
            | undefined;
          const msiUtilized = msi?.[`${prefix}Utilized` as keyof MsiUtilizationRecord] as
            | number
            | undefined;
          if (msiPurchased != null && msiPurchased > 0) {
            utilizedTotal += Number(msiUtilized) || 0;
            baseTotal += msiPurchased;
            anyPresent = true;
          }
        } else if (entitlements != null && entitlements > 0) {
          utilizedTotal += Number(utilized) || 0;
          baseTotal += entitlements;
          anyPresent = true;
        } else if (hasMetricData(purchased, utilized)) {
          // present but no reliable entitlement base to divide by
        }
      });
      const percent = anyPresent && baseTotal > 0 ? (utilizedTotal / baseTotal) * 100 : null;
      map.set(account.CustomerId, { percent, isOnPrem, hasData: anyPresent });
    });
    return map;
  }, [rollups, msiByCustomerId]);
  const pruneSelection = (options: string[], selected: string[]) => {
    const pruned = selected.filter((v) => options.includes(v));
    return pruned.length === selected.length ? selected : pruned;
  };
  useEffect(() => {
    setGeo((sel) => pruneSelection(geos, sel));
  }, [geos]);
  useEffect(() => {
    setArea((sel) => pruneSelection(areas, sel));
  }, [areas]);
  useEffect(() => {
    setRegion((sel) => pruneSelection(regions, sel));
  }, [regions]);
  useEffect(() => {
    setAccountOwner((sel) => pruneSelection(accountOwners, sel));
  }, [accountOwners]);
  useEffect(() => {
    setCsd((sel) => pruneSelection(csds, sel));
  }, [csds]);
  useEffect(() => {
    setCsm((sel) => pruneSelection(csms, sel));
  }, [csms]);
  useEffect(() => {
    setTam((sel) => pruneSelection(tams, sel));
  }, [tams]);
  useEffect(() => {
    setSupportPackage((sel) => pruneSelection(supportPackages, sel));
  }, [supportPackages]);
  useEffect(() => {
    setCustomer((sel) => pruneSelection(customers, sel));
  }, [customers]);
  const filteredAccountIds = useMemo(
    () => new Set(filteredAccounts.map((r) => r.CustomerId)),
    [filteredAccounts],
  );
  const visibleDetails = useMemo(
    () => details.filter((r) => filteredAccountIds.has(r.CustomerId)),
    [details, filteredAccountIds],
  );
  const pivotRows = useMemo(() => {
    const metric = (
      entitlements: number | undefined,
      purchased: number,
      utilized: number,
      percentage?: number,
    ): CategoryMetric => ({
      entitlements: entitlements ?? null,
      purchased: Number(purchased) || 0,
      utilized: Number(utilized) || 0,
      percentage:
        entitlements != null && entitlements > 0
          ? ((Number(utilized) || 0) / entitlements) * 100
          : null,
      present: hasMetricData(purchased, utilized, percentage),
    });
    const emptyMetrics: Record<string, CategoryMetric> = Object.fromEntries(
      categories.map((c) => [
        c.source,
        { entitlements: null, purchased: 0, utilized: 0, percentage: null, present: false },
      ]),
    );
    return filteredAccounts
      .flatMap((account): PivotRow[] => {
        const realMetrics: Record<string, CategoryMetric> = {
          "User Licenses": metric(
            account.UserLicenseEntitlements,
            account.UserLicensePurchased,
            account.UserLicenseUtilized,
            account.UserLicenseUtilizationPercent,
          ),
          "Unattended Production License": metric(
            account.UnattendedProdEntitlements,
            account.UnattendedProdPurchased,
            account.UnattendedProdUtilized,
            account.UnattendedProdUtilizationPercent,
          ),
          "Unattended Test Robot License": metric(
            account.TestRobotEntitlements,
            account.TestRobotPurchased,
            account.TestRobotUtilized,
            account.TestRobotUtilizationPercent,
          ),
          "AI Units": metric(
            account.AiUnitsEntitlements,
            account.AiUnitsPurchased,
            account.AiUnitsUtilized,
            account.AiUnitsUtilizationPercent,
          ),
          "Platform Units": metric(
            account.PlatformUnitsEntitlements,
            account.PlatformUnitsPurchased,
            account.PlatformUnitsUtilized,
            account.PlatformUnitsUtilizationPercent,
          ),
          "Agent Units": metric(
            account.AgentUnitsEntitlements,
            account.AgentUnitsPurchased,
            account.AgentUnitsUtilized,
            account.AgentUnitsUtilizationPercent,
          ),
        };
        const msi = msiByCustomerId.get(account.CustomerId);
        const msiMetrics: Record<string, CategoryMetric> = Object.fromEntries(
          categories.map((c) => {
            const prefix = msiCategoryFieldPrefix[c.source];
            const purchased = msi?.[`${prefix}Purchased` as keyof MsiUtilizationRecord] as
              | number
              | undefined;
            const utilized = msi?.[`${prefix}Utilized` as keyof MsiUtilizationRecord] as
              | number
              | undefined;
            return [
              c.source,
              {
                entitlements: purchased ?? null,
                purchased: Number(purchased) || 0,
                utilized: Number(utilized) || 0,
                percentage:
                  purchased != null && purchased > 0
                    ? ((Number(utilized) || 0) / purchased) * 100
                    : null,
                present: hasMetricData(purchased, utilized),
              },
            ];
          }),
        );
        const capabilities = deploymentCapabilities(account.DeploymentType);
        const section = (capability: string): "Cloud" | "OnPrem" =>
          onPremCapabilities.has(capability) ? "OnPrem" : "Cloud";
        if (capabilities.length === 0) {
          return [
            {
              ...account,
              key: account.CustomerId,
              metrics: realMetrics,
              metricsAvailable: true,
              section: "Cloud",
              quarter: fiscalQuarter(account.UpdateTime),
              lastUpdated: account.UpdateTime,
            },
          ];
        }
        let nonMsiAssigned = false;
        return capabilities.map((capability) => {
          if (capability === "MSI") {
            const msiDate = msi?.SubmittedAt;
            return {
              ...account,
              key: `${account.CustomerId}|||MSI`,
              DeploymentType: "MSI",
              metrics: msiMetrics,
              metricsAvailable: !!msi,
              section: "OnPrem" as const,
              quarter: msi ? msi.FiscalQuarter || fiscalQuarter(msiDate) : "—",
              lastUpdated: msiDate,
            };
          }
          const isPrimary = !nonMsiAssigned;
          nonMsiAssigned = true;
          return {
            ...account,
            key: `${account.CustomerId}|||${capability}`,
            DeploymentType: capability,
            metrics: isPrimary ? realMetrics : emptyMetrics,
            metricsAvailable: isPrimary,
            section: section(capability),
            quarter: isPrimary ? fiscalQuarter(account.UpdateTime) : "—",
            lastUpdated: isPrimary ? account.UpdateTime : undefined,
          };
        });
      })
      .sort((a, b) => {
        const cmp = compareSortValues(
          getSortValue(a, sortColumn),
          getSortValue(b, sortColumn),
        );
        return sortDirection === "asc" ? cmp : -cmp;
      });
  }, [filteredAccounts, sortColumn, sortDirection]);
  const exportMainTable = (format: "csv" | "xlsx") => {
    const rows: ExportValue[][] = pivotRows.map((row) => [
      row.CustomerName,
      row.DeploymentType,
      row.LatestActiveContractEndDate,
      row.ActiveLicenseKeyCount,
      ...categories.flatMap((c) => {
        const m = row.metrics[c.source];
        const na = row.metricsAvailable ? null : "NA";
        return [
          m.entitlements ?? na,
          m.present ? m.purchased : na,
          m.present ? m.utilized : na,
          m.percentage ?? na,
        ];
      }),
      row.CustomerGeo,
      row.CustomerRegion,
      row.CustomerArea,
      row.EarliestActiveContractEndDate,
      row.AccountOwnerName,
      row.CsdName,
      row.CustomerSuccessManagerName,
      row.TamName,
      row.CustomerSupportPackage,
      row.CustomerId,
      row.ParentCompanyName,
      row.LatestAsOfDate,
      row.quarter,
      row.lastUpdated ? formatUpdateDate(row.lastUpdated) : null,
    ]);
    if (format === "csv") {
      exportCsv("active-license-utilization.csv", columnLabels, rows);
    } else {
      exportXlsx(
        "active-license-utilization.xlsx",
        "Active License Utilization",
        columnLabels,
        rows,
      );
    }
  };
  const totalLicenseKeys = useMemo(
      () =>
        filteredAccounts.reduce(
          (sum, account) => sum + (Number(account.ActiveLicenseKeyCount) || 0),
          0,
        ),
      [filteredAccounts],
    ),
    totalPages = Math.max(1, Math.ceil(pivotRows.length / pageSize));
  const cloudPivotRows = useMemo(
      () => pivotRows.filter((r) => r.section === "Cloud"),
      [pivotRows],
    ),
    onPremPivotRows = useMemo(
      () => pivotRows.filter((r) => r.section === "OnPrem"),
      [pivotRows],
    );
  const cloudTotalPages = Math.max(1, Math.ceil(cloudPivotRows.length / pageSize)),
    cloudPageRows = cloudPivotRows.slice((page - 1) * pageSize, page * pageSize),
    onPremTotalPages = Math.max(1, Math.ceil(onPremPivotRows.length / pageSize)),
    onPremPageRows = onPremPivotRows.slice(
      (onPremPage - 1) * pageSize,
      onPremPage * pageSize,
    );
  const selectedAccount = useMemo(
      () => rollups.find((r) => r.CustomerId === selectedCustomerId) ?? null,
      [rollups, selectedCustomerId],
    ),
    selectedCustomerDetails = useMemo(
      () => details.filter((r) => r.CustomerId === selectedCustomerId),
      [details, selectedCustomerId],
    );
  const detailFilterPredicates = useMemo(() => {
    const checks: Record<DetailFilterKey, (r: DetailRow) => boolean> = {
      licenseCode: (r) =>
        detailLicenseCode.length === 0 ||
        detailLicenseCode.includes(r.LicenseCode),
      category: (r) =>
        detailCategory.length === 0 || detailCategory.includes(r.LicenseCategory),
      deploymentType: (r) =>
        detailDeploymentType.length === 0 ||
        detailDeploymentType.includes(r.DeploymentType),
    };
    return checks;
  }, [detailLicenseCode, detailCategory, detailDeploymentType]);
  const detailFacetOptions = useMemo(() => {
    const keys = Object.keys(detailFilterPredicates) as DetailFilterKey[];
    const rowsExcluding = (excludeKey: DetailFilterKey) =>
      selectedCustomerDetails.filter((r) =>
        keys.every((k) => k === excludeKey || detailFilterPredicates[k](r)),
      );
    return {
      licenseCodes: optionList(
        "All License Codes",
        rowsExcluding("licenseCode").map((r) => r.LicenseCode),
      ),
      categories: optionList(
        "All License Categories",
        rowsExcluding("category").map((r) => r.LicenseCategory),
      ),
      deploymentTypes: optionList(
        "All Deployment Types",
        rowsExcluding("deploymentType").map((r) => r.DeploymentType),
      ),
    };
  }, [selectedCustomerDetails, detailFilterPredicates]);
  const {
    licenseCodes: detailLicenseCodes,
    categories: detailCategories,
    deploymentTypes: detailDeploymentTypes,
  } = detailFacetOptions;
  const filteredSelectedDetails = useMemo(() => {
    const keys = Object.keys(detailFilterPredicates) as DetailFilterKey[];
    return selectedCustomerDetails
      .filter((r) => keys.every((k) => detailFilterPredicates[k](r)))
      .sort((a, b) => {
        const cmp = compareSortValues(
          getDetailSortValue(a, detailSortColumn),
          getDetailSortValue(b, detailSortColumn),
        );
        if (cmp !== 0) return detailSortDirection === "asc" ? cmp : -cmp;
        return (a.LicenseCode || "").localeCompare(b.LicenseCode || "");
      });
  }, [
    selectedCustomerDetails,
    detailFilterPredicates,
    detailSortColumn,
    detailSortDirection,
  ]);
  const detailTotalPages = Math.max(
      1,
      Math.ceil(filteredSelectedDetails.length / detailPageSize),
    ),
    detailPageRows = filteredSelectedDetails.slice(
      (detailPage - 1) * detailPageSize,
      detailPage * detailPageSize,
    );
  useEffect(
    () => setPage(1),
    [
      customer,
      geo,
      area,
      region,
      deploymentType,
      accountOwner,
      csd,
      csm,
      tam,
      supportPackage,
      search,
      sortColumn,
      sortDirection,
    ],
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  useEffect(
    () => setDetailPage(1),
    [
      detailLicenseCode,
      detailCategory,
      detailDeploymentType,
      detailSortColumn,
      detailSortDirection,
      selectedCustomerId,
    ],
  );
  useEffect(() => {
    if (detailPage > detailTotalPages) setDetailPage(detailTotalPages);
  }, [detailPage, detailTotalPages]);
  useEffect(() => {
    setDetailLicenseCode((sel) => pruneSelection(detailLicenseCodes, sel));
  }, [detailLicenseCodes]);
  useEffect(() => {
    setDetailCategory((sel) => pruneSelection(detailCategories, sel));
  }, [detailCategories]);
  useEffect(() => {
    setDetailDeploymentType((sel) => pruneSelection(detailDeploymentTypes, sel));
  }, [detailDeploymentTypes]);
  const openAccount = (id: string) => {
      setView("utilization");
      setSelectedCustomerId(id);
      setDetailLicenseCode([]);
      setDetailCategory([]);
      setDetailDeploymentType([]);
      setDetailColumnWidths(
        detailAutoFitWidths(details.filter((row) => row.CustomerId === id)),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    closeAccount = () => {
      setSelectedCustomerId(null);
      setDetailLicenseCode([]);
      setDetailCategory([]);
      setDetailDeploymentType([]);
    };
  const activeMainFilterCount =
    customer.length +
    geo.length +
    area.length +
    region.length +
    deploymentType.length +
    accountOwner.length +
    csd.length +
    csm.length +
    tam.length +
    supportPackage.length;
  const resetMainFilters = () => {
      setCustomer([]);
      setGeo([]);
      setArea([]);
      setRegion([]);
      setDeploymentType([]);
      setAccountOwner([]);
      setCsd([]);
      setCsm([]);
      setTam([]);
      setSupportPackage([]);
      setSearch("");
      setPage(1);
    },
    resetDetailFilters = () => {
      setDetailLicenseCode([]);
      setDetailCategory([]);
      setDetailDeploymentType([]);
      setDetailPage(1);
    };
  const startResize = (
    index: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    const startX = event.clientX,
      startWidth = columnWidths[index];
    const onMove = (e: PointerEvent) =>
      setColumnWidths((current) =>
        current.map((w, i) =>
          i === index ? Math.max(80, startWidth + e.clientX - startX) : w,
        ),
      );
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };
  const sortableHeaderLabel = (displayText: string, sortKey: string = displayText) => (
    <span
      className="sortable-label"
      role="button"
      tabIndex={0}
      onClick={() => toggleSort(sortKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleSort(sortKey);
        }
      }}
    >
      {displayText}
      {sortColumn === sortKey && (
        <span className="sort-arrow">{sortDirection === "asc" ? " ▲" : " ▼"}</span>
      )}
    </span>
  );
  const toggleDetailSort = (column: string) => {
    if (detailSortColumn === column) {
      setDetailSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setDetailSortColumn(column);
      setDetailSortDirection("asc");
    }
  };
  const sortableDetailHeaderLabel = (
    displayText: string,
    sortKey: string = displayText,
  ) => (
    <span
      className="sortable-label"
      role="button"
      tabIndex={0}
      onClick={() => toggleDetailSort(sortKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleDetailSort(sortKey);
        }
      }}
    >
      {displayText}
      {detailSortColumn === sortKey && (
        <span className="sort-arrow">
          {detailSortDirection === "asc" ? " ▲" : " ▼"}
        </span>
      )}
    </span>
  );
  const resizeHandle = (index: number, label: string) => (
    <button
      className="resize-handle"
      aria-label={`Resize ${label} column`}
      title={`Drag to resize ${label}; double-click to autofit`}
      onPointerDown={(e) => startResize(index, e)}
      onDoubleClick={() =>
        setColumnWidths((current) =>
          current.map((w, i) =>
            i === index ? mainAutoFitWidths(rollups)[index] : w,
          ),
        )
      }
    />
  );
  const startDetailResize = (
    index: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    const startX = event.clientX,
      startWidth = detailColumnWidths[index];
    const onMove = (e: PointerEvent) =>
      setDetailColumnWidths((current) =>
        current.map((w, i) =>
          i === index ? Math.max(80, startWidth + e.clientX - startX) : w,
        ),
      );
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const frozenDetailColumnCount = 3;
  const detailStickyLeft = (index: number) =>
    detailColumnWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
  const detailResizeHandle = (index: number, label: string) => (
    <button
      className="resize-handle"
      aria-label={`Resize ${label} column`}
      title={`Drag to resize ${label}; double-click to autofit`}
      onPointerDown={(e) => startDetailResize(index, e)}
      onDoubleClick={() =>
        setDetailColumnWidths((current) =>
          current.map((w, i) =>
            i === index
              ? detailAutoFitWidths(selectedCustomerDetails)[index]
              : w,
          ),
        )
      }
    />
  );
  const exportButtons = (onExport: (format: "csv" | "xlsx") => void) => (
    <div className="section-actions">
      <button className="export-btn" onClick={() => onExport("csv")}>
        <Download size={14} /> CSV
      </button>
      <button className="export-btn" onClick={() => onExport("xlsx")}>
        <Download size={14} /> Excel
      </button>
    </div>
  );
  const utilizationCell = (value?: number | null) =>
    value == null ? (
      <span className="missing">—</span>
    ) : (
      <span className={`pill ${percentageClass(value)}`}>
        {number.format(value)}%
      </span>
    );
  const accountIsOnPrem = selectedAccount
    ? deploymentCapabilities(selectedAccount.DeploymentType).some((c) =>
        onPremCapabilities.has(c),
      )
    : false;
  const onPremNaNote =
    "On-prem license utilization data is not available for this account, hence it is not included in the utilization percentage calculation.";
  const rollupMetrics = selectedAccount
    ? ([
        [
          "User Licenses",
          selectedAccount.UserLicenseEntitlements,
          selectedAccount.UserLicensePurchased,
          selectedAccount.UserLicenseUtilized,
          selectedAccount.UserLicenseUtilizationPercent,
        ],
        [
          "Unattended Production",
          selectedAccount.UnattendedProdEntitlements,
          selectedAccount.UnattendedProdPurchased,
          selectedAccount.UnattendedProdUtilized,
          selectedAccount.UnattendedProdUtilizationPercent,
        ],
        [
          "Unattended Test",
          selectedAccount.TestRobotEntitlements,
          selectedAccount.TestRobotPurchased,
          selectedAccount.TestRobotUtilized,
          selectedAccount.TestRobotUtilizationPercent,
        ],
        [
          "AI Units",
          selectedAccount.AiUnitsEntitlements,
          selectedAccount.AiUnitsPurchased,
          selectedAccount.AiUnitsUtilized,
          selectedAccount.AiUnitsUtilizationPercent,
        ],
        [
          "Platform Units",
          selectedAccount.PlatformUnitsEntitlements,
          selectedAccount.PlatformUnitsPurchased,
          selectedAccount.PlatformUnitsUtilized,
          selectedAccount.PlatformUnitsUtilizationPercent,
        ],
        [
          "Agent Units",
          selectedAccount.AgentUnitsEntitlements,
          selectedAccount.AgentUnitsPurchased,
          selectedAccount.AgentUnitsUtilized,
          selectedAccount.AgentUnitsUtilizationPercent,
        ],
      ] as [string, number | undefined, number, number, number | undefined][])
    : [];
  const accountSummaryHeaders = [
    "License Category",
    "Purchased",
    "Allocated",
    "Utilized",
    "Percentage",
  ];
  const exportAccountSummary = (format: "csv" | "xlsx") => {
    const rows: ExportValue[][] = rollupMetrics.map(
      ([label, entitlements, purchased, utilized]) => {
        const present = hasMetricData(purchased, utilized);
        const computedPercent = accountIsOnPrem
          ? "NA"
          : entitlements != null && entitlements > 0
            ? ((Number(utilized) || 0) / entitlements) * 100
            : null;
        return [
          label,
          entitlements ?? null,
          present ? purchased : null,
          present ? utilized : null,
          computedPercent,
        ];
      },
    );
    const filenameBase = `account-utilization-summary${selectedAccount ? `-${selectedAccount.CustomerId}` : ""}`;
    if (format === "csv") {
      exportCsv(`${filenameBase}.csv`, accountSummaryHeaders, rows);
    } else {
      exportXlsx(
        `${filenameBase}.xlsx`,
        "Account Utilization Summary",
        accountSummaryHeaders,
        rows,
      );
    }
  };
  const exportLicenseKeyDetail = (format: "csv" | "xlsx") => {
    const rows: ExportValue[][] = filteredSelectedDetails.map((row) => [
      row.LicenseCode,
      row.LicenseType,
      row.LicenseCategory,
      row.DeploymentType,
      row.AsOfDate,
      row.PurchasedEntitlements ?? null,
      row.PurchasedUnits,
      row.UtilizedUnits ?? null,
      row.PurchasedEntitlements != null && row.PurchasedEntitlements > 0
        ? ((Number(row.UtilizedUnits) || 0) / row.PurchasedEntitlements) * 100
        : null,
      row.RobotBoughtHoursMonthly ?? null,
      row.RobotExecutionHoursMonthly ?? null,
      row.RobotMonthlyExecutionPercent ?? null,
      row.CurrentContractEndDate,
      row.LicenseStatus,
      fiscalQuarter(row.UpdateTime),
      row.UpdateTime ? formatUpdateDate(row.UpdateTime) : null,
    ]);
    const filenameBase = `license-key-detail${selectedAccount ? `-${selectedAccount.CustomerId}` : ""}`;
    if (format === "csv") {
      exportCsv(`${filenameBase}.csv`, detailLabels, rows);
    } else {
      exportXlsx(`${filenameBase}.xlsx`, "License Key Detail", detailLabels, rows);
    }
  };
  const openRowDetails = (row: PivotRow) => {
    setDrawer({
      title: row.CustomerName,
      subtitle: `${row.DeploymentType} · ${row.CustomerRegion}`,
      sections: [
        {
          heading: "License Categories",
          rows: categories.map((c) => {
            const m = row.metrics[c.source];
            const naText = row.metricsAvailable ? "—" : "NA";
            return {
              label: c.label,
              value: (
                <div className="drawer-metric-grid">
                  <span>
                    <span className="metric-tag">Purchased</span>
                    {m.entitlements == null ? naText : number.format(m.entitlements)}
                  </span>
                  <span>
                    <span className="metric-tag">Allocated</span>
                    {m.present ? number.format(m.purchased) : naText}
                  </span>
                  <span>
                    <span className="metric-tag">Utilized</span>
                    {m.present ? number.format(m.utilized) : naText}
                  </span>
                  <span>
                    <span className="metric-tag">Percentage</span>
                    {m.percentage == null ? (
                      naText
                    ) : (
                      <span className={`pill ${percentageClass(m.percentage)}`}>
                        {number.format(m.percentage)}%
                      </span>
                    )}
                  </span>
                </div>
              ),
            };
          }),
        },
        {
          heading: "Account Details",
          rows: [
            { label: "Geo", value: row.CustomerGeo },
            { label: "Region", value: row.CustomerRegion },
            { label: "Area", value: row.CustomerArea },
            { label: "Account Owner", value: row.AccountOwnerName },
            { label: "CSD", value: row.CsdName },
            { label: "CSM", value: row.CustomerSuccessManagerName },
            { label: "TAM", value: row.TamName },
            { label: "Support Package", value: row.CustomerSupportPackage },
            { label: "Customer ID", value: row.CustomerId },
            { label: "Parent Company", value: row.ParentCompanyName },
            {
              label: "Earliest Contract End",
              value: row.EarliestActiveContractEndDate,
            },
            { label: "Latest As Of Date", value: row.LatestAsOfDate },
            { label: "Quarter", value: row.quarter },
            { label: "Last Updated", value: formatUpdateDate(row.lastUpdated) },
          ],
        },
      ],
    });
  };
  const renderPivotTable = (
    rows: PivotRow[],
    sectionRowCount: number,
    pageNum: number,
    setPageNum: Dispatch<SetStateAction<number>>,
    totalPagesForSection: number,
  ) => (
    <>
      <div className="table-wrap">
        <table className="condensed-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Deployment Type</th>
              <th>Contract Expiry</th>
              <th className="num">License Count</th>
              <th>Quarter</th>
              <th>Last Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(loading || authLoading) && !rollups.length ? (
              <tr>
                <td colSpan={7} className="state">
                  Loading Data Fabric records…
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.key}>
                  <td className="customer">
                    <button
                      className="customer-link"
                      onClick={() => openAccount(row.CustomerId)}
                    >
                      {row.CustomerName}
                    </button>
                  </td>
                  <td>{row.DeploymentType}</td>
                  <td>{row.LatestActiveContractEndDate}</td>
                  <td className="num">
                    {number.format(row.ActiveLicenseKeyCount)}
                  </td>
                  <td>{row.quarter}</td>
                  <td>{formatUpdateDate(row.lastUpdated)}</td>
                  <td>
                    <button
                      className="details-trigger"
                      onClick={() => openRowDetails(row)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="state">
                  No matching records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>
          {sectionRowCount
            ? `Showing ${(pageNum - 1) * pageSize + 1}–${Math.min(pageNum * pageSize, sectionRowCount)} of ${sectionRowCount.toLocaleString()} customer rows`
            : "Showing 0 rows"}
        </span>
        <div>
          <button
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum === 1}
          >
            Previous
          </button>
          <span>
            Page {pageNum} of {totalPagesForSection}
          </span>
          <button
            onClick={() => setPageNum((p) => Math.min(totalPagesForSection, p + 1))}
            disabled={pageNum === totalPagesForSection}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );

  return (
    <main className="portal">
      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(null)} />
          <aside className="detail-drawer">
            <div className="detail-drawer-header">
              <div>
                <h2>{drawer.title}</h2>
                {drawer.subtitle && (
                  <p className="subtitle">{drawer.subtitle}</p>
                )}
              </div>
              <button
                className="close-view"
                onClick={() => setDrawer(null)}
                aria-label="Close details"
              >
                <X size={17} />
              </button>
            </div>
            <div className="detail-drawer-body">
              {drawer.sections.map((section, si) => (
                <section key={si} className="drawer-section">
                  {section.heading && <h3>{section.heading}</h3>}
                  <div className="drawer-rows">
                    {section.rows.map((row, ri) => (
                      <div key={ri} className="drawer-row">
                        <span className="drawer-label">{row.label}</span>
                        <span className="drawer-value">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </aside>
        </>
      )}
      <header>
        <div>
          <p className="eyebrow">UiPath GTM Intelligence</p>
          <h1>Customer License Utilization Dashboard</h1>
          <p className="subtitle">
            Enterprise-wide visibility into purchased and utilized licenses
            across customers and product categories.
          </p>
        </div>
        <button className="admin-btn" onClick={onOpenAdmin}>
          <Settings size={16} /> Administration
        </button>
      </header>
      <nav className="page-tabs">
        <button
          className={view === "home" ? "page-tab active" : "page-tab"}
          onClick={() => setView("home")}
        >
          Home
        </button>
        <button
          className={view === "utilization" ? "page-tab active" : "page-tab"}
          onClick={() => {
            setView("utilization");
            closeAccount();
          }}
        >
          Utilized
        </button>
      </nav>
      {view === "home" ? (
        <HomePage
          entities={entities}
          isAuthenticated={isAuthenticated}
          onSelectCustomer={openAccount}
          onOpenDrawer={setDrawer}
          accountUtilization={accountUtilizationSummary}
          platformBurndownRows={platformBurndownRows}
          agentBurndownRows={agentBurndownRows}
          aiBurndownRows={aiBurndownRows}
        />
      ) : (
      <>
      {(error || authError) && (
        <div className="error">{error || authError}</div>
      )}
      {selectedAccount ? (
        <section className="account-view">
          <div className="account-view-header">
            <div>
              <p className="eyebrow">Account License Details</p>
              <h2>{selectedAccount.CustomerName}</h2>
              <p className="subtitle">
                Customer ID {selectedAccount.CustomerId} ·{" "}
                {selectedAccount.CustomerRegion}
              </p>
            </div>
            <button className="close-view" onClick={closeAccount}>
              <X size={17} /> Back to all customers
            </button>
          </div>
          <section className="account-facts">
            <div>
              <span>Account Owner</span>
              <strong>{selectedAccount.AccountOwnerName}</strong>
            </div>
            <div>
              <span>CSD</span>
              <strong>{selectedAccount.CsdName}</strong>
            </div>
            <div>
              <span>CSM</span>
              <strong>{selectedAccount.CustomerSuccessManagerName}</strong>
            </div>
            <div>
              <span>TAM</span>
              <strong>{selectedAccount.TamName}</strong>
            </div>
            <div>
              <span>Deployment</span>
              <strong>{selectedAccount.DeploymentType}</strong>
            </div>
            <div>
              <span>Support Package</span>
              <strong>{selectedAccount.CustomerSupportPackage}</strong>
            </div>
            <div>
              <span>Active License Keys</span>
              <strong>
                {number.format(selectedAccount.ActiveLicenseKeyCount)}
              </strong>
            </div>
            <div>
              <span>Contract End Date</span>
              <strong>{selectedAccount.LatestActiveContractEndDate}</strong>
            </div>
            <div>
              <span>Quarter</span>
              <strong>{fiscalQuarter(selectedAccount.UpdateTime)}</strong>
            </div>
            <div>
              <span>Last Updated</span>
              <strong>{formatUpdateDate(selectedAccount.UpdateTime)}</strong>
            </div>
          </section>
          {platformBurndownRows.some((r) => r.CustomerId === selectedAccount.CustomerId) && (
            <BurndownChart
              title={`Platform Unit Burndown — ${selectedAccount.CustomerName}`}
              rows={platformBurndownRows.filter((r) => r.CustomerId === selectedAccount.CustomerId)}
              unitLabel="Platform Units"
            />
          )}
          {agentBurndownRows.some((r) => r.CustomerId === selectedAccount.CustomerId) && (
            <BurndownChart
              title={`Agent Unit Burndown — ${selectedAccount.CustomerName}`}
              rows={agentBurndownRows.filter((r) => r.CustomerId === selectedAccount.CustomerId)}
              unitLabel="Agent Units"
            />
          )}
          {aiBurndownRows.some((r) => r.CustomerId === selectedAccount.CustomerId) && (
            <BurndownChart
              title={`AI Unit Burndown — ${selectedAccount.CustomerName}`}
              rows={aiBurndownRows.filter((r) => r.CustomerId === selectedAccount.CustomerId)}
              unitLabel="AI Units"
            />
          )}
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h3>Account Utilization Summary</h3>
                <p>
                  Customer-level rollup from AMER FINS — Active Customer Account
                  Rollup.
                </p>
              </div>
              {exportButtons(exportAccountSummary)}
            </div>
            <div className="summary-table-wrap">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th className="sticky-col sticky-col-end">License Category</th>
                    <th className="num">Purchased</th>
                    <th className="num">Allocated</th>
                    <th className="num">Utilized</th>
                    <th className="num">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {rollupMetrics.map(
                    ([label, entitlements, purchased, utilized]) => {
                      const present = hasMetricData(purchased, utilized);
                      const computedPercent = accountIsOnPrem
                        ? undefined
                        : entitlements != null && entitlements > 0
                          ? ((Number(utilized) || 0) / entitlements) * 100
                          : undefined;
                      return (
                        <tr key={label}>
                          <td className="sticky-col sticky-col-end">{label}</td>
                          <td className="num">
                            {entitlements == null ? <span className="missing">—</span> : number.format(entitlements)}
                          </td>
                          <td className="num">
                            {present ? number.format(purchased) : <span className="missing">—</span>}
                          </td>
                          <td className="num">
                            {present ? number.format(utilized) : <span className="missing">—</span>}
                          </td>
                          <td className="num">
                            {accountIsOnPrem ? (
                              <span className="missing">NA</span>
                            ) : (
                              utilizationCell(computedPercent)
                            )}
                            {accountIsOnPrem && (
                              <span className="info-tooltip" tabIndex={0}>
                                <Info size={13} />
                                <span className="info-tooltip-bubble">
                                  {onPremNaNote}
                                </span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h3>License Key Detail</h3>
                <p>
                  Active entitlements and utilization records for this account.
                </p>
              </div>
              <div className="section-actions">
                {exportButtons(exportLicenseKeyDetail)}
                <button className="back-link" onClick={closeAccount}>
                  <ArrowLeft size={15} /> Back to all customers
                </button>
              </div>
            </div>
            <div className="detail-filters">
              <label>
                License Code
                <MultiSelectFilter
                  options={detailLicenseCodes.slice(1)}
                  selected={detailLicenseCode}
                  onChange={setDetailLicenseCode}
                  allLabel="All License Codes"
                />
              </label>
              <label>
                License Category
                <MultiSelectFilter
                  options={detailCategories.slice(1)}
                  selected={detailCategory}
                  onChange={setDetailCategory}
                  allLabel="All License Categories"
                />
              </label>
              <label>
                Deployment Type
                <MultiSelectFilter
                  options={detailDeploymentTypes.slice(1)}
                  selected={detailDeploymentType}
                  onChange={setDetailDeploymentType}
                  allLabel="All Deployment Types"
                />
              </label>
              <div className="filter-action">
                <button className="reset-filters" onClick={resetDetailFilters}>
                  <RotateCcw size={15} /> Reset Filters
                </button>
              </div>
            </div>
            <div className="detail-table-wrap">
              <table className="condensed-table">
                <thead>
                  <tr>
                    <th>License Code</th>
                    <th>License Category</th>
                    <th>Deployment</th>
                    <th>As of Date</th>
                    <th className="num">Utilization</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {detailPageRows.length ? (
                    detailPageRows.map((row) => {
                      const utilPercent =
                        row.PurchasedEntitlements != null &&
                        row.PurchasedEntitlements > 0
                          ? ((Number(row.UtilizedUnits) || 0) /
                              row.PurchasedEntitlements) *
                            100
                          : undefined;
                      return (
                        <tr key={row.Id}>
                          <td className="license">{row.LicenseCode}</td>
                          <td>{row.LicenseCategory}</td>
                          <td>{row.DeploymentType}</td>
                          <td>{row.AsOfDate}</td>
                          <td className="num">{utilizationCell(utilPercent)}</td>
                          <td>
                            <button
                              className="details-trigger"
                              onClick={() =>
                                setDrawer({
                                  title: row.LicenseCode,
                                  subtitle: `${row.LicenseType} · ${row.LicenseCategory}`,
                                  sections: [
                                    {
                                      heading: "Utilization",
                                      rows: [
                                        {
                                          label: "Purchased",
                                          value:
                                            row.PurchasedEntitlements == null
                                              ? "—"
                                              : number.format(row.PurchasedEntitlements),
                                        },
                                        {
                                          label: "Allocated",
                                          value: number.format(row.PurchasedUnits),
                                        },
                                        {
                                          label: "Utilized",
                                          value:
                                            row.UtilizedUnits == null
                                              ? "—"
                                              : number.format(row.UtilizedUnits),
                                        },
                                        {
                                          label: "Percentage",
                                          value: utilizationCell(utilPercent),
                                        },
                                      ],
                                    },
                                    {
                                      heading: "Robot Hours",
                                      rows: [
                                        {
                                          label: "Bought Hours / Month",
                                          value:
                                            row.RobotBoughtHoursMonthly == null
                                              ? "—"
                                              : number.format(row.RobotBoughtHoursMonthly),
                                        },
                                        {
                                          label: "Execution Hours / Month",
                                          value:
                                            row.RobotExecutionHoursMonthly == null
                                              ? "—"
                                              : number.format(row.RobotExecutionHoursMonthly),
                                        },
                                        {
                                          label: "Monthly Execution %",
                                          value:
                                            row.RobotMonthlyExecutionPercent == null
                                              ? "—"
                                              : utilizationCell(row.RobotMonthlyExecutionPercent),
                                        },
                                      ],
                                    },
                                    {
                                      heading: "License Details",
                                      rows: [
                                        { label: "Deployment", value: row.DeploymentType },
                                        { label: "As of Date", value: row.AsOfDate },
                                        { label: "Contract End", value: row.CurrentContractEndDate },
                                        { label: "License Status", value: row.LicenseStatus },
                                        { label: "Quarter", value: fiscalQuarter(row.UpdateTime) },
                                        { label: "Last Updated", value: formatUpdateDate(row.UpdateTime) },
                                      ],
                                    },
                                  ],
                                })
                              }
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="state">
                        No matching license records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {filteredSelectedDetails.length
                  ? `Showing ${(detailPage - 1) * detailPageSize + 1}–${Math.min(detailPage * detailPageSize, filteredSelectedDetails.length)} of ${filteredSelectedDetails.length.toLocaleString()} records`
                  : "Showing 0 records"}
              </span>
              <div>
                <button
                  onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                  disabled={detailPage === 1}
                >
                  Previous
                </button>
                <span>
                  Page {detailPage} of {detailTotalPages}
                </span>
                <button
                  onClick={() =>
                    setDetailPage((p) => Math.min(detailTotalPages, p + 1))
                  }
                  disabled={detailPage === detailTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </section>
      ) : (
        <>
          <section className="table-card filters-card">
          <div className="home-toolbar-compact">
            <h2>Filters</h2>
            <span className="home-toolbar-count">
              {filteredAccounts.length.toLocaleString()} of {rollups.length.toLocaleString()} customers
            </span>
            <label className="search-compact">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer name or ID"
              />
            </label>
            <button
              className={`filter-toggle-btn${activeMainFilterCount ? " active" : ""}`}
              onClick={() => setMainFiltersOpen((v) => !v)}
            >
              Filters{activeMainFilterCount ? ` (${activeMainFilterCount})` : ""}
              <ChevronDown size={14} className={mainFiltersOpen ? "chevron-open" : undefined} />
            </button>
          </div>
          {mainFiltersOpen && (
          <section className="filters home-filters-panel">
            <label>
              Customer
              <MultiSelectFilter
                options={customers.slice(1)}
                selected={customer}
                onChange={setCustomer}
                allLabel="All Customers"
                formatOption={(v) => v.split("|||")[0]}
              />
            </label>
            <label>
              Customer Geo
              <MultiSelectFilter
                options={geos.slice(1)}
                selected={geo}
                onChange={setGeo}
                allLabel="All Geos"
              />
            </label>
            <label>
              Customer Area
              <MultiSelectFilter
                options={areas.slice(1)}
                selected={area}
                onChange={setArea}
                allLabel="All Areas"
              />
            </label>
            <label>
              Region
              <MultiSelectFilter
                options={regions.slice(1)}
                selected={region}
                onChange={setRegion}
                allLabel="All Regions"
              />
            </label>
            <label>
              Deployment Type
              <MultiSelectFilter
                options={deploymentTypes.slice(1)}
                selected={deploymentType}
                onChange={setDeploymentType}
                allLabel="All Deployment Types"
              />
            </label>
            <label>
              Account Owner
              <MultiSelectFilter
                options={accountOwners.slice(1)}
                selected={accountOwner}
                onChange={setAccountOwner}
                allLabel="All Account Owners"
              />
            </label>
            <label>
              CSD
              <MultiSelectFilter
                options={csds.slice(1)}
                selected={csd}
                onChange={setCsd}
                allLabel="All CSDs"
              />
            </label>
            <label>
              CSM
              <MultiSelectFilter
                options={csms.slice(1)}
                selected={csm}
                onChange={setCsm}
                allLabel="All CSMs"
              />
            </label>
            <label>
              TAM
              <MultiSelectFilter
                options={tams.slice(1)}
                selected={tam}
                onChange={setTam}
                allLabel="All TAMs"
              />
            </label>
            <label>
              Support Package
              <MultiSelectFilter
                options={supportPackages.slice(1)}
                selected={supportPackage}
                onChange={setSupportPackage}
                allLabel="All Support Packages"
              />
            </label>
            <div className="filter-action">
              <button className="reset-filters" onClick={resetMainFilters}>
                <RotateCcw size={15} /> Reset Filters
              </button>
            </div>
          </section>
          )}
          </section>
          <section className="kpis">
            <div className="kpi">
              <span>Total Customers</span>
              <strong>{filteredAccounts.length.toLocaleString()}</strong>
            </div>
            <div className="kpi">
              <span>Total License Keys</span>
              <strong>{totalLicenseKeys.toLocaleString()}</strong>
            </div>
          </section>
          <section className="table-card">
            <div className="table-intro">
              <div>
                <h2>Cloud — Automation Cloud &amp; Dedicated</h2>
                <p>
                  Select a customer name to open its account rollup and
                  license-key detail.
                </p>
              </div>
              {exportButtons(exportMainTable)}
            </div>
            {renderPivotTable(
              cloudPageRows,
              cloudPivotRows.length,
              page,
              setPage,
              cloudTotalPages,
            )}
            <footer>
              {updatedAt &&
                `Data loaded ${new Date(updatedAt).toLocaleString()}`}{" "}
              · Authenticated read-only dashboard
            </footer>
          </section>
          <section className="msi-submission-bar">
            <button className="admin-btn" onClick={onOpenMsiSubmission}>
              <Upload size={16} /> Submit MSI Utilization
            </button>
          </section>
          <section className="table-card">
            <div className="table-intro">
              <div>
                <h2>On-Prem — Orchestrator MSI &amp; Automation Suite</h2>
                <p>
                  MSI figures come from submitted on-prem utilization data.
                  Accounts that haven't submitted yet show NA.
                </p>
              </div>
            </div>
            {renderPivotTable(
              onPremPageRows,
              onPremPivotRows.length,
              onPremPage,
              setOnPremPage,
              onPremTotalPages,
            )}
          </section>
        </>
      )}
      </>
      )}
    </main>
  );
}
// The Administration page is deployed as its own, separately-authenticated
// Coded Web App (not bundled into this public dashboard) so it always
// requires a real UiPath login regardless of how this app is shared.
// Navigating there is a full same-tab browser navigation, not in-app routing.
const ADMIN_URL =
  "https://uipathtechnicalaccountmanagementteam.uipath.host/license-reference-admin";
const MSI_UTILIZATION_URL =
  "https://uipathtechnicalaccountmanagementteam.uipath.host/msi-utilization";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; info: string }
> {
  state: { error: Error | null; info: string } = { error: null, info: "" };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack || "" });
    // eslint-disable-next-line no-console
    console.error("Dashboard crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <main className="portal">
          <div className="error-boundary">
            <h1>Something went wrong rendering this page</h1>
            <p>
              Copy the details below and share them so this can be fixed —
              this is exactly the information needed to diagnose it.
            </p>
            <pre>
              {this.state.error.name}: {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
              {this.state.info ? `\n\nComponent stack:${this.state.info}` : ""}
            </pre>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LicensePortal
          onOpenAdmin={() => {
            window.location.href = ADMIN_URL;
          }}
          onOpenMsiSubmission={() => {
            window.location.href = MSI_UTILIZATION_URL;
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}
