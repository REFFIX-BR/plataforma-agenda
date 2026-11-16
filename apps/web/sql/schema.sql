-- Agenda · schema inicial (snapshot JSONB)
-- Mantém o modelo atual do app e permite migrar depois para tabelas normalizadas.

CREATE TABLE IF NOT EXISTS agenda_snapshot (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO agenda_snapshot (id, payload)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
