"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  EVIDENCE_ACCEPT_ATTR,
  EVIDENCE_MAX_FILES,
  assertWithinFileCount,
  assertWithinTotalSize,
  validateEvidenceCandidate,
  type EvidencePhoto,
} from "@nelna/shared";
import { IconButton } from "./IconButton";
import { useEvidenceUpload } from "./EvidenceUploadContext";

export type EvidenceUploaderProps = {
  label?: string;
  value: EvidencePhoto[];
  onChange: (photos: EvidencePhoto[]) => void;
  disabled?: boolean;
  error?: string;
  maxPhotos?: number;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readHead(file: File): Promise<Uint8Array> {
  const buf = await file.slice(0, 16).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Photo/PDF evidence capture. When an `EvidenceUploadProvider` is present the
 * selected files are streamed to the server through a dedicated multipart
 * endpoint (with live progress); otherwise they are captured inline as data
 * URLs for offline use. Either way the files are validated client-side first so
 * the operator gets immediate, specific feedback.
 */
export function EvidenceUploader({
  label = "Photo evidence",
  value,
  onChange,
  disabled = false,
  error,
  maxPhotos = EVIDENCE_MAX_FILES,
}: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadFiles = useEvidenceUpload();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const atLimit = value.length >= maxPhotos;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setLocalError(null);

    const remaining = Math.max(0, maxPhotos - value.length);
    const countError = assertWithinFileCount(value.length + files.length);
    if (countError) {
      setLocalError(countError.message);
      return;
    }

    // Client-side validation for fast, specific feedback (server re-validates).
    const accepted: File[] = [];
    let totalBytes = 0;
    for (const file of files.slice(0, remaining)) {
      const head = await readHead(file);
      const result = validateEvidenceCandidate({
        fileName: file.name,
        claimedMime: file.type,
        sizeBytes: file.size,
        head,
      });
      if (!result.ok) {
        setLocalError(`${file.name}: ${result.message}`);
        return;
      }
      totalBytes += file.size;
      accepted.push(file);
    }
    const totalError = assertWithinTotalSize(totalBytes);
    if (totalError) {
      setLocalError(totalError.message);
      return;
    }

    if (uploadFiles) {
      setBusy(true);
      setProgress(0);
      try {
        const uploaded = await uploadFiles(accepted, setProgress);
        onChange([...value, ...uploaded]);
      } catch (err) {
        setLocalError(
          err instanceof Error
            ? err.message
            : "The upload failed. Check your connection and try again.",
        );
      } finally {
        setBusy(false);
        setProgress(0);
      }
      return;
    }

    // Offline fallback: capture as data URLs (validated above).
    const next: EvidencePhoto[] = [...value];
    for (const file of accepted) {
      const url = await readAsDataUrl(file);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        fileName: file.name,
        capturedAt: new Date().toISOString(),
      });
    }
    onChange(next);
  }

  function removePhoto(id: string) {
    onChange(value.filter((photo) => photo.id !== id));
  }

  const shownError = localError ?? error;

  return (
    <div className="nelna-field">
      <span className="nelna-field-label">{label}</span>

      {value.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {value.map((photo) => (
            <div
              key={photo.id}
              style={{
                position: "relative",
                width: "72px",
                height: "72px",
                borderRadius: "var(--nelna-radius-sm)",
                overflow: "hidden",
                border: "2px solid var(--nelna-border)",
                background: "var(--nelna-surface-muted, #f2f2f2)",
              }}
            >
              {photo.url.startsWith("data:image/") ||
              photo.url.startsWith("/evidence/") ? (
                <img
                  src={photo.url}
                  alt={photo.fileName}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <span
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.7rem",
                    padding: "0.25rem",
                    textAlign: "center",
                    wordBreak: "break-word",
                  }}
                >
                  {photo.fileName}
                </span>
              )}
              <div style={{ position: "absolute", top: 2, right: 2 }}>
                <IconButton
                  icon={<span aria-hidden>×</span>}
                  label={`Remove ${photo.fileName}`}
                  variant="solid"
                  disabled={disabled || busy}
                  onClick={() => removePhoto(photo.id)}
                  style={{ minWidth: "24px", minHeight: "24px", padding: 0 }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {busy ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Uploading evidence"
          style={{
            height: "6px",
            borderRadius: "999px",
            background: "var(--nelna-border, #ddd)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "var(--nelna-primary, #0b7)",
              transition: "width 120ms ease",
            }}
          />
        </div>
      ) : null}

      <button
        type="button"
        className="nelna-btn nelna-btn-secondary nelna-btn-md nelna-focusable"
        disabled={disabled || atLimit || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy
          ? `Uploading… ${progress}%`
          : value.length > 0
            ? "Add another file"
            : "Attach evidence"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={EVIDENCE_ACCEPT_ATTR}
        capture="environment"
        multiple
        hidden
        disabled={disabled || atLimit || busy}
        onChange={handleFiles}
      />

      {shownError ? (
        <p role="alert" className="nelna-field-error">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
