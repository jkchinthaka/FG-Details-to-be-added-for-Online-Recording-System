import { AuditService } from "./audit.service";
import { AUDIT_ACTIONS } from "./audit.actions";
import type { PrismaService } from "../prisma/prisma.service";

describe("FG-AUD-001 AuditService", () => {
  it("appends redacted metadata and never stores secrets", async () => {
    const create = jest.fn().mockResolvedValue({ id: "a1" });
    const prisma = {
      auditLog: { create },
    } as unknown as PrismaService;
    const audit = new AuditService(prisma);

    await audit.append({
      actorId: "user-1",
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      entityType: "User",
      entityId: "user-1",
      requestId: "req-aaaaaaaa",
      ip: "127.0.0.1",
      before: { passwordHash: "$2b$12$abc", fullName: "A" },
      after: { password: "plain", fullName: "B" },
      metadata: { token: "should-not-persist", note: "ok" },
    });

    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0].data;
    expect(arg.action).toBe(AUDIT_ACTIONS.LOGIN_SUCCESS);
    const meta = JSON.stringify(arg.metadata);
    expect(meta).not.toMatch(/\$2b\$12\$abc|plain|should-not-persist/);
    expect(meta).toMatch(/REDACTED|req-aaaaaaaa|fullName/);
  });

  it("exposes coverage for required security actions", () => {
    const required = [
      "AUTH_LOGIN_SUCCESS",
      "AUTH_LOGIN_FAILURE",
      "AUTH_LOGOUT",
      "AUTH_PASSWORD_CHANGE",
      "REFRESH_TOKEN_REUSE_DETECTED",
      "EVIDENCE_UPLOAD",
      "REPORT_EXPORT",
      "SECURITY_POLICY_FAILURE",
    ];
    for (const action of required) {
      expect(Object.values(AUDIT_ACTIONS)).toContain(action);
    }
  });
});
