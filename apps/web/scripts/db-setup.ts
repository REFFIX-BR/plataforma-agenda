/**
 * Uso:
 *   npx tsx scripts/db-setup.ts
 *   npx tsx scripts/db-setup.ts --import data/db.json
 *
 * Precisa de DATABASE_URL no .env (ou no ambiente).
 */
import fs from "node:fs"
import path from "node:path"
import { emptyDb } from "../src/server/db"
import { getPool, importJsonToPostgres, pingPostgres, usingPostgres } from "../src/server/pg"

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

async function main() {
  loadEnvFile()
  if (!usingPostgres()) {
    console.error("Defina DATABASE_URL no .env, ex.:")
    console.error("DATABASE_URL=postgres://user:senha@host:5432/agenda")
    process.exit(1)
  }

  console.log("Conectando no Postgres...")
  const ok = await pingPostgres()
  if (!ok) throw new Error("Ping falhou.")
  console.log("Conexão ok.")

  // Garante schema via save/load
  const { loadFromPostgres, saveToPostgres } = await import("../src/server/pg")
  const current = await loadFromPostgres()
  const empty = !current.users?.length && !current.stores?.length
  console.log(empty ? "Snapshot vazio (schema pronto)." : `Snapshot com ${current.stores?.length ?? 0} loja(s).`)

  const importArgIndex = process.argv.indexOf("--import")
  if (importArgIndex >= 0) {
    const file = process.argv[importArgIndex + 1] || "data/db.json"
    console.log(`Importando ${file}...`)
    const stats = await importJsonToPostgres(file, emptyDb())
    console.log("Import concluído:", stats)
  } else if (empty) {
    // Mantém linha inicial
    await saveToPostgres(emptyDb())
    console.log("Snapshot inicial gravado.")
  }

  await getPool().end()
  console.log("Pronto.")
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error)
  try {
    await getPool().end()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
