/**
 * Transforms a PostgreSQL export JSON into MongoDB-ready documents with
 * old-ID → ObjectId maps. Does not write to any database.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { ObjectId } from "mongodb";

const IN = join(__dirname, "../../.tmp-migration/postgresql-export.json");
const OUT = join(__dirname, "../../.tmp-migration/mongodb-transformed.json");
const MAP_OUT = join(__dirname, "../../.tmp-migration/id-map.json");

type IdMap = Record<string, Record<string, string>>;

function mapId(
  map: IdMap,
  entity: string,
  oldId: string | null | undefined,
): string | null {
  if (!oldId) return null;
  if (!map[entity]) map[entity] = {};
  if (!map[entity][oldId]) {
    map[entity][oldId] = new ObjectId().toHexString();
  }
  return map[entity][oldId];
}

async function main() {
  if (!existsSync(IN)) {
    console.log(
      JSON.stringify({
        status: "SKIPPED",
        reason:
          "No postgresql-export.json — run export-postgresql.ts first or seed-only cutover",
      }),
    );
    return;
  }

  const raw = JSON.parse(readFileSync(IN, "utf8")) as {
    tables: Record<string, Array<Record<string, unknown>>>;
  };
  const map: IdMap = {};
  const collections: Record<string, unknown[]> = {};

  const transformUsers = (rows: Array<Record<string, unknown>>) =>
    rows.map((r) => ({
      _id: mapId(map, "User", String(r.id)),
      email: r.email,
      employeeCode: r.employeeCode,
      fullName: r.fullName,
      status: r.status,
      passwordHash: r.passwordHash,
      departmentId: mapId(map, "Department", r.departmentId as string | undefined),
      sectionId: mapId(map, "Section", r.sectionId as string | undefined),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

  // Minimal high-value transforms — extend when a live PostgreSQL export exists.
  collections.users = transformUsers(raw.tables.User ?? []);
  collections.roles = (raw.tables.Role ?? []).map((r) => ({
    _id: mapId(map, "Role", String(r.id)),
    name: r.name,
    description: r.description,
  }));
  collections.permissions = (raw.tables.Permission ?? []).map((r) => ({
    _id: mapId(map, "Permission", String(r.id)),
    key: r.key,
    description: r.description,
  }));

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ transformedAt: new Date().toISOString(), collections }),
  );
  writeFileSync(MAP_OUT, JSON.stringify(map, null, 2));
  console.log(
    JSON.stringify({
      status: "OK",
      collections: Object.fromEntries(
        Object.entries(collections).map(([k, v]) => [k, v.length]),
      ),
      mapPath: MAP_OUT,
      outPath: OUT,
    }),
  );
}

main().catch((err) => {
  console.error(String(err?.message ?? err).slice(0, 400));
  process.exit(1);
});
