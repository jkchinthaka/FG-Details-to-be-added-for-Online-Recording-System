# MongoDB GridFS Evidence Storage

How inspection photo evidence is stored after the MongoDB cutover.

## Bucket

| Setting | Value |
|---------|--------|
| Bucket name | `fgEvidence` |
| Service | `GridFsEvidenceService` (`apps/api/src/evidence/gridfs-evidence.service.ts`) |
| Module | `EvidenceModule` (exported; imported by `InspectionRecordsModule`) |

## Save path (inspection records)

On draft/submit when a checklist response includes `evidence` photos:

1. `deleteMany` attachments for that `resultId` (existing behaviour).
2. For each photo **in a loop** (not `createMany`):
   - If `url` is a `data:...;base64,...` URL → decode to `Buffer`, call `GridFsEvidenceService.upload`.
   - Create `InspectionAttachment` with `gridFsFileId`, `contentSha256`, `storedFileName`, MIME/size from upload, `uploadedById`.
   - Temporary `fileUrl` = `gridfs://{gridFsFileId}`, then update to `/evidence/{attachmentId}/download`.
   - Non-data-URL values keep a legacy create without GridFS upload.

Helpers: `decodeDataUrlToBuffer`, `parseDataUrlMimeType`, `isDataUrl` in `inspection-records.mappers.ts`.

## Download path

- `GET /evidence/:attachmentId/download` (authenticated, permission-checked).
- Streams from GridFS using `gridFsFileId` on the attachment row.

## Limits / MIME

- Max size: 8 MiB
- Allowed: JPEG, PNG, WebP, GIF, PDF (magic-byte check preferred over client claim)

## Metadata on `InspectionAttachment`

| Field | Role |
|-------|------|
| `gridFsFileId` | ObjectId string in `fgEvidence.files` |
| `gridFsBucket` | Defaults to `fgEvidence` |
| `contentSha256` | SHA-256 of bytes |
| `storedFileName` | GridFS filename |
| `fileUrl` | App path for authorized download |
| `retentionStatus` | e.g. `ACTIVE` |

## Security notes

- Binaries are not returned from public static paths.
- Download requires `records:read` plus owner/manager checks in `EvidenceController`.
- Never log `DATABASE_URL` or GridFS credentials.
