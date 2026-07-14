-- Enforce the application invariant that an inspection result can open one
-- corrective action at most. Existing production data must be deduplicated
-- before applying this migration if it contains multiple actions per result.
CREATE UNIQUE INDEX "CorrectiveAction_resultId_key" ON "CorrectiveAction"("resultId");
