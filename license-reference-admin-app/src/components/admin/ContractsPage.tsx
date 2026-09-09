import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Upload, X } from "lucide-react";
import { Entities, QueryFilterOperator } from "@uipath/uipath-typescript/entities";
import type { ContractRow, OpportunityRow, RollupRow } from "../../types/soldContracts";
import {
  decodeJwtEmail,
  fiscalQuarter,
  formatUpdateDate,
  opportunityDirectoryEntityId,
  purchasedEntitlementsEntityId,
  toPascalRecords,
} from "../../types/soldContracts";

function ContractUploads({
  entities,
  getToken,
  rollupId,
  customerId,
  customerName,
}: {
  entities: Entities;
  getToken: () => Promise<string>;
  rollupId: string;
  customerId: string;
  customerName: string;
}) {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [contractYear, setContractYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await entities.queryRecordsById(purchasedEntitlementsEntityId, {
        filterGroup: {
          queryFilters: [
            { fieldName: "customerAccount", operator: QueryFilterOperator.Equals, value: rollupId },
          ],
        },
      });
      const rows = toPascalRecords<ContractRow>(result.items).filter((r) => !!r.UploadedAt);
      rows.sort((a, b) => (b.ContractVersion ?? 0) - (a.ContractVersion ?? 0));
      setContracts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load contract uploads");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollupId]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await entities.queryRecordsById(opportunityDirectoryEntityId, {
          filterGroup: {
            queryFilters: [
              { fieldName: "customerId", operator: QueryFilterOperator.Equals, value: customerId },
            ],
          },
        });
        if (!cancelled) setOpportunities(toPascalRecords<OpportunityRow>(result.items));
      } catch {
        if (!cancelled) setOpportunities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entities, customerId]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const token = await getToken();
      const uploadedByEmail = decodeJwtEmail(token);
      // Versioning is per distinct document (same file name re-uploaded = new version of that
      // document); a different file name is a separate document/amendment starting at v1, and
      // each document tracks its own "latest" independently.
      const sameDocument = contracts.filter((c) => c.ContractFileName === file.name);
      const nextVersion = sameDocument.reduce((max, c) => Math.max(max, c.ContractVersion ?? 0), 0) + 1;
      const opportunity = opportunities.find((o) => o.OpportunityId === selectedOpportunityId);
      const now = new Date().toISOString();
      const inserted = (await entities.insertRecordById(purchasedEntitlementsEntityId, {
        customerAccount: rollupId,
        customerName,
        licenseCategory: "Contract Upload",
        entitlementsPurchased: 0,
        contractYear: contractYear || null,
        periodStartDate: periodStart || null,
        periodEndDate: periodEnd || null,
        contractFileName: file.name,
        uploadedAt: now,
        uploadedByEmail,
        uploadQuarter: fiscalQuarter(now),
        contractVersion: nextVersion,
        isLatestVersion: true,
        extractionStatus: "Pending Extraction",
        opportunityId: opportunity?.OpportunityId || null,
        opportunityName: opportunity?.OpportunityName || null,
      })) as unknown as { id?: string; Id?: string };
      const newRecordId = inserted.id ?? inserted.Id;
      if (!newRecordId) throw new Error("Upload record was created but no record id was returned.");
      await entities.uploadAttachment(purchasedEntitlementsEntityId, newRecordId, "contractDocument", file);
      await Promise.all(
        sameDocument
          .filter((c) => c.IsLatestVersion)
          .map((c) => entities.updateRecordById(purchasedEntitlementsEntityId, c.Id, { isLatestVersion: false })),
      );
      setFile(null);
      setPeriodStart("");
      setPeriodEnd("");
      setContractYear("");
      setSelectedOpportunityId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (row: ContractRow) => {
    try {
      const blob = await entities.downloadAttachment(purchasedEntitlementsEntityId, row.Id, "contractDocument");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = row.ContractFileName || "contract";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  };

  return (
    <section className="burndown-card">
      <div className="burndown-header">
        <div>
          <h3>Contracts &amp; Amendments</h3>
          <p>
            Upload the signed contract or amendment for a given contract period. Every upload is kept
            as its own version — the latest upload for a period is always the authoritative one; older
            versions stay in the history below for reference.
          </p>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="contract-upload-form">
        <label>
          Period Start
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </label>
        <label>
          Period End
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </label>
        <label>
          Contract Year (optional)
          <input
            type="text"
            placeholder="e.g. Year 1"
            value={contractYear}
            onChange={(e) => setContractYear(e.target.value)}
          />
        </label>
        <label>
          Opportunity
          <select
            value={selectedOpportunityId}
            onChange={(e) => setSelectedOpportunityId(e.target.value)}
          >
            <option value="">
              {opportunities.length ? "Select opportunity (optional)" : "No synced opportunities for this account"}
            </option>
            {opportunities.map((o) => (
              <option key={o.OpportunityId} value={o.OpportunityId}>
                {o.OpportunityName || o.OpportunityId} ({o.OpportunityId})
              </option>
            ))}
          </select>
        </label>
        <label className="contract-upload-file">
          Document
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          className="admin-btn"
          onClick={() => void handleUpload()}
          disabled={!file || uploading}
        >
          <Upload size={16} /> {uploading ? "Uploading…" : "Upload Contract"}
        </button>
      </div>
      {loading ? (
        <p className="burndown-empty">Loading upload history…</p>
      ) : contracts.length === 0 ? (
        <p className="burndown-empty">No contracts uploaded yet for this account.</p>
      ) : (
        <table className="condensed-table no-scroll-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Version</th>
              <th>Period</th>
              <th>Opportunity</th>
              <th>Uploaded</th>
              <th>Quarter</th>
              <th>Uploaded By</th>
              <th>Extraction Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.Id}>
                <td>{c.ContractFileName || "—"}</td>
                <td>
                  v{c.ContractVersion ?? "—"}
                  {c.IsLatestVersion && <span className="risk-badge risk-low"> Latest</span>}
                </td>
                <td>
                  {c.ContractYear ? `${c.ContractYear} — ` : ""}
                  {c.PeriodStartDate || "—"} → {c.PeriodEndDate || "—"}
                </td>
                <td>{c.OpportunityName ? `${c.OpportunityName} (${c.OpportunityId})` : "—"}</td>
                <td>{formatUpdateDate(c.UploadedAt)}</td>
                <td>{c.UploadQuarter || "—"}</td>
                <td>{c.UploadedByEmail || "—"}</td>
                <td>{c.ExtractionStatus || "—"}</td>
                <td>
                  <button className="details-trigger" onClick={() => void handleDownload(c)}>
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function ContractsPage({
  rollups,
  contractRows,
  entities,
  getToken,
}: {
  rollups: RollupRow[];
  contractRows: ContractRow[];
  entities: Entities;
  getToken: () => Promise<string>;
}) {
  const [search, setSearch] = useState("");
  const [panelRollup, setPanelRollup] = useState<RollupRow | null>(null);
  const latestByRollupId = useMemo(() => {
    const map = new Map<string, ContractRow>();
    [...contractRows]
      .sort((a, b) => (a.ContractVersion ?? 0) - (b.ContractVersion ?? 0))
      .forEach((row) => map.set(row.CustomerAccount, row));
    return map;
  }, [contractRows]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rollups
      .filter((r) => !q || r.CustomerName.toLowerCase().includes(q))
      .map((r) => ({ rollup: r, latest: latestByRollupId.get(r.Id) }))
      .sort((a, b) => a.rollup.CustomerName.localeCompare(b.rollup.CustomerName));
  }, [rollups, latestByRollupId, search]);
  const uploadedCount = contractRows.length
    ? new Set(contractRows.map((c) => c.CustomerAccount)).size
    : 0;

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-text">
          <p className="eyebrow">Contracts &amp; Amendments</p>
          <h1>Customer Contract Uploads</h1>
          <p className="subtitle">
            Account teams upload the latest signed contract or amendment per customer here, so sold
            licenses stay accurate and up to date. Every upload is versioned automatically — the
            newest upload is always the authoritative one.
            {uploadedCount > 0 && ` ${uploadedCount} of ${rollups.length} accounts have at least one contract on file.`}
          </p>
        </div>
      </section>
      <section className="table-card home-page">
        <div className="home-toolbar-compact">
          <h2>All Accounts</h2>
          <span className="home-toolbar-count">{rows.length.toLocaleString()} accounts</span>
          <label className="search-compact">
            <Search size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts" />
          </label>
        </div>
        <table className="condensed-table no-scroll-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Region</th>
              <th>Latest Version</th>
              <th>Last Uploaded</th>
              <th>Quarter</th>
              <th>Extraction Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rollup, latest }) => (
              <tr key={rollup.Id}>
                <td className="customer">{rollup.CustomerName}</td>
                <td>{rollup.CustomerRegion || "—"}</td>
                <td>{latest ? `v${latest.ContractVersion ?? "—"}` : "—"}</td>
                <td>{latest ? formatUpdateDate(latest.UploadedAt) : "—"}</td>
                <td>{latest?.UploadQuarter || "—"}</td>
                <td>{latest?.ExtractionStatus || (latest ? "—" : "No contract uploaded")}</td>
                <td>
                  <button className="details-trigger" onClick={() => setPanelRollup(rollup)}>
                    {latest ? "Manage" : "Upload"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {panelRollup && (
        <>
          <div className="drawer-backdrop" onClick={() => setPanelRollup(null)} />
          <aside className="detail-drawer">
            <div className="detail-drawer-header">
              <div>
                <h2>{panelRollup.CustomerName}</h2>
              </div>
              <button className="close-view" onClick={() => setPanelRollup(null)} aria-label="Close">
                <X size={17} />
              </button>
            </div>
            <div className="detail-drawer-body">
              <ContractUploads
                entities={entities}
                getToken={getToken}
                rollupId={panelRollup.Id}
                customerId={panelRollup.CustomerId}
                customerName={panelRollup.CustomerName}
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
