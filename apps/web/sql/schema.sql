-- Agenda · schema inicial (snapshot JSONB)
-- Mantém o modelo atual do app. Depois dá para normalizar em tabelas.

CREATE TABLE IF NOT EXISTS agenda_snapshot (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_snapshot_updated_at_idx
  ON agenda_snapshot (updated_at DESC);

INSERT INTO agenda_snapshot (id, payload)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
