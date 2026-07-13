"use client";

import { useEffect, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./internal/icons";

export type DrawerSide = "right" | "bottom";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: DrawerSide;
};

/** Off-canvas panel used for secondary navigation and contextual actions. */
export function Drawer({ open, onClose, title, children, side = "right" }: DrawerProps) {
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

  const overlayStyle: CSSProperties | undefined =
    side === "bottom" ? { alignItems: "flex-end" } : undefined;

  return createPortal(
    <div className="nelna-overlay" style={overlayStyle} onMouseDown={handleOverlayClick}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={["nelna-drawer", side === "bottom" ? "nelna-drawer-bottom" : null]
          .filter(Boolean)
          .join(" ")}
      >
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
              fontSize: "1.2rem",
              color: "var(--nelna-primary-active)",
            }}
          >
            {title}
          </h2>
          <IconButton icon={<CloseIcon />} label="Close" onClick={onClose} />
        </div>
        <div style={{ marginTop: "1rem" }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
