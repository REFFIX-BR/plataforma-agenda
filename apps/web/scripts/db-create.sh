#!/usr/bin/env bash
# Cria o banco e as tabelas no servidor (psql).
# Uso:
#   chmod +x scripts/db-create.sh
#   ./scripts/db-create.sh
#   DATABASE_URL='postgres://user:senha@127.0.0.1:5432/agenda' ./scripts/db-create.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Defina DATABASE_URL no .env ou no ambiente."
  exit 1
fi

# Extrai nome do banco do path da URL
DB_NAME="$(node -e "const u=new URL(process.env.DATABASE_URL); const d=decodeURIComponent(u.pathname.replace(/^\//,'')); if(!d) process.exit(2); process.stdout.write(d)")"
ADMIN_URL="$(node -e "const u=new URL(process.env.DATABASE_URL); u.pathname='/postgres'; process.stdout.write(u.toString())")"

echo "Banco alvo: $DB_NAME"
EXISTS="$(psql "$ADMIN_URL" -Atc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" || true)"
if [[ "$EXISTS" != "1" ]]; then
  echo "Criando banco $DB_NAME..."
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DB_NAME\";"
else
  echo "Banco $DB_NAME já existe."
fi

echo "Aplicando sql/schema.sql..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/sql/schema.sql"
echo "Pronto."
