/**
 * Safe MongoDB connectivity diagnostic.
 *
 * Usage:
 *   pnpm --filter @nelna/api db:diagnose
 *
 * Never prints DATABASE_URL, credentials, or full hostnames from driver errors.
 */
import { MongoClient } from "mongodb";
import {
  assertProductionDatabaseName,
  redactDatabaseErrorMessage,
  summarizeDatabaseUrl,
} from "../src/database/diagnose-database-rules";

const CONNECT_TIMEOUT_MS = 12_000;

async function main(): Promise<void> {
  const started = Date.now();
  const summary = summarizeDatabaseUrl(process.env.DATABASE_URL);

  console.log(`provider=${summary.provider}`);
  console.log(`usesSrv=${summary.usesSrv}`);
  console.log(`databaseName=${summary.databaseName ?? "none"}`);
  console.log(`isProductionDatabase=${summary.isProductionDatabase}`);

  if (process.env.NELNA_REQUIRE_PRODUCTION_DB === "true") {
    assertProductionDatabaseName(summary.databaseName);
  }

  const url = process.env.DATABASE_URL!.trim();
  const client = new MongoClient(url, {
    serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
    connectTimeoutMS: CONNECT_TIMEOUT_MS,
  });

  let dnsOk = false;
  let tlsOk = false;
  let pingOk = false;
  let replicaOk = false;

  try {
    await client.connect();
    dnsOk = true;
    tlsOk = true;

    const ping = await client.db(summary.databaseName ?? undefined).command({ ping: 1 });
    pingOk = ping?.ok === 1;

    try {
      const admin = client.db().admin();
      const status = await admin.command({ hello: 1 });
      replicaOk = Boolean(
        status?.isWritablePrimary || status?.primary || status?.ok === 1,
      );
    } catch {
      replicaOk = false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`error=${redactDatabaseErrorMessage(message)}`);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => undefined);
  }

  const elapsedMs = Date.now() - started;
  console.log(`dnsResolution=${dnsOk ? "ok" : "fail"}`);
  console.log(`tlsConnection=${tlsOk ? "ok" : "fail"}`);
  console.log(`mongoPing=${pingOk ? "ok" : "fail"}`);
  console.log(`replicaSetAvailability=${replicaOk ? "ok" : "fail"}`);
  console.log(`elapsedMs=${elapsedMs}`);

  if (!pingOk) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redactDatabaseErrorMessage(message));
  process.exit(1);
});
