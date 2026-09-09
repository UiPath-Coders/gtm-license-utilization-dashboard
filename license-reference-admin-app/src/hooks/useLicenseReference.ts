import { useCallback, useEffect, useMemo, useState } from "react";
import type { UiPath } from "@uipath/uipath-typescript/core";
import type {
  LicenseReference,
  LicenseReferenceDraft,
  LicenseReferenceField,
} from "../types/licenseReference";
import {
  deleteLicenseReference,
  fetchAllLicenseReferences,
  getLicenseReferenceById,
  insertLicenseReference,
  updateLicenseReferenceField,
} from "../services/licenseReferenceService";

export type SaveResult = { ok: true } | { ok: false; error: string };

const normalizeKey = (pricingName: string, skuName: string) =>
  `${pricingName.trim().toLowerCase()}|||${skuName.trim().toLowerCase()}`;

export function useLicenseReference(sdk: UiPath, enabled: boolean) {
  const [records, setRecords] = useState<LicenseReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingRowIds, setSavingRowIds] = useState<Set<string>>(new Set());
  const [dirtyRowIds, setDirtyRowIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const all = await fetchAllLicenseReferences(sdk);
      setRecords(all);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load License Reference data",
      );
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const isDuplicateKey = useCallback(
    (pricingName: string, skuName: string, excludeId?: string) => {
      const key = normalizeKey(pricingName, skuName);
      return records.some(
        (r) => r.Id !== excludeId && normalizeKey(r.PricingName, r.SkuName) === key,
      );
    },
    [records],
  );

  const setSaving = (id: string, saving: boolean) =>
    setSavingRowIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });

  const markDirty = (id: string, dirty: boolean) =>
    setDirtyRowIds((prev) => {
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });

  const createRecord = useCallback(
    async (draft: LicenseReferenceDraft): Promise<SaveResult> => {
      const tempId = `__new__${Date.now()}`;
      setSaving(tempId, true);
      try {
        const inserted = await insertLicenseReference(sdk, draft);
        setRecords((prev) => [...prev, inserted]);
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Failed to create record",
        };
      } finally {
        setSaving(tempId, false);
      }
    },
    [sdk],
  );

  const updateField = useCallback(
    async (
      id: string,
      field: LicenseReferenceField,
      value: string,
    ): Promise<SaveResult> => {
      if (savingRowIds.has(id)) {
        return { ok: false, error: "A save for this row is already in progress." };
      }
      const current = records.find((r) => r.Id === id);
      if (!current) return { ok: false, error: "Record no longer exists." };

      setSaving(id, true);
      markDirty(id, true);
      try {
        // Best-effort concurrency check: Data Fabric doesn't expose a real
        // ETag/version field, so we compare the audit UpdateTime we last saw
        // against the server's current value before overwriting.
        const latest = await getLicenseReferenceById(sdk, id);
        if (
          current.UpdateTime &&
          latest.UpdateTime &&
          latest.UpdateTime !== current.UpdateTime
        ) {
          setRecords((prev) => prev.map((r) => (r.Id === id ? latest : r)));
          return {
            ok: false,
            error:
              "This record was changed by someone else since you loaded it. Reloaded the latest value — please redo your edit.",
          };
        }

        const updated = await updateLicenseReferenceField(sdk, id, {
          [field]: value,
        });
        setRecords((prev) => prev.map((r) => (r.Id === id ? updated : r)));
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Failed to save change",
        };
      } finally {
        setSaving(id, false);
        markDirty(id, false);
      }
    },
    [sdk, records, savingRowIds],
  );

  const removeRecord = useCallback(
    async (id: string): Promise<SaveResult> => {
      setSaving(id, true);
      try {
        await deleteLicenseReference(sdk, id);
        setRecords((prev) => prev.filter((r) => r.Id !== id));
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Failed to delete record",
        };
      } finally {
        setSaving(id, false);
      }
    },
    [sdk],
  );

  const hasUnsavedWork = useMemo(
    () => savingRowIds.size > 0 || dirtyRowIds.size > 0,
    [savingRowIds, dirtyRowIds],
  );

  return {
    records,
    loading,
    error,
    refresh: load,
    createRecord,
    updateField,
    removeRecord,
    isDuplicateKey,
    savingRowIds,
    hasUnsavedWork,
  };
}
