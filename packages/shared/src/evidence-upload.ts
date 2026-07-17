/**
 * FG-FILE-001 — Shared evidence upload policy.
 *
 * Pure, dependency-free rules shared by the API (server-side enforcement) and
 * the web client (fast client-side pre-checks). The server is always the
 * authority; the client uses these only to give early, friendly feedback.
 *
 * Security intent:
 *  - Bound the number/size of uploaded files (DoS + memory safety).
 *  - Constrain evidence to a small allow-list of image/pdf types.
 *  - Detect the real file type from magic bytes and reject MIME/extension spoofing.
 *  - Normalise filenames so they can never be used for path traversal or as
 *    control payloads. The stored filename is always server-owned.
 */

export const EVIDENCE_MAX_FILES = 4;
export const EVIDENCE_MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MiB per file
export const EVIDENCE_MAX_TOTAL_BYTES = 32 * 1024 * 1024; // 32 MiB per request

/** Stable, machine-readable rejection codes surfaced to the client UI. */
export type EvidenceRejectionCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "TOTAL_TOO_LARGE"
  | "DISALLOWED_EXTENSION"
  | "DISALLOWED_MIME"
  | "MIME_SPOOFED"
  | "UNREADABLE_SIGNATURE";

export type EvidenceContentType =
  "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";

type AllowedType = {
  mime: EvidenceContentType;
  extensions: readonly string[];
};

/** The single source of truth for permitted evidence types. */
export const EVIDENCE_ALLOWED_TYPES: readonly AllowedType[] = [
  { mime: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  { mime: "image/png", extensions: [".png"] },
  { mime: "image/webp", extensions: [".webp"] },
  { mime: "image/gif", extensions: [".gif"] },
  { mime: "application/pdf", extensions: [".pdf"] },
];

export const EVIDENCE_ALLOWED_MIME_TYPES: readonly EvidenceContentType[] =
  EVIDENCE_ALLOWED_TYPES.map((t) => t.mime);

export const EVIDENCE_ALLOWED_EXTENSIONS: readonly string[] =
  EVIDENCE_ALLOWED_TYPES.flatMap((t) => t.extensions);

/** HTML accept attribute value for the file picker. */
export const EVIDENCE_ACCEPT_ATTR = [
  ...EVIDENCE_ALLOWED_MIME_TYPES,
  ...EVIDENCE_ALLOWED_EXTENSIONS,
].join(",");

export function isAllowedEvidenceMime(mime: string): mime is EvidenceContentType {
  return EVIDENCE_ALLOWED_MIME_TYPES.includes(mime as EvidenceContentType);
}

export function evidenceExtensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot).toLowerCase();
}

export function isAllowedEvidenceExtension(fileName: string): boolean {
  const ext = evidenceExtensionOf(fileName);
  return ext !== "" && EVIDENCE_ALLOWED_EXTENSIONS.includes(ext);
}

/** Extensions the detected MIME type is allowed to carry. */
export function extensionsForMime(mime: EvidenceContentType): readonly string[] {
  return EVIDENCE_ALLOWED_TYPES.find((t) => t.mime === mime)?.extensions ?? [];
}

/**
 * Normalise a client-supplied filename into a safe display name.
 *
 * This is NEVER used as a storage path — the server generates its own storage
 * id. It strips directory separators, control characters and reserved glyphs,
 * collapses whitespace, and bounds the length. Returns a safe fallback when the
 * input reduces to nothing.
 */
