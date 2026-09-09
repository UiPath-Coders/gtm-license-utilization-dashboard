import { AlertTriangle, X } from "lucide-react";
import type { LicenseReference } from "../../types/licenseReference";

export function DeleteLicenseDialog({
  record,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  record: LicenseReference;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <AlertTriangle size={18} className="dialog-icon-warn" />
          <h3>Delete license reference record?</h3>
          <button className="dialog-close" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="dialog-body">
          This will permanently delete the record for{" "}
          <strong>{record.PricingName}</strong> /{" "}
          <strong>{record.SkuName}</strong>. This cannot be undone.
        </p>
        <div className="dialog-actions">
          <button className="dialog-btn-secondary" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button className="dialog-btn-danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete record"}
          </button>
        </div>
      </div>
    </div>
  );
}
