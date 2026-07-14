import { CorrectiveActionsService } from "./corrective-actions.service";

describe("CorrectiveActionsService transition guards", () => {
  const prisma = {
    correctiveAction: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new CorrectiveActionsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects self-verification when actor is assignee", async () => {
    prisma.correctiveAction.findUnique.mockResolvedValue({
      id: "ca-1",
      status: "PENDING_VERIFICATION",
      assignedToId: "user-a",
    });
    await expect(service.verify("ca-1", "Looks good", "user-a")).rejects.toThrow(
      /cannot verify their own/i,
    );
  });

  it("rejects complete without comment", async () => {
    prisma.correctiveAction.findUnique.mockResolvedValue({
      id: "ca-1",
      status: "IN_PROGRESS",
      assignedToId: "user-a",
    });
    await expect(service.complete("ca-1", "  ", "user-a")).rejects.toThrow(
      /completionComment/i,
    );
  });

  it("blocks invalid start transitions from CLOSED", async () => {
    prisma.correctiveAction.findUnique.mockResolvedValue({
      id: "ca-1",
      status: "CLOSED",
    });
    await expect(service.start("ca-1", "user-a")).rejects.toThrow(/Cannot start/i);
  });
});
