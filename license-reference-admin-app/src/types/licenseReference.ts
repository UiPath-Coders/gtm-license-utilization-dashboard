export interface LicenseReference {
  Id: string;
  PricingName: string;
  LicenseCategory: string;
  SkuName: string;
  LicenseType: string;
  LicenseGroup: string;
  UpdateTime?: string;
}

export type LicenseReferenceField =
  | "PricingName"
  | "LicenseCategory"
  | "SkuName"
  | "LicenseType"
  | "LicenseGroup";

export type LicenseReferenceDraft = Record<LicenseReferenceField, string>;

export const LICENSE_REFERENCE_FIELDS: LicenseReferenceField[] = [
  "PricingName",
  "LicenseCategory",
  "SkuName",
  "LicenseType",
  "LicenseGroup",
];

export const emptyLicenseReferenceDraft = (): LicenseReferenceDraft => ({
  PricingName: "",
  LicenseCategory: "",
  SkuName: "",
  LicenseType: "",
  LicenseGroup: "",
});
