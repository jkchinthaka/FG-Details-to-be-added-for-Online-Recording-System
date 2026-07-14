-- Reconciliation count queries for Nelna FG Digital Recording System
-- Usage: psql "$DATABASE_URL" -f scripts/db/reconcile_counts.sql

SELECT 'User' AS metric, COUNT(*)::bigint AS count FROM "User"
UNION ALL SELECT 'ChecklistTemplate', COUNT(*) FROM "ChecklistTemplate"
UNION ALL SELECT 'ChecklistTemplateVersion', COUNT(*) FROM "ChecklistTemplateVersion"
UNION ALL SELECT 'InspectionRecord', COUNT(*) FROM "InspectionRecord"
UNION ALL SELECT 'InspectionResult', COUNT(*) FROM "InspectionResult"
UNION ALL SELECT 'ApprovalRecord', COUNT(*) FROM "ApprovalRecord"
UNION ALL SELECT 'CorrectiveAction', COUNT(*) FROM "CorrectiveAction"
UNION ALL SELECT 'AuditLog', COUNT(*) FROM "AuditLog"
UNION ALL SELECT 'InspectionAttachment', COUNT(*) FROM "InspectionAttachment"
UNION ALL SELECT 'TruckInspectionDetail', COUNT(*) FROM "TruckInspectionDetail"
ORDER BY 1;
