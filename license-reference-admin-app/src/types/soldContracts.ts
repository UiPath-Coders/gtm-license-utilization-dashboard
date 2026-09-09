export type RollupRow = {
  Id: string;
  CustomerName: string;
  CustomerId: string;
  CustomerRegion: string;
  UserLicensePurchased: number;
  UnattendedProdPurchased: number;
  TestRobotPurchased: number;
};

export type BurndownRow = {
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

export type ContractRow = {
  Id: string;
  CustomerAccount: string;
  CustomerName?: string;
  ContractYear?: string;
  PeriodStartDate?: string;
  PeriodEndDate?: string;
  ContractFileName?: string;
  UploadedAt?: string;
  UploadedByEmail?: string;
  UploadQuarter?: string;
  ContractVersion?: number;
  IsLatestVersion?: boolean;
  ExtractionStatus?: string;
  SourceDocumentId?: string;
  OpportunityId?: string;
  OpportunityName?: string;
};

export type OpportunityRow = {
  Id: string;
  CustomerId: string;
  OpportunityId: string;
  OpportunityName?: string;
  StageName?: string;
  CloseDate?: string;
  Amount?: number;
};

export type DrawerRow = { label: string; value: string };
export type DrawerSection = { heading?: string; rows: DrawerRow[] };
export type DrawerContent = { title: string; subtitle?: string; sections: DrawerSection[] };

export type SoldGranularity = "day" | "month" | "quarter" | "year";
export type SoldPoint = { bucket: string; sold: number };

// Data Fabric entity IDs — tam_global / AMER_COE tenant.
export const rollupEntityId = "02990c8f-c6a8-f111-9b33-6045bda94b17"; // CustomerAccountRollup
export const purchasedEntitlementsEntityId = "cdc5ab9b-c6a8-f111-9b33-6045bda94b17"; // PurchasedEntitlements
export const platformBurndownEntityId = "27441ea7-c5a8-f111-9b33-6045bda94b17"; // PlatformUnitDailyBurndown
export const agentBurndownEntityId = "762c6fad-c5a8-f111-9b33-6045bda94b17"; // AgentUnitDailyBurndown
export const aiBurndownEntityId = "962c6fad-c5a8-f111-9b33-6045bda94b17"; // AiUnitDailyBurndown
export const opportunityDirectoryEntityId = "b62c6fad-c5a8-f111-9b33-6045bda94b17"; // CustomerOpportunityDirectory

export const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
export const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const toPascalRecord = <T,>(record: Record<string, unknown>): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key.charAt(0).toUpperCase() + key.slice(1)] = value;
  }
  return result as T;
};
export const toPascalRecords = <T,>(records: unknown[]): T[] =>
  records.map((r) => toPascalRecord<T>(r as Record<string, unknown>));

export const fiscalQuarter = (dateInput?: string | null): string => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  const q = Math.floor((month - 1) / 3) + 1;
  return `${year}-Q${q}`;
};

export const formatUpdateDate = (dateInput?: string | null) =>
  dateInput ? new Date(dateInput).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

// Best-effort decode of the access token's email-ish claim, purely for display
// (attribution in the upload history) — not used for auth or authorization.
export const decodeJwtEmail = (token: string | null | undefined): string => {
  if (!token) return "Unknown user";
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(decodeURIComponent(escape(json)));
    return claims.email || claims.upn || claims.preferred_username || claims.unique_name || claims.sub || "Unknown user";
  } catch {
    return "Unknown user";
  }
};

const monthKey = (isoDate: string) => isoDate.slice(0, 7);
const quarterKey = (isoDate: string) => {
  const month = Number(isoDate.slice(5, 7));
  const q = Math.floor((month - 1) / 3) + 1;
  return `${isoDate.slice(0, 4)}-Q${q}`;
};
const yearKey = (isoDate: string) => isoDate.slice(0, 4);
export const soldBucketKey = (isoDate: string, granularity: SoldGranularity) => {
  switch (granularity) {
    case "day":
      return isoDate;
    case "month":
      return monthKey(isoDate);
    case "quarter":
      return quarterKey(isoDate);
    case "year":
      return yearKey(isoDate);
  }
};

// Builds a step-function timeline of total purchased/"sold" units across all customers by
// carrying forward each customer's latest known PurchasedUnits as new consumption dates arrive,
// then takes the value as-of the end of each bucket (day/month/quarter/year).
export const buildSoldSeries = (
  rows: BurndownRow[],
  granularity: SoldGranularity,
  minDate = "2025-01-01",
): { points: SoldPoint[]; startSold: number; endSold: number } => {
  const byDate = new Map<string, { customerId: string; purchased: number }[]>();
  rows.forEach((r) => {
    const list = byDate.get(r.ConsumptionDate) ?? [];
    list.push({ customerId: r.CustomerId, purchased: Number(r.PurchasedUnits) || 0 });
    byDate.set(r.ConsumptionDate, list);
  });
  const dates = Array.from(byDate.keys()).sort();
  const currentByCustomer = new Map<string, number>();
  const bucketTotals = new Map<string, number>();
  const bucketOrder: string[] = [];
  dates.forEach((date) => {
    (byDate.get(date) ?? []).forEach(({ customerId, purchased }) => {
      currentByCustomer.set(customerId, purchased);
    });
    if (date < minDate) return;
    const total = Array.from(currentByCustomer.values()).reduce((a, b) => a + b, 0);
    const bucket = soldBucketKey(date, granularity);
    if (!bucketTotals.has(bucket)) bucketOrder.push(bucket);
    bucketTotals.set(bucket, total);
  });
  const points = bucketOrder.map((bucket) => ({ bucket, sold: bucketTotals.get(bucket) ?? 0 }));
  return {
    points,
    startSold: points.length ? points[0].sold : 0,
    endSold: points.length ? points[points.length - 1].sold : 0,
  };
};

// Latest known purchased units per customer (for the "click chart -> per-customer share" breakdown).
export const latestPurchasedByCustomer = (
  rows: BurndownRow[],
): { customerId: string; customerName: string; purchased: number }[] => {
  const sorted = [...rows].sort((a, b) => a.ConsumptionDate.localeCompare(b.ConsumptionDate));
  const map = new Map<string, { customerName: string; purchased: number }>();
  sorted.forEach((r) => {
    map.set(r.CustomerId, {
      customerName: r.CustomerName,
      purchased: Number(r.PurchasedUnits) || 0,
    });
  });
  return Array.from(map.entries())
    .map(([customerId, v]) => ({ customerId, customerName: v.customerName, purchased: v.purchased }))
    .filter((r) => r.purchased > 0)
    .sort((a, b) => b.purchased - a.purchased);
};
