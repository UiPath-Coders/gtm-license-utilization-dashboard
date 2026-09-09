import { useCallback, useEffect, useState } from "react";
import type { UiPath } from "@uipath/uipath-typescript/core";
import {
  fetchMsiAccounts,
  fetchMsiUtilizations,
  submitMsiUtilization,
} from "../services/msiUtilizationService";
import type {
  AccountOption,
  MsiUtilizationDraft,
  MsiUtilizationRecord,
} from "../types/msiUtilization";

export function useMsiUtilization(sdk: UiPath, isAuthenticated: boolean) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [records, setRecords] = useState<MsiUtilizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingCustomerIds, setSavingCustomerIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, r] = await Promise.all([
        fetchMsiAccounts(sdk),
        fetchMsiUtilizations(sdk),
      ]);
      setAccounts(a);
      setRecords(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load MSI utilization data");
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    if (isAuthenticated) void refresh();
  }, [isAuthenticated, refresh]);

  const submit = useCallback(
    async (customerId: string, draft: MsiUtilizationDraft) => {
      setSavingCustomerIds((prev) => new Set(prev).add(customerId));
      try {
        const existing = records.find((r) => r.CustomerId === customerId);
        const saved = await submitMsiUtilization(sdk, existing?.Id, draft);
        setRecords((prev) => {
          const others = prev.filter((r) => r.CustomerId !== customerId);
          return [...others, saved];
        });
        return saved;
      } finally {
        setSavingCustomerIds((prev) => {
          const next = new Set(prev);
          next.delete(customerId);
          return next;
        });
      }
    },
    [sdk, records],
  );

  return { accounts, records, loading, error, refresh, submit, savingCustomerIds };
}
