/**
 * Cria o banco Postgres (se não existir) e aplica as tabelas.
 *
 * Uso (em apps/web):
 *   npm run db:create
 *   npm run db:create -- --import data/db.json
 *
 * Precisa de DATABASE_URL no .env, ex.:
 *   DATABASE_URL=postgres://usuario:senha@127.0.0.1:5432/agenda
 *   DATABASE_SSL=0
 */
import fs from "node:fs"
import path from "node:path"
import { Client } from "pg"
import { emptyDb } from "../src/server/db"

type ParsedUrl = {
  protocol: string
  user: string
  password: string
  host: string
  port: string
  database: string
  search: string
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env")
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

function sslOption() {
  const sslFlag = (process.env.DATABASE_SSL || "").toLowerCase()
  if (sslFlag === "0" || sslFlag === "false" || sslFlag === "no") return false
  if (sslFlag === "1" || sslFlag === "true" || sslFlag === "require") {
    return { rejectUnauthorized: false as const }
  }
  return undefined
}

function parseDatabaseUrl(raw: string): ParsedUrl {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("DATABASE_URL inválida. Ex.: postgres://user:senha@host:5432/agenda")
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, "")).trim()
  if (!database) {
    throw new Error("DATABASE_URL precisa do nome do banco no final, ex.: .../agenda")
  }
  return {
    protocol: url.protocol,
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    host: url.hostname || "127.0.0.1",
    port: url.port || "5432",
    database,
    search: url.search || "",
  }
}

function buildUrl(parts: ParsedUrl, database: string) {
  const auth =
    parts.user || parts.password
      ? `${encodeURIComponent(parts.user)}:${encodeURIComponent(parts.password)}@`
      : ""
  return `${parts.protocol}//${auth}${parts.host}:${parts.port}/${encodeURIComponent(database)}${parts.search}`
}

function quoteIdent(name: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Nome de banco inválido: ${name}`)
  }
  return `"${name}"`
}

async function ensureDatabase(parts: ParsedUrl) {
  const adminCandidates = ["postgres", "template1"]
  let lastError: unknown

  for (const adminDb of adminCandidates) {
    const client = new Client({
      connectionString: buildUrl(parts, adminDb),
      ssl: sslOption(),
    })
    try {
      await client.connect()
      const exists = await client.query<{ exists: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
        [parts.database],
      )
      if (exists.rows[0]?.exists) {
        console.log(`Banco "${parts.database}" já existe.`)
      } else {
        console.log(`Criando banco "${parts.database}"...`)
        await client.query(`CREATE DATABASE ${quoteIdent(parts.database)}`)
        console.log(`Banco "${parts.database}" criado.`)
      }
      await client.end()
      return
    } catch (error) {
      lastError = error
      try {
        await client.end()
      } catch {
        /* ignore */
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Não foi possível conectar no Postgres admin (postgres/template1).")
}

async function applySchema(connectionString: string) {
  const schemaPath = path.join(process.cwd(), "sql", "schema.sql")
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Arquivo não encontrado: ${schemaPath}`)
  }
  const sql = fs.readFileSync(schemaPath, "utf8")
  const client = new Client({ connectionString, ssl: sslOption() })
  await client.connect()
  try {
    console.log("Aplicando sql/schema.sql...")
    await client.query(sql)
    const tables = await client.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename`,
    )
    console.log("Tabelas em public:", tables.rows.map((r) => r.tablename).join(", ") || "(nenhuma)")
  } finally {
    await client.end()
  }
}

async function maybeImport(connectionString: string) {
  const importArgIndex = process.argv.indexOf("--import")
  if (importArgIndex < 0) return

  const file = process.argv[importArgIndex + 1] || "data/db.json"
  const absolute = path.isAbsolute(file) ? file : path.join(process.cwd(), file)
  if (!fs.existsSync(absolute)) {
    throw new Error(`Arquivo de importação não encontrado: ${absolute}`)
  }

  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8")) as Record<string, unknown>
  const db = { ...emptyDb(), ...parsed }
  const client = new Client({ connectionString, ssl: sslOption() })
  await client.connect()
  try {
    console.log(`Importando ${absolute}...`)
    await client.query(
      `INSERT INTO agenda_snapshot (id, payload, updated_at)
       VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE
       SET payload = EXCLUDED.payload, updated_at = now()`,
      [JSON.stringify(db)],
    )
    console.log("Import ok:", {
      users: Array.isArray(db.users) ? db.users.length : 0,
      stores: Array.isArray(db.stores) ? db.stores.length : 0,
      appointments: Array.isArray(db.appointments) ? db.appointments.length : 0,
    })
  } finally {
    await client.end()
  }
}

async function main() {
  loadEnvFile()
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    console.error("Defina DATABASE_URL no apps/web/.env, ex.:")
    console.error("DATABASE_URL=postgres://usuario:senha@127.0.0.1:5432/agenda")
    console.error("DATABASE_SSL=0")
    process.exit(1)
  }

  const parts = parseDatabaseUrl(raw)
  console.log(`Host: ${parts.host}:${parts.port}`)
  console.log(`Banco alvo: ${parts.database}`)

  await ensureDatabase(parts)
  const appUrl = buildUrl(parts, parts.database)
  await applySchema(appUrl)
  await maybeImport(appUrl)

  console.log("Pronto. Banco e tabelas ok.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
