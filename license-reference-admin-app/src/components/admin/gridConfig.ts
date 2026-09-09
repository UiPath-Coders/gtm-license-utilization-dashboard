import type { LicenseReferenceField } from "../../types/licenseReference";

export const PRICING_NAME_OPTIONS = ["Unified", "Flex"];
export const LICENSE_TYPE_OPTIONS = ["Consumable", "Quantity Based"];

export type ColumnEditorType = "text" | "select";

export interface ColumnDef {
  field: LicenseReferenceField;
  label: string;
  editorType: ColumnEditorType;
  options?: string[];
  defaultWidth: number;
  minWidth: number;
}

export const GRID_COLUMNS: ColumnDef[] = [
  {
    field: "PricingName",
    label: "Pricing Name",
    editorType: "select",
    options: PRICING_NAME_OPTIONS,
    defaultWidth: 140,
    minWidth: 100,
  },
  {
    field: "LicenseCategory",
    label: "License Category",
    editorType: "text",
    defaultWidth: 220,
    minWidth: 140,
  },
  {
    field: "SkuName",
    label: "SKU Name",
    editorType: "text",
    defaultWidth: 340,
    minWidth: 180,
  },
  {
    field: "LicenseType",
    label: "License Type",
    editorType: "select",
    options: LICENSE_TYPE_OPTIONS,
    defaultWidth: 150,
    minWidth: 110,
  },
  {
    field: "LicenseGroup",
    label: "License Group",
    editorType: "text",
    defaultWidth: 180,
    minWidth: 120,
  },
];
