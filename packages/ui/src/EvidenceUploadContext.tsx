"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { EvidencePhoto } from "@nelna/shared";

/**
 * FG-FILE-001 — injects a real multipart upload implementation into the
 * presentational `EvidenceUploader` without prop-drilling through the whole
 * checklist tree. When no provider is present the uploader falls back to
 * offline (data URL) capture, so the component keeps working everywhere.
 */
export type EvidenceUploadFn = (
  files: File[],
  onProgress: (percent: number) => void,
) => Promise<EvidencePhoto[]>;

const EvidenceUploadContext = createContext<EvidenceUploadFn | null>(null);

export function EvidenceUploadProvider({
  uploadFiles,
  children,
}: {
  uploadFiles: EvidenceUploadFn | null;
  children: ReactNode;
}) {
  return (
    <EvidenceUploadContext.Provider value={uploadFiles}>
      {children}
    </EvidenceUploadContext.Provider>
  );
}

export function useEvidenceUpload(): EvidenceUploadFn | null {
  return useContext(EvidenceUploadContext);
}
