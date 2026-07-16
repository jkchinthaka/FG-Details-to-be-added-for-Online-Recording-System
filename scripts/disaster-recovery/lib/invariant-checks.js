/**
 * FG-DR-001 — relationship / invariant checks on fixture or live snapshots.
 */
"use strict";

/**
 * @param {{
 *   records: Array<{ id: string, templateVersionId?: string | null }>,
 *   templateVersions: Array<{ id: string }>,
 *   attachments: Array<{ id: string, recordId?: string | null, gridFsFileId?: string | null }>,
 *   approvals: Array<{ id: string, recordId?: string | null }>,
 *   results: Array<{ id: string, recordId?: string | null }>,
 *   correctiveActions: Array<{ id: string, recordId?: string | null, resultId?: string | null }>,
 *   users: Array<{ id: string }>,
 *   userRoles: Array<{ userId: string, roleId: string }>,
 *   roles: Array<{ id: string }>,
 *   templates: Array<{ id: string, currentVersionId?: string | null }>,
 *   auditLogs: Array<{ id: string, entityId?: string | null }>,
 * }} snap
 */
function checkInvariants(snap) {
  const versionIds = new Set(snap.templateVersions.map((v) => v.id));
  const recordIds = new Set(snap.records.map((r) => r.id));
  const resultIds = new Set(snap.results.map((r) => r.id));
  const userIds = new Set(snap.users.map((u) => u.id));
  const roleIds = new Set(snap.roles.map((r) => r.id));

  const failures = [];

  for (const record of snap.records) {
    if (record.templateVersionId && !versionIds.has(record.templateVersionId)) {
      failures.push({
        code: "RECORD_TEMPLATE_VERSION_MISSING",
        recordId: record.id,
        templateVersionId: record.templateVersionId,
      });
    }
  }

  for (const att of snap.attachments) {
    if (att.recordId && !recordIds.has(att.recordId)) {
      failures.push({
        code: "ATTACHMENT_RECORD_MISSING",
        attachmentId: att.id,
        recordId: att.recordId,
      });
    }
  }

  for (const approval of snap.approvals) {
    if (approval.recordId && !recordIds.has(approval.recordId)) {
      failures.push({
        code: "APPROVAL_RECORD_MISSING",
        approvalId: approval.id,
        recordId: approval.recordId,
      });
    }
  }

  for (const ca of snap.correctiveActions) {
    if (ca.recordId && !recordIds.has(ca.recordId)) {
      failures.push({
        code: "CA_RECORD_MISSING",
        correctiveActionId: ca.id,
        recordId: ca.recordId,
      });
    }
    if (ca.resultId && !resultIds.has(ca.resultId)) {
      failures.push({
        code: "CA_RESULT_MISSING",
        correctiveActionId: ca.id,
        resultId: ca.resultId,
      });
    }
  }

  for (const ur of snap.userRoles) {
    if (!userIds.has(ur.userId)) {
      failures.push({ code: "USER_ROLE_USER_MISSING", userId: ur.userId });
    }
    if (!roleIds.has(ur.roleId)) {
      failures.push({ code: "USER_ROLE_ROLE_MISSING", roleId: ur.roleId });
    }
  }

  for (const template of snap.templates) {
    if (template.currentVersionId && !versionIds.has(template.currentVersionId)) {
      failures.push({
        code: "TEMPLATE_CURRENT_VERSION_MISSING",
        templateId: template.id,
        currentVersionId: template.currentVersionId,
      });
    }
  }

  for (const result of snap.results) {
    if (result.recordId && !recordIds.has(result.recordId)) {
      failures.push({
        code: "RESULT_RECORD_MISSING",
        resultId: result.id,
        recordId: result.recordId,
      });
    }
  }

  // Audit entity refs are soft — only flag when entityId looks like a record id that is missing
  // when the audit set is small (fixture mode). Callers may ignore AUDIT_* in large prod samples.
  for (const audit of snap.auditLogs) {
    if (
      audit.entityId &&
      recordIds.size > 0 &&
      snap.auditLogs.length <= 20 &&
      !recordIds.has(audit.entityId) &&
      !versionIds.has(audit.entityId) &&
      !userIds.has(audit.entityId)
    ) {
      failures.push({
        code: "AUDIT_ENTITY_UNRESOLVED",
        auditId: audit.id,
        entityId: audit.entityId,
      });
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    summary:
      failures.length === 0
        ? "invariant checks PASS"
        : `invariant checks FAIL (${failures.length})`,
  };
}

module.exports = { checkInvariants };
