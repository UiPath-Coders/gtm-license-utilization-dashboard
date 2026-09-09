import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import type {
  LicenseReference,
  LicenseReferenceDraft,
  LicenseReferenceField,
} from "../../types/licenseReference";
import { emptyLicenseReferenceDraft } from "../../types/licenseReference";
import type { SaveResult } from "../../hooks/useLicenseReference";
import { EditableCell } from "./EditableCell";
import type { CommitCause } from "./EditableCell";
import { NewLicenseRow } from "./NewLicenseRow";
import { DeleteLicenseDialog } from "./DeleteLicenseDialog";
import { GRID_COLUMNS } from "./gridConfig";

type CellRef = { rowId: string; field: LicenseReferenceField };

const requiredError = (value: string) =>
  value.trim() ? undefined : "Required";

export function EditableLicenseGrid({
  records,
  savingRowIds,
  isDuplicateKey,
  onUpdateField,
  onDelete,
  onCreate,
  searchQuery,
  onNotify,
}: {
  records: LicenseReference[];
  savingRowIds: Set<string>;
  isDuplicateKey: (
    pricingName: string,
    skuName: string,
    excludeId?: string,
  ) => boolean;
  onUpdateField: (
    id: string,
    field: LicenseReferenceField,
    value: string,
  ) => Promise<SaveResult>;
  onDelete: (id: string) => Promise<SaveResult>;
  onCreate: (draft: LicenseReferenceDraft) => Promise<SaveResult>;
  searchQuery: string;
  onNotify: (message: string, kind: "success" | "error") => void;
}) {
  const [columnOrder, setColumnOrder] = useState<LicenseReferenceField[]>(
    GRID_COLUMNS.map((c) => c.field),
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => Object.fromEntries(GRID_COLUMNS.map((c) => [c.field, c.defaultWidth])),
  );
  const [selected, setSelected] = useState<CellRef | null>(null);
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [justSaved, setJustSaved] = useState<CellRef | null>(null);
  const [rowErrors, setRowErrors] = useState<
    Record<string, Partial<Record<LicenseReferenceField, string>>>
  >({});
  const [deleteTarget, setDeleteTarget] = useState<LicenseReference | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isAddingRow, setIsAddingRow] = useState(false);
  const [duplicatedFromSku, setDuplicatedFromSku] = useState<string | null>(
    null,
  );
  const [newRowDraft, setNewRowDraft] = useState<LicenseReferenceDraft>(
    emptyLicenseReferenceDraft(),
  );
  const [newRowErrors, setNewRowErrors] = useState<
    Partial<Record<LicenseReferenceField, string>>
  >({});
  const [newRowSaving, setNewRowSaving] = useState(false);

  const columns = useMemo(
    () => columnOrder.map((f) => GRID_COLUMNS.find((c) => c.field === f)!),
    [columnOrder],
  );

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      columnOrder.some((f) => String(r[f] ?? "").toLowerCase().includes(q)),
    );
  }, [records, searchQuery, columnOrder]);

  const moveColumn = (field: LicenseReferenceField, direction: -1 | 1) => {
    setColumnOrder((prev) => {
      const idx = prev.indexOf(field);
      const swapWith = idx + direction;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  };

  const startResize = (field: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[field];
    const col = GRID_COLUMNS.find((c) => c.field === field)!;
    const onMove = (ev: PointerEvent) =>
      setColumnWidths((prev) => ({
        ...prev,
        [field]: Math.max(col.minWidth, startWidth + ev.clientX - startX),
      }));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const setCellError = (
    rowId: string,
    field: LicenseReferenceField,
    message: string | undefined,
  ) =>
    setRowErrors((prev) => {
      const rowErr = { ...(prev[rowId] ?? {}) };
      if (message) rowErr[field] = message;
      else delete rowErr[field];
      return { ...prev, [rowId]: rowErr };
    });

  const focusNext = (rowId: string, field: LicenseReferenceField, dir: 1 | -1) => {
    const rowIdx = filteredRecords.findIndex((r) => r.Id === rowId);
    const colIdx = columnOrder.indexOf(field);
    let nextCol = colIdx + dir;
    let nextRow = rowIdx;
    if (nextCol < 0) {
      nextCol = columnOrder.length - 1;
      nextRow -= 1;
    } else if (nextCol >= columnOrder.length) {
      nextCol = 0;
      nextRow += 1;
    }
    if (nextRow < 0 || nextRow >= filteredRecords.length) {
      setEditing(null);
      setSelected({ rowId, field });
      return;
    }
    const nextRef: CellRef = {
      rowId: filteredRecords[nextRow].Id,
      field: columnOrder[nextCol],
    };
    setSelected(nextRef);
    setEditing(nextRef);
  };

  const handleCommit = async (
    record: LicenseReference,
    field: LicenseReferenceField,
    rawValue: string,
    cause: CommitCause,
  ) => {
    const value = rawValue.trim();
    const reqError = requiredError(value);
    if (reqError) {
      setCellError(record.Id, field, reqError);
      return;
    }
    const pricingName = field === "PricingName" ? value : record.PricingName;
    const skuName = field === "SkuName" ? value : record.SkuName;
    if (
      (field === "PricingName" || field === "SkuName") &&
      isDuplicateKey(pricingName, skuName, record.Id)
    ) {
      setCellError(
        record.Id,
        field,
        "Duplicate Pricing Name + SKU Name combination",
      );
      return;
    }
    setCellError(record.Id, field, undefined);

    if (value === record[field]) {
      setEditing(null);
      if (cause === "tab") focusNext(record.Id, field, 1);
      if (cause === "shift-tab") focusNext(record.Id, field, -1);
      return;
    }

    const result = await onUpdateField(record.Id, field, value);
    if (result.ok) {
      setEditing(null);
      setJustSaved({ rowId: record.Id, field });
      window.setTimeout(() => setJustSaved(null), 1500);
      if (cause === "tab") focusNext(record.Id, field, 1);
      else if (cause === "shift-tab") focusNext(record.Id, field, -1);
      onNotify(`Saved ${field} for ${record.SkuName}`, "success");
    } else {
      setCellError(record.Id, field, result.error);
      onNotify(result.error, "error");
      // Editing stays open so the user's typed value is preserved for retry.
    }
  };

  const openAddRow = (draft?: LicenseReferenceDraft, sourceSkuName?: string) => {
    setNewRowDraft(draft ?? emptyLicenseReferenceDraft());
    setNewRowErrors({});
    setDuplicatedFromSku(sourceSkuName ?? null);
    setIsAddingRow(true);
  };

  const closeAddRow = () => {
    setIsAddingRow(false);
    setNewRowDraft(emptyLicenseReferenceDraft());
    setNewRowErrors({});
    setDuplicatedFromSku(null);
  };

  const validateNewRow = (draft: LicenseReferenceDraft) => {
    const errors: Partial<Record<LicenseReferenceField, string>> = {};
    (Object.keys(draft) as LicenseReferenceField[]).forEach((f) => {
      const err = requiredError(draft[f]);
      if (err) errors[f] = err;
    });
    if (
      !errors.PricingName &&
      !errors.SkuName &&
      isDuplicateKey(draft.PricingName, draft.SkuName)
    ) {
      errors.SkuName = "Duplicate Pricing Name + SKU Name combination";
    }
    return errors;
  };

  const handleSaveNewRow = async () => {
    const trimmed: LicenseReferenceDraft = {
      PricingName: newRowDraft.PricingName.trim(),
      LicenseCategory: newRowDraft.LicenseCategory.trim(),
      SkuName: newRowDraft.SkuName.trim(),
      LicenseType: newRowDraft.LicenseType.trim(),
      LicenseGroup: newRowDraft.LicenseGroup.trim(),
    };
    const errors = validateNewRow(trimmed);
    if (duplicatedFromSku && trimmed.SkuName === duplicatedFromSku) {
      errors.SkuName = "Change the SKU Name before saving a duplicated row.";
    }
    if (Object.keys(errors).length) {
      setNewRowErrors(errors);
      return;
    }
    setNewRowSaving(true);
    const result = await onCreate(trimmed);
    setNewRowSaving(false);
    if (result.ok) {
      closeAddRow();
      onNotify(`Created reference row for ${trimmed.SkuName}`, "success");
    } else {
      setNewRowErrors({ SkuName: result.error });
      onNotify(result.error, "error");
    }
  };

  const totalWidth = columns.reduce((sum, c) => sum + columnWidths[c.field], 0) + 90;

  return (
    <div className="license-grid-wrap">
      <div className="grid-toolbar-row">
        <button
          className="add-row-btn"
          onClick={() => openAddRow()}
          disabled={isAddingRow}
        >
          <Plus size={14} /> Add Row
        </button>
      </div>
      <div className="license-grid-scroll">
        <table className="license-grid" style={{ width: `${totalWidth}px` }}>
          <colgroup>
            {columns.map((c) => (
              <col key={c.field} style={{ width: `${columnWidths[c.field]}px` }} />
            ))}
            <col style={{ width: "90px" }} />
          </colgroup>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.field}>
                  <div className="grid-th-inner">
                    <button
                      className="col-move-btn"
                      onClick={() => moveColumn(c.field, -1)}
                      title="Move column left"
                      aria-label={`Move ${c.label} left`}
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span>{c.label}</span>
                    <button
                      className="col-move-btn"
                      onClick={() => moveColumn(c.field, 1)}
                      title="Move column right"
                      aria-label={`Move ${c.label} right`}
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                  <button
                    className="resize-handle"
                    aria-label={`Resize ${c.label} column`}
                    onPointerDown={(e) => startResize(c.field, e)}
                  />
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 && !isAddingRow ? (
              <tr>
                <td colSpan={columns.length + 1} className="state">
                  No matching reference records.
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => (
                <tr key={record.Id}>
                  {columns.map((c) => (
                    <EditableCell
                      key={c.field}
                      value={record[c.field]}
                      editorType={c.editorType}
                      selectOptions={c.options}
                      isSelected={
                        selected?.rowId === record.Id && selected.field === c.field
                      }
                      isEditing={
                        editing?.rowId === record.Id && editing.field === c.field
                      }
                      isSaving={savingRowIds.has(record.Id)}
                      justSaved={
                        justSaved?.rowId === record.Id && justSaved.field === c.field
                      }
                      error={rowErrors[record.Id]?.[c.field]}
                      onSelect={() =>
                        setSelected({ rowId: record.Id, field: c.field })
                      }
                      onStartEdit={() => {
                        setSelected({ rowId: record.Id, field: c.field });
                        setEditing({ rowId: record.Id, field: c.field });
                      }}
                      onCommit={(value, cause) =>
                        handleCommit(record, c.field, value, cause)
                      }
                      onCancel={() => {
                        setCellError(record.Id, c.field, undefined);
                        setEditing(null);
                      }}
                    />
                  ))}
                  <td className="row-actions">
                    <button
                      className="row-action-btn"
                      title="Duplicate row"
                      aria-label={`Duplicate ${record.SkuName}`}
                      onClick={() =>
                        openAddRow(
                          {
                            PricingName: record.PricingName,
                            LicenseCategory: record.LicenseCategory,
                            SkuName: "",
                            LicenseType: record.LicenseType,
                            LicenseGroup: record.LicenseGroup,
                          },
                          record.SkuName,
                        )
                      }
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="row-action-btn row-action-delete"
                      title="Delete row"
                      aria-label={`Delete ${record.SkuName}`}
                      onClick={() => setDeleteTarget(record)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {isAddingRow && (
              <NewLicenseRow
                draft={newRowDraft}
                errors={newRowErrors}
                isSaving={newRowSaving}
                onChange={(field, value) => {
                  setNewRowDraft((prev) => ({ ...prev, [field]: value }));
                  setNewRowErrors((prev) => ({ ...prev, [field]: undefined }));
                }}
                onSave={handleSaveNewRow}
                onCancel={closeAddRow}
              />
            )}
            {!isAddingRow && (
              <tr className="add-row-placeholder">
                <td colSpan={columns.length} className="add-row-hint">
                  Click the + button to add a new license reference row.
                </td>
                <td className="row-actions">
                  <button
                    className="row-action-btn row-action-add"
                    title="Add row"
                    aria-label="Add row"
                    onClick={() => openAddRow()}
                  >
                    <Plus size={15} />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {deleteTarget && (
        <DeleteLicenseDialog
          record={deleteTarget}
          isDeleting={deletingId === deleteTarget.Id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setDeletingId(deleteTarget.Id);
            const result = await onDelete(deleteTarget.Id);
            setDeletingId(null);
            if (result.ok) {
              onNotify(
                `Deleted ${deleteTarget.PricingName} / ${deleteTarget.SkuName}`,
                "success",
              );
              setDeleteTarget(null);
            } else {
              onNotify(result.error, "error");
            }
          }}
        />
      )}
    </div>
  );
}
