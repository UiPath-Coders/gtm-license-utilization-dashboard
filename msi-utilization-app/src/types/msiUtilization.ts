export type MsiCategoryKey =
  | "userLicenses"
  | "unattendedProd"
  | "testRobot"
  | "aiUnits"
  | "platformUnits"
  | "agentUnits";

export const MSI_CATEGORIES: { key: MsiCategoryKey; label: string }[] = [
  { key: "userLicenses", label: "User Licenses" },
  { key: "unattendedProd", label: "Unattended Production" },
  { key: "testRobot", label: "Unattended Test Robot" },
  { key: "aiUnits", label: "AI Units" },
  { key: "platformUnits", label: "Platform Units" },
  { key: "agentUnits", label: "Agent Units" },
];

// Data Fabric normalizes every field name to PascalCase regardless of the
// camelCase used at entity-creation time — this is the exact record shape
// returned by getAllRecords/getRecordById.
export type MsiUtilizationRecord = {
  Id: string;
  CustomerId: string;
  CustomerName: string;
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
  SubmittedByName?: string;
  SubmittedByRole?: string;
  SubmittedAt?: string;
  FiscalQuarter?: string;
  UpdateTime?: string;
};

// UiPath fiscal year: Feb 1 - Jan 31, labeled by the calendar year Jan 31 falls in.
// Q1 Feb-Apr, Q2 May-Jul, Q3 Aug-Oct, Q4 Nov-Jan.
export const fiscalQuarter = (dateInput?: string | null): string => {
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

export type MsiUtilizationDraft = Omit<MsiUtilizationRecord, "Id">;

export type AccountOption = {
  CustomerId: string;
  CustomerName: string;
  DeploymentType: string;
  CsdName: string;
  TamName: string;
  CustomerSuccessManagerName: string;
  AccountOwnerName: string;
};

export type SubmitterChoice = { name: string; role: string };

export const submitterChoices = (account: AccountOption): SubmitterChoice[] => {
  const raw: SubmitterChoice[] = [
    { name: account.CsdName, role: "CSD" },
    { name: account.TamName, role: "TAM" },
    { name: account.CustomerSuccessManagerName, role: "CSM" },
    { name: account.AccountOwnerName, role: "Account Owner" },
  ];
  const seen = new Set<string>();
  return raw.filter((c) => {
    if (!c.name || !c.name.trim()) return false;
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
