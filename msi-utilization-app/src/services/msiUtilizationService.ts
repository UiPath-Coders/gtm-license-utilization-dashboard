import { Entities } from "@uipath/uipath-typescript/entities";
import type { EntityRecord } from "@uipath/uipath-typescript/entities";
import type { UiPath } from "@uipath/uipath-typescript/core";
import type {
  AccountOption,
  MsiUtilizationDraft,
  MsiUtilizationRecord,
} from "../types/msiUtilization";

export const ROLLUP_ENTITY_ID = "02990c8f-c6a8-f111-9b33-6045bda94b17"; // CustomerAccountRollup
export const MSI_UTILIZATION_ENTITY_ID = "5da516cd-c5a8-f111-9b33-6045bda94b17"; // OnPremUtilization
export const MSI_UTILIZATION_HISTORY_ENTITY_ID =
  "d07c7417-c6a8-f111-9b33-6045bda94b17"; // OnPremUtilizationHistory

async function fetchAll(sdk: UiPath, entityId: string): Promise<EntityRecord[]> {
  const entities = new Entities(sdk);
  const all: EntityRecord[] = [];
  let cursor: unknown;
  do {
    const result = (await entities.getAllRecords(entityId, {
      pageSize: 1000,
      cursor: cursor as never,
    })) as { items: EntityRecord[]; hasNextPage?: boolean; nextCursor?: unknown };
    all.push(...result.items);
    cursor = result.hasNextPage ? result.nextCursor : undefined;
  } while (cursor);
  return all;
}

const isMsiDeployment = (value: string) =>
  (value ?? "").toLowerCase().replace(/[^a-z]/g, "").includes("msi");

// The Entities SDK returns custom fields using whatever casing the field was
// created with (e.g. "customerName"), not the PascalCase the `uip df` CLI
// displays. Every field in this app is authored and read as PascalCase, so
// normalize every raw record's keys right after fetching.
function toPascalRecords<T>(records: EntityRecord[]): T[] {
  return records.map((r) => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(r)) {
      result[key.charAt(0).toUpperCase() + key.slice(1)] = value;
    }
    return result as T;
  });
}

export async function fetchMsiAccounts(sdk: UiPath): Promise<AccountOption[]> {
  const rows = toPascalRecords<AccountOption>(await fetchAll(sdk, ROLLUP_ENTITY_ID));
  return rows
    .filter((r) => isMsiDeployment(r.DeploymentType))
    .sort((a, b) => (a.CustomerName || "").localeCompare(b.CustomerName || ""));
}

export async function fetchMsiUtilizations(
  sdk: UiPath,
): Promise<MsiUtilizationRecord[]> {
  const rows = await fetchAll(sdk, MSI_UTILIZATION_ENTITY_ID);
  return toPascalRecords<MsiUtilizationRecord>(rows);
}

export async function submitMsiUtilization(
  sdk: UiPath,
  existingId: string | undefined,
  draft: MsiUtilizationDraft,
): Promise<MsiUtilizationRecord> {
  const entities = new Entities(sdk);
  const saved = existingId
    ? await entities.updateRecordById(MSI_UTILIZATION_ENTITY_ID, existingId, draft)
    : await entities.insertRecordById(MSI_UTILIZATION_ENTITY_ID, draft);
  await entities.insertRecordById(MSI_UTILIZATION_HISTORY_ENTITY_ID, draft);
  return toPascalRecords<MsiUtilizationRecord>([saved as EntityRecord])[0];
}
