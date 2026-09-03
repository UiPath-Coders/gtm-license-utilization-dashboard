import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ChevronDown, Download, RotateCcw, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
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
};
type CategoryMetric = {
  entitlements: number | null;
  purchased: number;
  utilized: number;
  percentage: number | null;
  present: boolean;
};
type PivotRow = RollupRow & {
  key: string;
  metrics: Record<string, CategoryMetric>;
};
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
const rollupEntityId = "1898909b-a699-f111-9b33-7c1e521513a8";
const detailEntityId = "5e1ff6a4-a699-f111-9b33-7c1e521513a8";
const purchasedEntitlementsEntityId = "62602352-52a5-f111-9b33-7c1e521513a8";
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
];
const identitySortFields: Record<string, keyof RollupRow> = {
  "Customer Name": "CustomerName",
  "Deployment Type": "DeploymentType",
  "Contract Expiry Date": "LatestActiveContractEndDate",
  "License Count": "ActiveLicenseKeyCount",
};
const metadataSortFields: Record<string, keyof RollupRow> = {
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
  const field = detailSortFields[column];
  if (!field) return null;
  const value = row[field];
  return value == null ? null : (value as string | number);
};
const deploymentCapabilities = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  const capabilities: string[] = [];
  if (normalized.includes("automationcloud")) capabilities.push("Automation Cloud");
  if (normalized.includes("msi")) capabilities.push("MSI");
  if (normalized.includes("automationsuite")) capabilities.push("Automation Suite");
  if (normalized.includes("dedicated")) capabilities.push("Dedicated");
  return capabilities;
};
const percentageClass = (value: number) =>
  value >= 70 ? "high" : value >= 40 ? "medium" : "low";
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
function LicensePortal() {
  const {
    sdk,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
  } = useAuth();
  const entities = useMemo(() => new Entities(sdk), [sdk]);
  const [details, setDetails] = useState<DetailRow[]>([]),
    [rollups, setRollups] = useState<RollupRow[]>([]);
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
  const [detailLicenseCode, setDetailLicenseCode] = useState<string[]>([]),
    [detailCategory, setDetailCategory] = useState<string[]>([]),
    [detailDeploymentType, setDetailDeploymentType] = useState<string[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [updatedAt, setUpdatedAt] = useState("");
  const [page, setPage] = useState(1),
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
      const [r, d, p] = await Promise.all([
        fetchAll(rollupEntityId),
        fetchAll(detailEntityId),
        fetchAll(purchasedEntitlementsEntityId),
      ]);
      const rollupRecords = r as unknown as RollupRow[];
      const customerIdByRollupId = new Map(
        rollupRecords.map((row) => [row.Id.toLowerCase(), row.CustomerId]),
      );
      const purchasedByCustomerCategory = new Map<string, number>();
      for (const rec of p as unknown as {
        CustomerAccount: string;
        LicenseCategory: string;
        PurchasedEntitlements: number;
      }[]) {
        const customerId = customerIdByRollupId.get(
          (rec.CustomerAccount ?? "").toLowerCase(),
        );
        if (!customerId) continue;
        const key = `${customerId}|||${rec.LicenseCategory}`;
        purchasedByCustomerCategory.set(
          key,
          (purchasedByCustomerCategory.get(key) ?? 0) +
            (Number(rec.PurchasedEntitlements) || 0),
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
        return enriched;
      });
      const enrichedDetails = (d as unknown as DetailRow[]).map((row) => ({
        ...row,
        PurchasedEntitlements: purchasedByCustomerCategory.get(
          `${row.CustomerId}|||${row.LicenseCategory}`,
        ),
      }));
      setRollups(enrichedRollups);
      setDetails(enrichedDetails);
      setColumnWidths(mainAutoFitWidths(enrichedRollups));
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
        [r.CustomerName, r.CustomerId].some((v) => v.toLowerCase().includes(q)),
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
          .sort((a, b) => a.CustomerName.localeCompare(b.CustomerName))
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
    return filteredAccounts
      .map((account): PivotRow => ({
        ...account,
        key: account.CustomerId,
        metrics: {
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
        },
      }))
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
        return [
          m.entitlements,
          m.present ? m.purchased : null,
          m.present ? m.utilized : null,
          m.percentage,
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
    totalPages = Math.max(1, Math.ceil(pivotRows.length / pageSize)),
    pageRows = pivotRows.slice((page - 1) * pageSize, page * pageSize);
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
        return a.LicenseCode.localeCompare(b.LicenseCode);
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
        const computedPercent =
          entitlements != null && entitlements > 0
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
    ]);
    const filenameBase = `license-key-detail${selectedAccount ? `-${selectedAccount.CustomerId}` : ""}`;
    if (format === "csv") {
      exportCsv(`${filenameBase}.csv`, detailLabels, rows);
    } else {
      exportXlsx(`${filenameBase}.xlsx`, "License Key Detail", detailLabels, rows);
    }
  };

  return (
    <main className="portal">
      <header>
        <div>
          <p className="eyebrow">UiPath GTM Intelligence</p>
          <h1>Customer License Utilization Dashboard</h1>
          <p className="subtitle">
            Enterprise-wide visibility into purchased and utilized licenses
            across customers and product categories.
          </p>
        </div>
      </header>
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
          </section>
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
                      const computedPercent =
                        entitlements != null && entitlements > 0
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
                          <td className="num">{utilizationCell(computedPercent)}</td>
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
              <table
                className="detail-table"
                style={{
                  width: `${detailColumnWidths.reduce((sum, w) => sum + w, 0)}px`,
                }}
              >
                <colgroup>
                  {detailColumnWidths.map((width, index) => (
                    <col key={detailLabels[index]} style={{ width: `${width}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {detailLabels.map((label, index) => (
                      <th
                        key={label}
                        className={
                          index < frozenDetailColumnCount
                            ? index === frozenDetailColumnCount - 1
                              ? "sticky-col sticky-col-end"
                              : "sticky-col"
                            : index >= 5 && index <= 11
                              ? "num"
                              : undefined
                        }
                        style={
                          index < frozenDetailColumnCount
                            ? { left: `${detailStickyLeft(index)}px` }
                            : undefined
                        }
                      >
                        {sortableDetailHeaderLabel(label)}
                        {detailResizeHandle(index, label)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailPageRows.length ? (
                    detailPageRows.map((row) => (
                      <tr key={row.Id}>
                        <td
                          className="license sticky-col"
                          style={{ left: `${detailStickyLeft(0)}px` }}
                        >
                          {row.LicenseCode}
                        </td>
                        <td
                          className="sticky-col"
                          style={{ left: `${detailStickyLeft(1)}px` }}
                        >
                          {row.LicenseType}
                        </td>
                        <td
                          className="sticky-col sticky-col-end"
                          style={{ left: `${detailStickyLeft(2)}px` }}
                        >
                          {row.LicenseCategory}
                        </td>
                        <td>{row.DeploymentType}</td>
                        <td>{row.AsOfDate}</td>
                        <td className="num">
                          {row.PurchasedEntitlements == null
                            ? "—"
                            : number.format(row.PurchasedEntitlements)}
                        </td>
                        <td className="num">
                          {number.format(row.PurchasedUnits)}
                        </td>
                        <td className="num">
                          {row.UtilizedUnits == null
                            ? "—"
                            : number.format(row.UtilizedUnits)}
                        </td>
                        <td className="num">
                          {utilizationCell(
                            row.PurchasedEntitlements != null &&
                              row.PurchasedEntitlements > 0
                              ? ((Number(row.UtilizedUnits) || 0) /
                                  row.PurchasedEntitlements) *
                                  100
                              : undefined,
                          )}
                        </td>
                        <td className="num">
                          {row.RobotBoughtHoursMonthly == null ? "—" : number.format(row.RobotBoughtHoursMonthly)}
                        </td>
                        <td className="num">
                          {row.RobotExecutionHoursMonthly == null ? "—" : number.format(row.RobotExecutionHoursMonthly)}
                        </td>
                        <td className="num">
                          {row.RobotMonthlyExecutionPercent == null ? "—" : utilizationCell(row.RobotMonthlyExecutionPercent)}
                        </td>
                        <td>{row.CurrentContractEndDate}</td>
                        <td>{row.LicenseStatus}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={14} className="state">
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
          <section className="filters filters-expanded">
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
            <label className="search">
              Search
              <span>
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Customer name or ID"
                />
              </span>
            </label>
            <div className="filter-action">
              <button className="reset-filters" onClick={resetMainFilters}>
                <RotateCcw size={15} /> Reset Filters
              </button>
            </div>
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
                <h2>Active License Utilization</h2>
                <p>
                  Select a customer name to open its account rollup and
                  license-key detail.
                </p>
              </div>
              {exportButtons(exportMainTable)}
            </div>
            <div className="table-wrap">
              <table
                style={{
                  width: `${columnWidths.reduce((sum, w) => sum + w, 0)}px`,
                }}
              >
                <colgroup>
                  {columnWidths.map((w, i) => (
                    <col key={columnLabels[i]} style={{ width: `${w}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="category-header">
                    {identityLabels.map((label, i) => (
                      <th
                        key={label}
                        rowSpan={2}
                        className={i === 0 ? "sticky-col sticky-col-end" : undefined}
                      >
                        {sortableHeaderLabel(label)}
                        {resizeHandle(i, label)}
                      </th>
                    ))}
                    {categories.map((c) => (
                      <th key={c.source} colSpan={4} className="category-group">
                        {c.label}
                      </th>
                    ))}
                    {metadataLabels.map((label, offset) => {
                      const i =
                        identityLabels.length + metricLabels.length + offset;
                      return (
                        <th key={label} rowSpan={2}>
                          {sortableHeaderLabel(label)}
                          {resizeHandle(i, label)}
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="metric-header">
                    {categories.flatMap((c, ci) =>
                      metricMeasures.map((label, mi) => {
                        const i = identityLabels.length + ci * metricMeasures.length + mi,
                          full = `${c.label} ${label}`;
                        return (
                          <th key={full} className="num">
                            {sortableHeaderLabel(label, full)}
                            {resizeHandle(i, full)}
                          </th>
                        );
                      }),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(loading || authLoading) && !rollups.length ? (
                    <tr>
                      <td colSpan={columnLabels.length} className="state">
                        Loading Data Fabric records…
                      </td>
                    </tr>
                  ) : pageRows.length ? (
                    pageRows.map((row) => (
                      <tr key={row.key}>
                        <td className="customer sticky-col sticky-col-end">
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
                        {categories.flatMap((c) => {
                          const m = row.metrics[c.source];
                          return [
                            <td key={`${c.source}-e`} className="num">
                              {m.entitlements == null ? (
                                <span className="missing">—</span>
                              ) : (
                                number.format(m.entitlements)
                              )}
                            </td>,
                            <td key={`${c.source}-p`} className="num">
                              {m.present ? (
                                number.format(m.purchased)
                              ) : (
                                <span className="missing">—</span>
                              )}
                            </td>,
                            <td key={`${c.source}-u`} className="num">
                              {m.present ? (
                                number.format(m.utilized)
                              ) : (
                                <span className="missing">—</span>
                              )}
                            </td>,
                            <td key={`${c.source}-%`} className="num">
                              {m.percentage == null ? (
                                <span className="missing">—</span>
                              ) : (
                                <span
                                  className={`pill ${percentageClass(m.percentage)}`}
                                >
                                  {number.format(m.percentage)}%
                                </span>
                              )}
                            </td>,
                          ];
                        })}
                        <td>{row.CustomerGeo}</td>
                        <td title={row.CustomerRegion}>{row.CustomerRegion}</td>
                        <td>{row.CustomerArea}</td>
                        <td>{row.EarliestActiveContractEndDate}</td>
                        <td title={row.AccountOwnerName}>{row.AccountOwnerName}</td>
                        <td title={row.CsdName}>{row.CsdName}</td>
                        <td title={row.CustomerSuccessManagerName}>
                          {row.CustomerSuccessManagerName}
                        </td>
                        <td title={row.TamName}>{row.TamName}</td>
                        <td>{row.CustomerSupportPackage}</td>
                        <td>{row.CustomerId}</td>
                        <td title={row.ParentCompanyName}>
                          {row.ParentCompanyName}
                        </td>
                        <td>{row.LatestAsOfDate}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columnLabels.length} className="state">
                        No matching records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {pivotRows.length
                  ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pivotRows.length)} of ${pivotRows.length.toLocaleString()} customer rows`
                  : "Showing 0 rows"}
              </span>
              <div>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
            <footer>
              {updatedAt &&
                `Data loaded ${new Date(updatedAt).toLocaleString()}`}{" "}
              · Authenticated read-only dashboard
            </footer>
          </section>
        </>
      )}
    </main>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <LicensePortal />
    </AuthProvider>
  );
}
