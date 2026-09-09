import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useMsiUtilization } from "../hooks/useMsiUtilization";
import {
  MSI_CATEGORIES,
  fiscalQuarter,
  submitterChoices,
  type MsiCategoryKey,
  type MsiUtilizationDraft,
  type MsiUtilizationRecord,
} from "../types/msiUtilization";

type Toast = { id: number; message: string; kind: "success" | "error" };
type DraftValues = Record<`${MsiCategoryKey}Purchased` | `${MsiCategoryKey}Utilized`, string>;

const emptyDraft = (): DraftValues => {
  const draft = {} as DraftValues;
  for (const c of MSI_CATEGORIES) {
    draft[`${c.key}Purchased`] = "";
    draft[`${c.key}Utilized`] = "";
  }
  return draft;
};

const draftFromRecord = (record: MsiUtilizationRecord | undefined): DraftValues => {
  const draft = emptyDraft();
  if (!record) return draft;
  for (const c of MSI_CATEGORIES) {
    const purchasedField = `${c.key[0].toUpperCase()}${c.key.slice(1)}Purchased` as keyof MsiUtilizationRecord;
    const utilizedField = `${c.key[0].toUpperCase()}${c.key.slice(1)}Utilized` as keyof MsiUtilizationRecord;
    const p = record[purchasedField] as number | undefined;
    const u = record[utilizedField] as number | undefined;
    draft[`${c.key}Purchased`] = p != null ? String(p) : "";
    draft[`${c.key}Utilized`] = u != null ? String(u) : "";
  }
  return draft;
};