export function normalizeEvidenceFileName(raw: string): string {
  const withoutPath = (raw ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  // Drop leading dots so we never produce ".." or hidden path-like names.
  const cleaned = withoutPath.replace(/^\.+/, "").trim();
  if (!cleaned) return "evidence.bin";
  return cleaned.slice(0, 180);
}

/**
 * Magic-byte / file-signature detection. Returns the detected content type or
 * null when the leading bytes do not match any permitted type. Only needs the
 * first ~16 bytes, so it can run on the first streamed chunk.
 */
export function detectEvidenceSignature(bytes: Uint8Array): EvidenceContentType | null {
  const b = bytes;
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "image/png";
  }
  // PDF: 25 50 44 46 2D  ("%PDF-")
  if (
    b.length >= 5 &&
    b[0] === 0x25 &&
    b[1] === 0x50 &&
    b[2] === 0x44 &&
    b[3] === 0x46 &&
    b[4] === 0x2d
  ) {
    return "application/pdf";
  }
  // GIF: "GIF87a" / "GIF89a"
  if (
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return "image/gif";
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type EvidenceValidationOk = {
  ok: true;
  /** The authoritative content type derived from the file's magic bytes. */
  detectedMime: EvidenceContentType;
  /** Safe, normalised display filename. */
  fileName: string;
};

export type EvidenceValidationError = {
  ok: false;
  code: EvidenceRejectionCode;
  message: string;
};

export type EvidenceValidationResult = EvidenceValidationOk | EvidenceValidationError;

export type EvidenceCandidate = {
  /** Client-supplied original filename. */
  fileName: string;
  /** Client-declared MIME type (untrusted). */
  claimedMime: string;
  /** Total size in bytes (0 allowed only to be rejected). */
  sizeBytes: number;
  /** Leading bytes of the file used for signature detection. */
  head: Uint8Array;
};

/**
 * Validate a single candidate file against the full policy: size, extension,
 * declared MIME, magic bytes and cross-consistency (anti-spoofing).
 *
 * The detected (magic-byte) type is authoritative. A file is rejected when its
 * real type is not permitted, or when its declared MIME / extension disagree
 * with the real type — this is what blocks a renamed executable or a MIME
 * spoof.
 */
export function validateEvidenceCandidate(
  candidate: EvidenceCandidate,
): EvidenceValidationResult {
  if (!candidate.sizeBytes || candidate.sizeBytes <= 0) {
    return { ok: false, code: "EMPTY_FILE", message: "The file is empty." };
  }
  if (candidate.sizeBytes > EVIDENCE_MAX_FILE_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `Each file must be ${formatMib(EVIDENCE_MAX_FILE_BYTES)} or smaller.`,
    };
  }

  if (!isAllowedEvidenceExtension(candidate.fileName)) {
    return {
      ok: false,
      code: "DISALLOWED_EXTENSION",
      message: `Allowed file types: ${EVIDENCE_ALLOWED_EXTENSIONS.join(", ")}.`,
    };
  }

  const claimed = candidate.claimedMime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (claimed && !isAllowedEvidenceMime(claimed)) {
    return {
      ok: false,
      code: "DISALLOWED_MIME",
      message: "That file type is not accepted as evidence.",
    };
  }

  const detected = detectEvidenceSignature(candidate.head);
  if (!detected) {
    return {
      ok: false,
      code: "UNREADABLE_SIGNATURE",
      message: "The file content does not match a supported image or PDF.",
    };
  }

  // Extension must be consistent with the real content type.
  const ext = evidenceExtensionOf(candidate.fileName);
  if (!extensionsForMime(detected).includes(ext)) {
    return {
      ok: false,
      code: "MIME_SPOOFED",
      message: "The file extension does not match its actual content.",
    };
  }

  // Declared MIME, when present, must match the real content type.
  if (claimed && claimed !== detected) {
    return {
      ok: false,
      code: "MIME_SPOOFED",
      message: "The declared file type does not match its actual content.",
    };
  }

  return {
    ok: true,
    detectedMime: detected,
    fileName: normalizeEvidenceFileName(candidate.fileName),
  };
}

export function assertWithinFileCount(count: number): EvidenceValidationError | null {
  if (count > EVIDENCE_MAX_FILES) {
    return {
      ok: false,
      code: "TOO_MANY_FILES",
      message: `Attach at most ${EVIDENCE_MAX_FILES} files.`,
    };
  }
  return null;
}

export function assertWithinTotalSize(
  totalBytes: number,
): EvidenceValidationError | null {
  if (totalBytes > EVIDENCE_MAX_TOTAL_BYTES) {
    return {
      ok: false,
      code: "TOTAL_TOO_LARGE",
      message: `Total upload must be ${formatMib(EVIDENCE_MAX_TOTAL_BYTES)} or smaller.`,
    };
  }
  return null;
}

/** True for the internal, server-owned evidence reference the client may resubmit. */
export function isManagedEvidenceUrl(url: string): boolean {
  return /^\/evidence\/[A-Za-z0-9]+\/download$/.test(url);
}

/** Data URLs are the only inline form accepted (offline capture); everything
 *  else (http/https/ftp/etc.) is an untrusted external URL and never stored. */
export function isInlineDataUrl(url: string): boolean {
  return /^data:[^;,]+;base64,/i.test(url);
}

function formatMib(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
