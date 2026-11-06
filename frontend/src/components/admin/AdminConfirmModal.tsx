
import { useEffect, useRef } from "react";
import styles from "./AdminConfirmModal.module.css";

type Props = {
  title: string;
  description: string;
  itemName: string;
  confirmLabel: string;
  loading?: boolean;
  notice?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function AdminConfirmModal({
  title,
  description,
  itemName,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
  cancelLabel = "Keep Branch",
  loadingLabel = "Deactivating...",
  notice,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();
    cancelRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }

    onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="velora-confirm-title"
      aria-describedby="velora-confirm-description"
      onCancel={handleCancel}
    >
      <div className={styles.content}>
        <div className={styles.heading}>
          <div className={styles.warningIcon} aria-hidden="true">
            !
          </div>

          <div>
            <span className={styles.eyebrow}>
              VELORA MANAGEMENT
            </span>
            <h2 id="velora-confirm-title">{title}</h2>
          </div>
        </div>

        <p className={styles.itemName}>{itemName}</p>

        <p
          id="velora-confirm-description"
          className={styles.description}
        >
          {description}
        </p>

        {notice && (
          <div className={styles.notice}>
            {notice}
          </div>
        )}

        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
