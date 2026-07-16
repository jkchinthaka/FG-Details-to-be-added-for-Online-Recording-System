import { BadRequestException } from "@nestjs/common";

export const MAX_EVIDENCE_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_EVIDENCE_FILES_PER_REQUEST = 4;
export const MAX_EVIDENCE_REQUEST_BYTES = MAX_EVIDENCE_FILE_BYTES * MAX_EVIDENCE_FILES_PER_REQUEST;

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"]);

export function assertAllowedEvidenceExtension(fileName: string): void {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(
      `File extension "${ext || "(none)"}" is not allowed. Use JPEG, PNG, WebP, GIF, or PDF.`,
    );
  }
}

export function normalizeEvidenceFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim().slice(0, 180) || "evidence.bin";
}
