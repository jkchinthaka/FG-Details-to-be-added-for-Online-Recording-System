"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./internal/icons";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Centered dialog for focused decisions (confirmations, short forms). */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div className="nelna-overlay" onMouseDown={handleOverlayClick}>
      <div role="dialog" aria-modal="true" aria-label={title} className="nelna-modal">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--nelna-font-display)",
              fontSize: "1.3rem",
              color: "var(--nelna-primary-active)",
            }}
          >
            {title}
          </h2>
          <IconButton icon={<CloseIcon />} label="Close" onClick={onClose} />
        </div>
        <div style={{ marginTop: "1rem" }}>{children}</div>
        {footer ? (
          <div
            style={{
              marginTop: "1.25rem",
              display: "flex",
              gap: "0.5rem",
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