const fieldKey = (key: MsiCategoryKey, suffix: "Purchased" | "Utilized") =>
  `${key[0].toUpperCase()}${key.slice(1)}${suffix}`;

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function MsiUtilizationPage({ onBack }: { onBack: () => void }) {
  const { sdk, isAuthenticated, isLoading: authLoading, error: authError } = useAuth();
  const { accounts, records, loading, error, refresh, submit, savingCustomerIds } =
    useMsiUtilization(sdk, isAuthenticated);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftValues>(emptyDraft());
  const [submitter, setSubmitter] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panelCustomerId, setPanelCustomerId] = useState<string | null>(null);

  const notify = (message: string, kind: Toast["kind"]) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const recordByCustomerId = useMemo(
    () => new Map(records.map((r) => [r.CustomerId, r])),
    [records],
  );

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => (a.CustomerName || "").toLowerCase().includes(q));
  }, [accounts, search]);

  const startEdit = (customerId: string) => {
    const record = recordByCustomerId.get(customerId);
    setDraft(draftFromRecord(record));
    const account = accounts.find((a) => a.CustomerId === customerId);
    const choices = account ? submitterChoices(account) : [];
    const existingChoice = choices.find(
      (c) => c.name === record?.SubmittedByName && c.role === record?.SubmittedByRole,
    );
    setSubmitter(
      existingChoice
        ? `${existingChoice.name}|||${existingChoice.role}`
        : choices[0]
          ? `${choices[0].name}|||${choices[0].role}`
          : "",
    );
    setEditingId(customerId);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setSubmitter("");
  };

  const saveEdit = async (customerId: string, customerName: string) => {
    if (!submitter) {
      notify("Select who is submitting this data.", "error");
      return;
    }
    const [name, role] = submitter.split("|||");
    const values: Record<string, number> = {};
    for (const c of MSI_CATEGORIES) {
      values[fieldKey(c.key, "Purchased")] = Number(draft[`${c.key}Purchased`]) || 0;
      values[fieldKey(c.key, "Utilized")] = Number(draft[`${c.key}Utilized`]) || 0;
    }
    const submittedAt = new Date().toISOString();
    const payload: MsiUtilizationDraft = {
      CustomerId: customerId,
      CustomerName: customerName,
      SubmittedByName: name,
      SubmittedByRole: role,
      SubmittedAt: submittedAt,
      FiscalQuarter: fiscalQuarter(submittedAt),
      ...values,
    } as MsiUtilizationDraft;
    try {
      await submit(customerId, payload);
      notify(`Saved MSI utilization for ${customerName}.`, "success");
      cancelEdit();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to save", "error");
    }
  };

  return (
    <main className="portal admin-portal">
      <header>
        <div>
          <p className="eyebrow">UiPath GTM Intelligence</p>
          <h1>MSI Utilization Submission</h1>
          <p className="subtitle">
            Submit on-prem MSI purchased and utilized entitlements per account and
            category. Automation Cloud data continues to come from Snowflake.
          </p>
        </div>
        <button className="close-view" onClick={onBack}>
          <ArrowLeft size={17} /> Back to dashboard
        </button>
      </header>

      <div className="admin-security-note">
        <AlertCircle size={15} />
        <span>
          Every submission is upserted into the current MSI Utilization table and also
          appended to an append-only history table, recording who submitted it, their
          role, and when — so past submissions are never lost.
        </span>
      </div>

      {(error || authError) && <div className="error">{error || authError}</div>}

      <section className="admin-toolbar">
        <label className="search admin-search">
          Search
          <span>
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts"
            />
          </span>
        </label>
        <button className="reset-filters" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
        </button>
        <div className="admin-stat">
          <span>MSI Accounts</span>
          <strong>{accounts.length.toLocaleString()}</strong>
        </div>
      </section>

      <section className="table-card">
        {loading || authLoading ? (
          <div className="state">Loading MSI accounts…</div>
        ) : (
          <table className="no-scroll-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Submitted By</th>
                <th>Submitted At</th>
                <th>Quarter</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => {
                const record = recordByCustomerId.get(account.CustomerId);
                return (
                  <tr key={account.CustomerId}>
                    <td>{account.CustomerName}</td>
                    <td>
                      {record?.SubmittedByName ? (
                        `${record.SubmittedByName} (${record.SubmittedByRole})`
                      ) : (
                        <span className="missing">—</span>
                      )}
                    </td>
                    <td>
                      {record?.SubmittedAt
                        ? new Date(record.SubmittedAt).toLocaleString()
                        : <span className="missing">—</span>}
                    </td>
                    <td>
                      {record?.FiscalQuarter ||
                        (record?.SubmittedAt ? fiscalQuarter(record.SubmittedAt) : (
                          <span className="missing">—</span>
                        ))}
                    </td>
                    <td>
                      <button
                        className="details-trigger"
                        onClick={() => setPanelCustomerId(account.CustomerId)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {panelCustomerId && (() => {
        const account = accounts.find((a) => a.CustomerId === panelCustomerId);
        if (!account) return null;
        const record = recordByCustomerId.get(panelCustomerId);
        const isEditing = editingId === panelCustomerId;
        const isSaving = savingCustomerIds.has(panelCustomerId);
        const choices = submitterChoices(account);
        const closePanel = () => {
          if (isEditing) cancelEdit();
          setPanelCustomerId(null);
        };
        return (
          <>
            <div className="drawer-backdrop" onClick={closePanel} />
            <aside className="detail-drawer">
              <div className="detail-drawer-header">
                <div>
                  <h2>{account.CustomerName}</h2>
                  <p className="subtitle">
                    {record?.SubmittedByName
                      ? `Last submitted by ${record.SubmittedByName} (${record.SubmittedByRole})`
                      : "No MSI utilization submitted yet"}
                  </p>
                </div>
                <button className="close-view" onClick={closePanel} aria-label="Close">
                  <X size={17} />
                </button>
              </div>
              <div className="detail-drawer-body">
                {isEditing ? (
                  <>
                    <label className="drawer-field">
                      Submitter
                      <select value={submitter} onChange={(e) => setSubmitter(e.target.value)}>
                        <option value="" disabled>
                          Select submitter
                        </option>
                        {choices.map((c) => (
                          <option key={`${c.name}|||${c.role}`} value={`${c.name}|||${c.role}`}>
                            {c.name} ({c.role})
                          </option>
                        ))}
                      </select>
                    </label>
                    {MSI_CATEGORIES.map((c) => (
                      <section key={c.key} className="drawer-section">
                        <h3>{c.label}</h3>
                        <div className="drawer-rows">
                          <label className="drawer-field">
                            Purchased
                            <input
                              type="number"
                              min={0}
                              value={draft[`${c.key}Purchased`]}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, [`${c.key}Purchased`]: e.target.value }))
                              }
                            />
                          </label>
                          <label className="drawer-field">
                            Utilized
                            <input
                              type="number"
                              min={0}
                              value={draft[`${c.key}Utilized`]}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, [`${c.key}Utilized`]: e.target.value }))
                              }
                            />
                          </label>
                        </div>
                      </section>
                    ))}
                    <div className="drawer-actions">
                      <button
                        className="icon-btn"
                        disabled={isSaving}
                        onClick={() => void saveEdit(account.CustomerId, account.CustomerName)}
                        title="Save"
                      >
                        <Save size={15} /> Save
                      </button>
                      <button className="icon-btn" onClick={cancelEdit} title="Cancel">
                        <X size={15} /> Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <section className="drawer-section">
                      <div className="drawer-rows">
                        <div className="drawer-row">
                          <span className="drawer-label">Submitted At</span>
                          <span className="drawer-value">
                            {record?.SubmittedAt ? new Date(record.SubmittedAt).toLocaleString() : "—"}
                          </span>
                        </div>
                        <div className="drawer-row">
                          <span className="drawer-label">Quarter</span>
                          <span className="drawer-value">
                            {record?.FiscalQuarter ||
                              (record?.SubmittedAt ? fiscalQuarter(record.SubmittedAt) : "—")}
                          </span>
                        </div>
                      </div>
                    </section>
                    {MSI_CATEGORIES.map((c) => {
                      const p = record?.[fieldKey(c.key, "Purchased") as keyof MsiUtilizationRecord] as
                        | number
                        | undefined;
                      const u = record?.[fieldKey(c.key, "Utilized") as keyof MsiUtilizationRecord] as
                        | number
                        | undefined;
                      return (
                        <section key={c.key} className="drawer-section">
                          <h3>{c.label}</h3>
                          <div className="drawer-rows">
                            <div className="drawer-row">
                              <span className="drawer-label">Purchased</span>
                              <span className="drawer-value">
                                {p != null ? number.format(p) : "—"}
                              </span>
                            </div>
                            <div className="drawer-row">
                              <span className="drawer-label">Utilized</span>
                              <span className="drawer-value">
                                {u != null ? number.format(u) : "—"}
                              </span>
                            </div>
                          </div>
                        </section>
                      );
                    })}
                    <div className="drawer-actions">
                      <button
                        className="icon-btn"
                        onClick={() => startEdit(account.CustomerId)}
                        title="Edit"
                      >
                        <Pencil size={15} /> Edit
                      </button>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </>
        );
      })()}

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
