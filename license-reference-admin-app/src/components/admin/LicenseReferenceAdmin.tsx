import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useLicenseReference } from "../../hooks/useLicenseReference";
import { EditableLicenseGrid } from "./EditableLicenseGrid";

type Toast = { id: number; message: string; kind: "success" | "error" };

export function LicenseReferenceAdmin({ onBack }: { onBack: () => void }) {
  const { sdk, isAuthenticated, isLoading: authLoading, error: authError } =
    useAuth();
  const {
    records,
    loading,
    error,
    refresh,
    createRecord,
    updateField,
    removeRecord,
    isDuplicateKey,
    savingRowIds,
    hasUnsavedWork,
  } = useLicenseReference(sdk, isAuthenticated);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = (message: string, kind: "success" | "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  };

  useEffect(() => {
    if (authError) notify(authError, "error");
  }, [authError]);

  return (
    <main className="portal admin-portal">
      <header>
        <div>
          <p className="eyebrow">UiPath GTM Intelligence</p>
          <h1>License Reference Administration</h1>
          <p className="subtitle">
            Manage the license SKU reference data used by the dashboard.
          </p>
        </div>
        <button className="close-view" onClick={onBack}>
          <ArrowLeft size={17} /> Back to dashboard
        </button>
      </header>

      <div className="admin-security-note">
        <AlertCircle size={15} />
        <span>
          Access to this page is limited to the "License Reference
          Administrators" Identity group, checked client-side against the
          signed-in user's email. <strong>This is a UX gate, not a real
          security boundary</strong> — writes still go straight from this
          browser session to Data Fabric with no server-side authorization
          layer, so a determined user could bypass this check and call the
          Data Fabric write APIs directly. Add Data Fabric-level RBAC on
          LicenseReference, restricted to the same group, before relying on
          this for production data governance.
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="admin-toolbar">
        <label className="search admin-search">
          Search
          <span>
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all columns"
            />
          </span>
        </label>
        <button
          className="reset-filters"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
        </button>
        <div className="admin-stat">
          <span>Total Records</span>
          <strong>{records.length.toLocaleString()}</strong>
        </div>
        {hasUnsavedWork && (
          <div className="admin-unsaved-indicator">
            <Loader2Icon /> Saving changes…
          </div>
        )}
      </section>

      <section className="table-card">
        {loading || authLoading ? (
          <div className="state">Loading License Reference records…</div>
        ) : (
          <EditableLicenseGrid
            records={records}
            savingRowIds={savingRowIds}
            isDuplicateKey={isDuplicateKey}
            onUpdateField={updateField}
            onDelete={removeRecord}
            onCreate={createRecord}
            searchQuery={search}
            onNotify={notify}
          />
        )}
      </section>

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === "success" ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertCircle size={15} />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

function Loader2Icon() {
  return <span className="unsaved-dot" aria-hidden="true" />;
}
