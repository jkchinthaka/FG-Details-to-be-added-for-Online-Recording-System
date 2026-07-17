import { Logger } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma-client";
import type { PrismaService } from "../prisma/prisma.service";
import type { RequestMeta } from "./auth.service";

const logger = new Logger("RefreshTokenFamily");

const MAX_USER_AGENT_LEN = 500;
const MAX_IP_LEN = 45;

export type StoredRefreshToken = {
  id: string;
  userId: string;
  familyId: string;
  sessionId: string;
  consumedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

/** Bounds request metadata so we never store unbounded UA/IP strings. */
export function boundRequestMeta(meta: RequestMeta = {}): {
  userAgent?: string;
  ipAddress?: string;
} {
  const userAgent = meta.userAgent?.trim().slice(0, MAX_USER_AGENT_LEN);
  const ipAddress = meta.ip?.trim().slice(0, MAX_IP_LEN);
  return {
    ...(userAgent ? { userAgent } : {}),
    ...(ipAddress ? { ipAddress } : {}),
  };
}

/**
 * Prisma MongoDB treats missing optional fields differently from explicit
 * `null`. Fresh refresh-token rows historically omitted consumedAt/revokedAt,
 * so `field: null` alone does not match. Accept either form.
 */
export function mongoNullOrUnset(
  field: "consumedAt" | "revokedAt",
): Prisma.RefreshTokenWhereInput {
  return {
    OR: [{ [field]: null }, { [field]: { isSet: false } }],
  } as Prisma.RefreshTokenWhereInput;
}

/**
 * Atomically consume a refresh token for rotation. Exactly one concurrent
 * caller may succeed; losers receive count=0 and must not proceed.
 */
export async function claimRefreshTokenForRotation(
  prisma: PrismaService,
  tokenId: string,
): Promise<{ claimed: boolean }> {
  const result = await prisma.refreshToken.updateMany({
    where: {
      id: tokenId,
      AND: [
        mongoNullOrUnset("consumedAt"),
        mongoNullOrUnset("revokedAt"),
        { expiresAt: { gt: new Date() } },
      ],
    },
    data: { consumedAt: new Date() },
  });
  return { claimed: result.count === 1 };
}

/**
 * Compromise containment: revoke every still-active token in the family,
 * bump authVersion, and record a security audit event. Never logs or stores
 * raw tokens or hashes.
 */
export async function revokeFamilyForReuse(
  prisma: PrismaService,
  stored: StoredRefreshToken,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: {
        familyId: stored.familyId,
        AND: [mongoNullOrUnset("revokedAt")],
      },
      data: { revokedAt: now, reuseDetectedAt: now },
    }),
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { reuseDetectedAt: now },
    }),
    prisma.user.update({
      where: { id: stored.userId },
      data: { authVersion: { increment: 1 } },
    }),
    prisma.auditLog.create({
      data: {
        actorId: stored.userId,
        action: "REFRESH_TOKEN_REUSE_DETECTED",
        entityType: "RefreshTokenFamily",
        entityId: stored.familyId,
        metadata: {
          sessionId: stored.sessionId,
        } satisfies Prisma.InputJsonValue as Prisma.InputJsonValue,
      },
    }),
  ]);

  logger.warn({
    event: "refresh_token_reuse_detected",
    userId: stored.userId,
    familyId: stored.familyId,
    sessionId: stored.sessionId,
  });
}

/** Revokes every active token in a family (session logout / admin revoke). */
export async function revokeRefreshTokenFamily(
  prisma: PrismaService,
  familyId: string,
  userId: string,
): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: {
      familyId,
      userId,
      AND: [mongoNullOrUnset("revokedAt")],
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
