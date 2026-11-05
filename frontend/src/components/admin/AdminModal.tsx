import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./AdminModal.module.css";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  canClose?: boolean;
  size?: "medium" | "large";
};

export default function AdminModal({
  title,
  subtitle,
  children,
  onClose,
  canClose = true,
  size = "medium",
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

    const canCloseRef = useRef(canClose);

    useEffect(() => {
        canCloseRef.current = canClose;
    }, [canClose]);

    function requestClose() {
        if (canClose) {
            onClose();
        }
    }

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;

    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();

        if (canCloseRef.current) {
            onCloseRef.current();
        }

        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), ' +
          'select:not(:disabled), textarea:not(:disabled), ' +
          'a[href], [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable?.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`${styles.modal} ${
          size === "large" ? styles.large : styles.medium
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

            <button
                ref={closeRef}
                type="button"
                className={styles.closeButton}
                onClick={requestClose}
                disabled={!canClose}
                aria-label="Close dialog"
            >
                ×
            </button>
        </header>

        <div className={styles.content}>{children}</div>
      </div>
    </div>,
    document.body
  );
}