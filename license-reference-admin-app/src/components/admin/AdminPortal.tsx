import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Entities } from "@uipath/uipath-typescript/entities";
import type { EntityRecord } from "@uipath/uipath-typescript/entities";
import type { PaginatedResponse, PaginationCursor } from "@uipath/uipath-typescript/core";
import { useAuth } from "../../hooks/useAuth";
import { LicenseReferenceAdmin } from "./LicenseReferenceAdmin";
import { ContractsPage } from "./ContractsPage";
import { SoldPage } from "./SoldPage";
import type { BurndownRow, ContractRow, DrawerContent, RollupRow } from "../../types/soldContracts";
import {
  agentBurndownEntityId,
  aiBurndownEntityId,
  platformBurndownEntityId,
  purchasedEntitlementsEntityId,
  rollupEntityId,
  toPascalRecords,
} from "../../types/soldContracts";

type AdminView = "license-reference" | "contracts" | "sold";

export function AdminPortal({ onBack }: { onBack: () => void }) {
  const { sdk, getToken } = useAuth();
  const entities = useMemo(() => new Entities(sdk), [sdk]);
  const [view, setView] = useState<AdminView>("license-reference");
  const [rollups, setRollups] = useState<RollupRow[]>([]);
  const [contractRows, setContractRows] = useState<ContractRow[]>([]);
  const [platformBurndownRows, setPlatformBurndownRows] = useState<BurndownRow[]>([]);
  const [agentBurndownRows, setAgentBurndownRows] = useState<BurndownRow[]>([]);
  const [aiBurndownRows, setAiBurndownRows] = useState<BurndownRow[]>([]);
  const [drawer, setDrawer] = useState<DrawerContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Contracts and Sold data only matters once the admin actually opens
    // those tabs — the License Reference grid (default view) has its own
    // independent fetch in useLicenseReference, so this load is skipped
    // until needed to keep the initial page load light.
    if (view === "license-reference" || rollups.length > 0) return;
    const fetchAll = async (entityId: string) => {
      const all: EntityRecord[] = [];
      let cursor: PaginationCursor | undefined;
      do {
        const result = (await entities.getAllRecords(entityId, {
          pageSize: 1000,
          cursor,
        })) as PaginatedResponse<EntityRecord>;
        all.push(...result.items);
        cursor = result.hasNextPage ? result.nextCursor : undefined;
      } while (cursor);
      return all;
    };
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [r, p, pb, ab, aib] = await Promise.all([
          fetchAll(rollupEntityId),
          fetchAll(purchasedEntitlementsEntityId),
          fetchAll(platformBurndownEntityId),
          fetchAll(agentBurndownEntityId),
          fetchAll(aiBurndownEntityId),
        ]);
        setRollups(toPascalRecords<RollupRow>(r));
        setContractRows(toPascalRecords<ContractRow>(p).filter((row) => !!row.UploadedAt));
        setPlatformBurndownRows(toPascalRecords<BurndownRow>(pb));
        setAgentBurndownRows(toPascalRecords<BurndownRow>(ab));
        setAiBurndownRows(toPascalRecords<BurndownRow>(aib));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load data");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <>
      <nav className="page-tabs">
        <button
          className={view === "license-reference" ? "page-tab active" : "page-tab"}
          onClick={() => setView("license-reference")}
        >
          License Reference
        </button>
        <button
          className={view === "contracts" ? "page-tab active" : "page-tab"}
          onClick={() => setView("contracts")}
        >
          Contracts
        </button>
        <button
          className={view === "sold" ? "page-tab active" : "page-tab"}
          onClick={() => setView("sold")}
        >
          Sold
        </button>
      </nav>
      {view === "license-reference" ? (
        <LicenseReferenceAdmin onBack={onBack} />
      ) : (
        <main className="portal admin-portal">
          {error && <div className="error">{error}</div>}
          {loading && !rollups.length ? (
            <p className="burndown-empty">Loading…</p>
          ) : view === "contracts" ? (
            <ContractsPage
              rollups={rollups}
              contractRows={contractRows}
              entities={entities}
              getToken={getToken}
            />
          ) : (
            <SoldPage
              rollups={rollups}
              platformBurndownRows={platformBurndownRows}
              agentBurndownRows={agentBurndownRows}
              aiBurndownRows={aiBurndownRows}
              onOpenDrawer={setDrawer}
            />
          )}
          {drawer && (
            <>
              <div className="drawer-backdrop" onClick={() => setDrawer(null)} />
              <aside className="detail-drawer">
                <div className="detail-drawer-header">
                  <div>
                    <h2>{drawer.title}</h2>
                    {drawer.subtitle && <p className="subtitle">{drawer.subtitle}</p>}
                  </div>
                  <button className="close-view" onClick={() => setDrawer(null)} aria-label="Close details">
                    <X size={17} />
                  </button>
                </div>
                <div className="detail-drawer-body">
                  {drawer.sections.map((section, si) => (
                    <section key={si} className="drawer-section">
                      {section.heading && <h3>{section.heading}</h3>}
                      <div className="drawer-rows">
                        {section.rows.map((row, ri) => (
                          <div key={ri} className="drawer-row">
                            <span className="drawer-label">{row.label}</span>
                            <span className="drawer-value">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </aside>
            </>
          )}
        </main>
      )}
    </>
  );
}
