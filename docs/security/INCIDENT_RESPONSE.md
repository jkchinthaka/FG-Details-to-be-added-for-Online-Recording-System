# Incident Response Runbook

This is an operational starting point, not a replacement for the organization's legal, HR, food-safety, or regulatory obligations.

## Trigger examples

- Suspected stolen credentials, session cookie, or lost device.
- Unauthorized record view/edit, approval, or audit-log anomaly.
- Exposed JWT/database secret or committed `.env` file.
- Malicious or inappropriate evidence image.
- Suspected data loss, ransomware, or backup compromise.
- Dependency or infrastructure advisory affecting a deployed version.

## First hour

1. Open an incident record with time, reporter, affected system/environment, and incident lead.
2. Preserve available evidence: request IDs, relevant audit records, deployment revision, identity-provider/proxy logs, and database backup identifiers. Do not copy passwords, raw cookies, or evidence data URLs into tickets.
3. Contain safely:
   - Disable the affected user account when account compromise is suspected.
   - Revoke affected refresh-token rows; rotate JWT signing secrets when token-signing exposure is credible, understanding this invalidates all sessions.
   - Restrict the affected endpoint or deployment only when necessary to stop ongoing harm.
   - Isolate a lost or compromised device through device-management controls.
4. Notify the platform owner, data owner, and security contact. Engage legal/HR/food-safety owners when policy or regulation requires it.

## Investigation and recovery

- Determine affected accounts, records, attachments, approvals, timestamps, IP/user-agent metadata, and deployment versions.
- Compare audit events and database records with backups; preserve immutable copies where available.
- Reset affected credentials and re-enable accounts only after verification.
- Remove exposed secrets from deployment configuration, rotate them, and invalidate sessions where appropriate.
- Quarantine suspicious evidence. The current application has no malware scanner; use approved endpoint/storage scanning tools outside the application.
- Restore data only from a known-good backup and validate record/audit integrity before reopening workflows.

## Communications

- Keep updates factual: what is known, what is being investigated, the containment status, and next update time.
- Do not disclose employee data, credentials, session identifiers, or raw evidence in broad channels.
- The data owner and legal function determine whether affected individuals, customers, partners, or authorities require notification and within which deadlines.

## Post-incident

Within five business days of containment, document root cause, impact, timeline, detection gaps, actions taken, owner, and due dates. Convert relevant fixes into tracked engineering work and update the threat model/test evidence. Conduct a restoration or session-revocation exercise after material changes.

## Contacts to assign before production

| Role | Named contact | Responsibility |
| --- | --- | --- |
| Incident lead | Unassigned | Coordinates response and decisions |
| Platform owner | Unassigned | Deployments, secrets, backups, access |
| Data owner | Unassigned | Retention, notifications, data handling |
| Security contact | Unassigned | Triage and remediation oversight |
| Food safety / QA owner | Unassigned | Record integrity and operational impact |
