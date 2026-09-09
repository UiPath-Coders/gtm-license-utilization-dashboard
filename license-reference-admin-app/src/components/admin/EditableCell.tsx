import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export type CommitCause = "enter" | "tab" | "shift-tab" | "blur";

export interface EditableCellProps {
  value: string;
  editorType: "text" | "select";
  selectOptions?: string[];
  isSelected: boolean;
  isEditing: boolean;
  isSaving: boolean;
  justSaved: boolean;
  error?: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onCommit: (value: string, cause: CommitCause) => void;
  onCancel: () => void;
}

export function EditableCell({
  value,
  editorType,
  selectOptions,
  isSelected,
  isEditing,
  isSaving,
  justSaved,
  error,
  onSelect,
  onStartEdit,
  onCommit,
  onCancel,
}: EditableCellProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing) setDraft(value);
  }, [isEditing, value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select();
    }
  }, [isEditing]);

  const commit = (cause: CommitCause) => onCommit(draft, cause);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit("enter");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit(e.shiftKey ? "shift-tab" : "tab");
    }
  };

  if (isEditing) {
    return (
      <td className={`editable-cell editing${error ? " cell-error" : ""}`}>
        {editorType === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            className="cell-editor"
            value={draft}
            disabled={isSaving}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => commit("blur")}
          >
            <option value="" disabled>
              Select…
            </option>
            {(selectOptions ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            className="cell-editor"
            type="text"
            value={draft}
            disabled={isSaving}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => commit("blur")}
          />
        )}
        {isSaving && <Loader2 size={13} className="spin cell-status-icon" />}
        {error && <span className="cell-error-message">{error}</span>}
      </td>
    );
  }

  return (
    <td
      className={`editable-cell${isSelected ? " selected" : ""}${error ? " cell-error" : ""}`}
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={onStartEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onStartEdit();
      }}
    >
      <span className="cell-value">{value || <span className="missing">—</span>}</span>
      {isSaving && <Loader2 size={13} className="spin cell-status-icon" />}
      {!isSaving && justSaved && (
        <Check size={13} className="cell-status-icon cell-saved-icon" />
      )}
      {error && <span className="cell-error-message">{error}</span>}
    </td>
  );
}
