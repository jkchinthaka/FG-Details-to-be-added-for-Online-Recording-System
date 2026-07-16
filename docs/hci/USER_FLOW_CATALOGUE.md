# User flow catalogue

| Role | Flow | Entry | Success |
| --- | --- | --- | --- |
| FG_OPERATOR | Create record | /records/new | Saved/submitted |
| FG_OPERATOR | Resume draft | /records | Continue editing |
| FG_SUPERVISOR | Check queue | /records/pending-check | Checked/rejected |
| QA_EXECUTIVE | Verify queue | /records/pending-verification | Verified/rejected |
| QA_EXECUTIVE / FSTL | Corrective action | /corrective-actions | Closed/escalated |
| AUDITOR | Reports / history | /reports | Export |
| SYSTEM_ADMINISTRATOR | Users / templates | /admin | Config published |
| Any (first login) | Password change | /change-password | Landing by role |

All flows require loading, empty, error, and success states.
