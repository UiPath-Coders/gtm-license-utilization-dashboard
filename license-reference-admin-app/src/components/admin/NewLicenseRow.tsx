import { Check, Loader2, X } from "lucide-react";
import type {
  LicenseReferenceDraft,
  LicenseReferenceField,
} from "../../types/licenseReference";
import { PRICING_NAME_OPTIONS, LICENSE_TYPE_OPTIONS } from "./gridConfig";

export function NewLicenseRow({
  draft,
  onChange,
  onSave,
  onCancel,
  isSaving,
  errors,
}: {
  draft: LicenseReferenceDraft;
  onChange: (field: LicenseReferenceField, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  errors: Partial<Record<LicenseReferenceField, string>>;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <tr className="new-row" onKeyDown={handleKeyDown}>
      <td className={errors.PricingName ? "cell-error" : undefined}>
        <select
          className="cell-editor"
          value={draft.PricingName}
          disabled={isSaving}
          onChange={(e) => onChange("PricingName", e.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {PRICING_NAME_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {errors.PricingName && (
          <span className="cell-error-message">{errors.PricingName}</span>
        )}
      </td>
      <td className={errors.LicenseCategory ? "cell-error" : undefined}>
        <input
          className="cell-editor"
          type="text"
          value={draft.LicenseCategory}
          disabled={isSaving}
          onChange={(e) => onChange("LicenseCategory", e.target.value)}
          placeholder="License Category"
        />
        {errors.LicenseCategory && (
          <span className="cell-error-message">{errors.LicenseCategory}</span>
        )}
      </td>
      <td className={errors.SkuName ? "cell-error" : undefined}>
        <input
          className="cell-editor"
          type="text"
          value={draft.SkuName}
          disabled={isSaving}
          onChange={(e) => onChange("SkuName", e.target.value)}
          placeholder="SKU Name"
        />
        {errors.SkuName && <span className="cell-error-message">{errors.SkuName}</span>}
      </td>
      <td className={errors.LicenseType ? "cell-error" : undefined}>
        <select
          className="cell-editor"
          value={draft.LicenseType}
          disabled={isSaving}
          onChange={(e) => onChange("LicenseType", e.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {LICENSE_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {errors.LicenseType && (
          <span className="cell-error-message">{errors.LicenseType}</span>
        )}
      </td>
      <td className={errors.LicenseGroup ? "cell-error" : undefined}>
        <input
          className="cell-editor"
          type="text"
          value={draft.LicenseGroup}
          disabled={isSaving}
          onChange={(e) => onChange("LicenseGroup", e.target.value)}
          placeholder="License Group"
        />
        {errors.LicenseGroup && (
          <span className="cell-error-message">{errors.LicenseGroup}</span>
        )}
      </td>
      <td className="row-actions">
        <button
          className="row-action-btn row-action-save"
          onClick={onSave}
          disabled={isSaving}
          title="Save new row"
          aria-label="Save new row"
        >
          {isSaving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
        </button>
        <button
          className="row-action-btn row-action-cancel"
          onClick={onCancel}
          disabled={isSaving}
          title="Cancel"
          aria-label="Cancel new row"
        >
          <X size={15} />
        </button>
      </td>
    </tr>
  );
}
