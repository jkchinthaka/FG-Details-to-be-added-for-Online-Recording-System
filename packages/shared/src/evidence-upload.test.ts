import { describe, expect, it } from "vitest";
import {
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_MAX_TOTAL_BYTES,
  assertWithinFileCount,
  assertWithinTotalSize,
  detectEvidenceSignature,
  isInlineDataUrl,
  isManagedEvidenceUrl,
  normalizeEvidenceFileName,
  validateEvidenceCandidate,
} from "./evidence-upload";

const JPEG_HEAD = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_HEAD = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const GIF_HEAD = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP_HEAD = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const EXE_HEAD = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);

describe("detectEvidenceSignature", () => {
  it("detects each supported type by magic bytes", () => {
    expect(detectEvidenceSignature(JPEG_HEAD)).toBe("image/jpeg");
    expect(detectEvidenceSignature(PNG_HEAD)).toBe("image/png");
    expect(detectEvidenceSignature(PDF_HEAD)).toBe("application/pdf");
    expect(detectEvidenceSignature(GIF_HEAD)).toBe("image/gif");
    expect(detectEvidenceSignature(WEBP_HEAD)).toBe("image/webp");
  });

  it("returns null for unknown/executable content", () => {
    expect(detectEvidenceSignature(EXE_HEAD)).toBeNull();
    expect(detectEvidenceSignature(new Uint8Array([0x00]))).toBeNull();
  });
});

describe("normalizeEvidenceFileName", () => {
  it("strips directory traversal and separators", () => {
    expect(normalizeEvidenceFileName("../../etc/passwd.png")).toBe("passwd.png");
    expect(normalizeEvidenceFileName("C:\\Windows\\evil.jpg")).toBe("evil.jpg");
  });

  it("removes control characters and reserved glyphs", () => {
    expect(normalizeEvidenceFileName("re:po?rt*.pdf")).toBe("re_po_rt_.pdf");
  });

  it("falls back for empty / dot-only names", () => {
    expect(normalizeEvidenceFileName("")).toBe("evidence.bin");
    expect(normalizeEvidenceFileName("...")).toBe("evidence.bin");
  });

  it("bounds the length", () => {
    const long = `${"a".repeat(500)}.png`;
    expect(normalizeEvidenceFileName(long).length).toBeLessThanOrEqual(180);
  });
});

describe("validateEvidenceCandidate", () => {
  it("accepts a genuine JPEG", () => {
    const result = validateEvidenceCandidate({
      fileName: "photo.jpg",
      claimedMime: "image/jpeg",
      sizeBytes: 1024,
      head: JPEG_HEAD,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.detectedMime).toBe("image/jpeg");
      expect(result.fileName).toBe("photo.jpg");
    }
  });

  it("accepts a genuine PDF", () => {
    const result = validateEvidenceCandidate({
      fileName: "scan.pdf",
      claimedMime: "application/pdf",
      sizeBytes: 2048,
      head: PDF_HEAD,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a renamed executable (bad signature)", () => {
    const result = validateEvidenceCandidate({
      fileName: "malware.png",
      claimedMime: "image/png",
      sizeBytes: 4096,
      head: EXE_HEAD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNREADABLE_SIGNATURE");
  });

  it("rejects MIME spoofing where extension disagrees with real content", () => {
    const result = validateEvidenceCandidate({
      fileName: "photo.png",
      claimedMime: "image/png",
      sizeBytes: 4096,
      head: JPEG_HEAD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MIME_SPOOFED");
  });

  it("rejects an allowed-but-mismatched declared MIME as spoofing", () => {
    const result = validateEvidenceCandidate({
      fileName: "photo.jpg",
      claimedMime: "application/pdf",
      sizeBytes: 4096,
      head: JPEG_HEAD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MIME_SPOOFED");
  });

  it("rejects a disallowed declared MIME", () => {
    const result = validateEvidenceCandidate({
      fileName: "photo.jpg",
      claimedMime: "application/x-msdownload",
      sizeBytes: 4096,
      head: JPEG_HEAD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DISALLOWED_MIME");
  });

  it("rejects disallowed extensions", () => {
    const result = validateEvidenceCandidate({
      fileName: "notes.txt",
      claimedMime: "text/plain",
      sizeBytes: 10,
      head: JPEG_HEAD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DISALLOWED_EXTENSION");
  });

  it("rejects empty files", () => {
    const result = validateEvidenceCandidate({
      fileName: "photo.jpg",
      claimedMime: "image/jpeg",
      sizeBytes: 0,
      head: JPEG_HEAD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("EMPTY_FILE");
  });

  it("rejects oversized files", () => {
    const result = validateEvidenceCandidate({
      fileName: "photo.jpg",
      claimedMime: "image/jpeg",
      sizeBytes: EVIDENCE_MAX_FILE_BYTES + 1,
      head: JPEG_HEAD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FILE_TOO_LARGE");
  });
});

describe("aggregate limits", () => {
  it("flags too many files", () => {
    expect(assertWithinFileCount(EVIDENCE_MAX_FILES)).toBeNull();
    expect(assertWithinFileCount(EVIDENCE_MAX_FILES + 1)?.code).toBe("TOO_MANY_FILES");
  });

  it("flags total size overflow", () => {
    expect(assertWithinTotalSize(EVIDENCE_MAX_TOTAL_BYTES)).toBeNull();
    expect(assertWithinTotalSize(EVIDENCE_MAX_TOTAL_BYTES + 1)?.code).toBe(
      "TOTAL_TOO_LARGE",
    );
  });
});

describe("url classification", () => {
  it("recognises managed evidence references", () => {
    expect(isManagedEvidenceUrl("/evidence/abc123/download")).toBe(true);
    expect(isManagedEvidenceUrl("https://evil.example/x")).toBe(false);
    expect(isManagedEvidenceUrl("/evidence/../download")).toBe(false);
  });

  it("recognises inline data URLs only", () => {
    expect(isInlineDataUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isInlineDataUrl("https://evil.example/x.png")).toBe(false);
    expect(isInlineDataUrl("ftp://host/x")).toBe(false);
  });
});
