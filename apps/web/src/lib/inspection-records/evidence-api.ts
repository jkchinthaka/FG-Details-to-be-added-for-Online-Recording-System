import type { EvidencePhoto } from "@nelna/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export class EvidenceUploadApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "EvidenceUploadApiError";
    this.status = status;
    this.code = code;
  }
}

type UploadedAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
};

/** Translates a server error status/code into a clear, actionable message. */
function messageForFailure(
  status: number,
  code?: string,
  serverMessage?: string,
): string {
  switch (code) {
    case "FILE_TOO_LARGE":
      return "That file is too large. Each file must be 8 MB or smaller.";
    case "TOTAL_TOO_LARGE":
      return "The files are too large together. Keep the total under 32 MB.";
    case "TOO_MANY_FILES":
      return "Too many files. Attach at most 4 files.";
    case "DISALLOWED_EXTENSION":
    case "DISALLOWED_MIME":
    case "UNREADABLE_SIGNATURE":
    case "MIME_SPOOFED":
      return "That file type isn't accepted. Use a JPEG, PNG, WEBP, GIF or PDF.";
    default:
      break;
  }
  if (status === 401) return "Your session expired. Sign in again to upload evidence.";
  if (status === 403) return "You're not allowed to add evidence to this record.";
  if (status === 409)
    return "This record can no longer be edited, so evidence can't be added.";
  if (status === 0)
    return "The upload was interrupted. Check your connection and try again.";
  return serverMessage || "The upload failed. Please try again.";
}

/**
 * FG-FILE-001 — uploads evidence via the dedicated multipart endpoint using
 * XHR so we can report real progress. Files never enter a JSON payload.
 */
export function uploadEvidence(
  recordId: string,
  files: File[],
  options: {
    resultId?: string;
    evidenceType?: string;
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<EvidencePhoto[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file, file.name);
    }

    const params = new URLSearchParams({ recordId });
    if (options.resultId) params.set("resultId", options.resultId);
    if (options.evidenceType) params.set("evidenceType", options.evidenceType);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/evidence/upload?${params.toString()}`);
    xhr.withCredentials = true;
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onerror = () => reject(new EvidenceUploadApiError(0, messageForFailure(0)));
    xhr.onabort = () =>
      reject(new EvidenceUploadApiError(0, "The upload was cancelled."));

    xhr.onload = () => {
      const status = xhr.status;
      const body = (xhr.response ?? {}) as {
        attachments?: UploadedAttachment[];
        code?: string;
        message?: string;
      };
      if (status >= 200 && status < 300 && body.attachments) {
        resolve(
          body.attachments.map((a) => ({
            id: a.id,
            url: a.fileUrl,
            fileName: a.fileName,
            capturedAt: new Date().toISOString(),
          })),
        );
        return;
      }
      reject(
        new EvidenceUploadApiError(
          status,
          messageForFailure(status, body.code, body.message),
          body.code,
        ),
      );
    };

    if (options.signal) {
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}
