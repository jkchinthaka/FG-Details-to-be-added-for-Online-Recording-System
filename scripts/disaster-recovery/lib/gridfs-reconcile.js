/**
 * FG-DR-001 — GridFS reconciliation (files/chunks/metadata links).
 * Works on in-memory fixtures or live snapshots; never prints binary content.
 */
"use strict";

const crypto = require("crypto");

/**
 * @typedef {object} GridFsFileMeta
 * @property {string} id
 * @property {number} [length]
 * @property {string} [md5]
 * @property {string} [sha256]
 */

/**
 * @typedef {object} AttachmentRef
 * @property {string} id
 * @property {string | null | undefined} gridFsFileId
 */

/**
 * @param {{
 *   files: GridFsFileMeta[],
 *   chunks: Array<{ files_id: string }>,
 *   attachments: AttachmentRef[],
 *   correctiveEvidence?: AttachmentRef[],
 *   sampledDownloads?: Array<{ id: string, sha256: string }>,
 *   expectedSampleHashes?: Record<string, string>,
 * }} input
 */
function reconcileGridFs(input) {
  const {
    files,
    chunks,
    attachments,
    correctiveEvidence = [],
    sampledDownloads = [],
    expectedSampleHashes = {},
  } = input;

  const fileIds = new Set(files.map((f) => String(f.id)));
  const chunkFileIds = new Set(chunks.map((c) => String(c.files_id)));

  const referenced = new Set();
  for (const row of [...attachments, ...correctiveEvidence]) {
    if (row.gridFsFileId) referenced.add(String(row.gridFsFileId));
  }

  const orphanBinaries = [...fileIds].filter((id) => !referenced.has(id));
  const missingBinaries = [...referenced].filter((id) => !fileIds.has(id));

  const filesWithoutChunks = [...fileIds].filter((id) => !chunkFileIds.has(id));
  const orphanChunks = [...chunkFileIds].filter((id) => !fileIds.has(id));

  const sampleFailures = [];
  for (const sample of sampledDownloads) {
    const expected = expectedSampleHashes[sample.id];
    if (expected && expected !== sample.sha256) {
      sampleFailures.push({ id: sample.id, expected, actual: sample.sha256 });
    }
  }

  const ok =
    orphanBinaries.length === 0 &&
    missingBinaries.length === 0 &&
    filesWithoutChunks.length === 0 &&
    orphanChunks.length === 0 &&
    sampleFailures.length === 0;

  return {
    ok,
    filesCount: files.length,
    chunksCount: chunks.length,
    referencedCount: referenced.size,
    orphanBinaries,
    missingBinaries,
    filesWithoutChunks,
    orphanChunks,
    sampleFailures,
    summary: ok ? "gridfs reconciliation PASS" : "gridfs reconciliation FAIL",
  };
}

/**
 * Hash a Buffer without exposing content.
 * @param {Buffer} buf
 */
function hashBuffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

module.exports = {
  reconcileGridFs,
  hashBuffer,
};
