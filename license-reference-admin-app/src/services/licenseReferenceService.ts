import { Entities } from "@uipath/uipath-typescript/entities";
import type { EntityRecord } from "@uipath/uipath-typescript/entities";
import type { UiPath } from "@uipath/uipath-typescript/core";
import type {
  LicenseReference,
  LicenseReferenceDraft,
} from "../types/licenseReference";

// SECURITY NOTE (see README / admin page footer for the full statement):
// This entity ID is not a secret — it only identifies which Data Fabric table
// to call. Every read/write below goes through the same authenticated,
// browser-side UiPath SDK session as the rest of this public dashboard. There
// is no separate admin credential, and Data Fabric's own tenant-level
// permissions are the only thing standing between "can open this page" and
// "can write to LicenseReference" until server-side write authorization is
// added (see the Administration page footer for the required follow-up).
export const LICENSE_REFERENCE_ENTITY_ID =
  "c17c7417-c6a8-f111-9b33-6045bda94b17";

const asLicenseReference = (record: EntityRecord): LicenseReference =>
  record as unknown as LicenseReference;

export async function fetchAllLicenseReferences(
  sdk: UiPath,
): Promise<LicenseReference[]> {
  const entities = new Entities(sdk);
  const all: LicenseReference[] = [];
  let cursor: unknown;
  do {
    const result = (await entities.getAllRecords(LICENSE_REFERENCE_ENTITY_ID, {
      pageSize: 200,
      cursor: cursor as never,
    })) as {
      items: EntityRecord[];
      hasNextPage?: boolean;
      nextCursor?: unknown;
    };
    all.push(...result.items.map(asLicenseReference));
    cursor = result.hasNextPage ? result.nextCursor : undefined;
  } while (cursor);
  return all;
}

export async function getLicenseReferenceById(
  sdk: UiPath,
  id: string,
): Promise<LicenseReference> {
  const entities = new Entities(sdk);
  const record = await entities.getRecordById(LICENSE_REFERENCE_ENTITY_ID, id);
  return asLicenseReference(record);
}

export async function insertLicenseReference(
  sdk: UiPath,
  draft: LicenseReferenceDraft,
): Promise<LicenseReference> {
  const entities = new Entities(sdk);
  const inserted = await entities.insertRecordById(
    LICENSE_REFERENCE_ENTITY_ID,
    draft,
  );
  return asLicenseReference(inserted);
}

export async function updateLicenseReferenceField(
  sdk: UiPath,
  id: string,
  patch: Partial<LicenseReferenceDraft>,
): Promise<LicenseReference> {
  const entities = new Entities(sdk);
  const updated = await entities.updateRecordById(
    LICENSE_REFERENCE_ENTITY_ID,
    id,
    patch,
  );
  return asLicenseReference(updated);
}

export async function deleteLicenseReference(
  sdk: UiPath,
  id: string,
): Promise<void> {
  const entities = new Entities(sdk);
  await entities.deleteRecordById(LICENSE_REFERENCE_ENTITY_ID, id);
}
