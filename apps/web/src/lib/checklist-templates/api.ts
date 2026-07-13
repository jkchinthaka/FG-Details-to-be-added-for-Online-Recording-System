import type { ChecklistTemplateSummary, ChecklistTemplateVersionDefinition } from "@nelna/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ChecklistTemplateApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ChecklistTemplateApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  } catch {
    throw new ChecklistTemplateApiError(0, "Could not reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Non-JSON error body — fall back to the generic message above.
    }
    throw new ChecklistTemplateApiError(response.status, message);
  }

  return (await response.json()) as T;
}

/** Every template with at least one published version — the set an operator can record against. */
export function fetchPublishedTemplates(): Promise<ChecklistTemplateSummary[]> {
  return apiFetch<ChecklistTemplateSummary[]>("/checklist-templates/published");
}

/** A template's current published version, with full section/item content. */
export function fetchPublishedVersion(code: string): Promise<ChecklistTemplateVersionDefinition> {
  return apiFetch<ChecklistTemplateVersionDefinition>(
    `/checklist-templates/${encodeURIComponent(code)}/published`,
  );
}

/** All templates including drafts — requires templates:manage or templates:publish (admin). */
export function fetchAllTemplates(): Promise<ChecklistTemplateSummary[]> {
  return apiFetch<ChecklistTemplateSummary[]>("/checklist-templates");
}

/** A template's metadata and version history — requires templates:manage or templates:publish (admin). */
export function fetchTemplateSummary(code: string): Promise<ChecklistTemplateSummary> {
  return apiFetch<ChecklistTemplateSummary>(`/checklist-templates/${encodeURIComponent(code)}`);
}

/** A specific version by number — drafts require templates:manage or templates:publish. */
export function fetchTemplateVersion(
  code: string,
  versionNumber: number,
): Promise<ChecklistTemplateVersionDefinition> {
  return apiFetch<ChecklistTemplateVersionDefinition>(
    `/checklist-templates/${encodeURIComponent(code)}/versions/${versionNumber}`,
  );
}
