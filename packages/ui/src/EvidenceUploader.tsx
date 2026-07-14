"use client";

import { useRef, type ChangeEvent } from "react";
import type { EvidencePhoto } from "@nelna/shared";
import { IconButton } from "./IconButton";

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

/**
 * Photo evidence capture/upload. Stores photos as data URLs on the client —
 * "UI ready" for a real upload API to be swapped in later without changing
 * the controlled `value`/`onChange` contract.
 */
export function EvidenceUploader({
  label = "Photo evidence",
  value,
  onChange,
  disabled = false,
  error,
  maxPhotos = 4,
}: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const atLimit = value.length >= maxPhotos;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const remaining = Math.max(0, maxPhotos - value.length);
    const next: EvidencePhoto[] = [...value];
    for (const file of files.slice(0, remaining)) {
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
              }}
            >
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
              <div style={{ position: "absolute", top: 2, right: 2 }}>
                <IconButton
                  icon={<span aria-hidden>×</span>}
                  label={`Remove ${photo.fileName}`}
                  variant="solid"
                  disabled={disabled}
                  onClick={() => removePhoto(photo.id)}
                  style={{ minWidth: "24px", minHeight: "24px", padding: 0 }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className="nelna-btn nelna-btn-secondary nelna-btn-md nelna-focusable"
        disabled={disabled || atLimit}
        onClick={() => inputRef.current?.click()}
      >
        {value.length > 0 ? "Add another photo" : "Attach photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        disabled={disabled || atLimit}
        onChange={handleFiles}
      />

      {error ? (
        <p role="alert" className="nelna-field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
