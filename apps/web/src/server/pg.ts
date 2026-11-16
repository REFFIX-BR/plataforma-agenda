import fs from "node:fs"
import path from "node:path"
import { Pool, type PoolClient } from "pg"
import type { DB } from "./db"

let pool: Pool | null = null

export function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || ""
}

export function usingPostgres() {
  return Boolean(databaseUrl())
}

export function getPool() {
  const url = databaseUrl()
  if (!url) throw new Error("DATABASE_URL não configurada.")
  if (!pool) {
    const sslFlag = (process.env.DATABASE_SSL || "").toLowerCase()
    const ssl =
      sslFlag === "0" || sslFlag === "false" || sslFlag === "no"
        ? false
        : sslFlag === "1" || sslFlag === "true" || sslFlag === "require"
          ? { rejectUnauthorized: false }
          : undefined
    pool = new Pool({
      connectionString: url,
      ssl,
      max: 10,
    })
  }
  return pool
}

async function ensureSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS agenda_snapshot (
      id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)
  await client.query(`
    INSERT INTO agenda_snapshot (id, payload)
    VALUES (1, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `)
}

export async function loadFromPostgres(): Promise<Partial<DB>> {
  const client = await getPool().connect()
  try {
    await ensureSchema(client)
    const result = await client.query<{ payload: Partial<DB> | null }>(
      "SELECT payload FROM agenda_snapshot WHERE id = 1",
    )
    return result.rows[0]?.payload ?? {}
  } finally {
    client.release()
  }
}

export async function saveToPostgres(db: DB) {
  const client = await getPool().connect()
  try {
    await ensureSchema(client)
    await client.query("BEGIN")
    await client.query("SELECT id FROM agenda_snapshot WHERE id = 1 FOR UPDATE")
    await client.query(
      `INSERT INTO agenda_snapshot (id, payload, updated_at)
       VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE
       SET payload = EXCLUDED.payload, updated_at = now()`,
      [JSON.stringify(db)],
    )
    await client.query("COMMIT")
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      /* ignore */
    }
    throw error
  } finally {
    client.release()
  }
}

export async function pingPostgres() {
  const result = await getPool().query("SELECT 1 AS ok")
  return Number(result.rows[0]?.ok) === 1
}

export async function importJsonToPostgres(filePath: string, empty: DB) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8")) as Partial<DB>
  const db = { ...empty, ...parsed }
  await saveToPostgres(db)
  return {
    users: db.users.length,
    stores: db.stores.length,
    appointments: db.appointments.length,
  }
}
