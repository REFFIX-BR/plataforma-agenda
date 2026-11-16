"use client"

import { useSession } from "@/components/session"
import { api } from "@/lib/api"
import { dayKey, formatBRL, formatDay, type ClientRecord } from "@rumo/core"
import { verticalById } from "@rumo/theme"
import { useEffect, useState } from "react"

export default function ClientsPage() {
  const { session } = useSession()
  const theme = verticalById(session.store!.vertical)
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    void api<ClientRecord[]>("/api/clients")
      .then(setClients)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Falha ao carregar."))
  }, [])

  return (
    <div>
      <h1 className="text-4xl capitalize">{theme.labels.clients}</h1>
      <p className="muted mt-2">{session.profile!.role === "owner"
        ? `Cada ${theme.labels.professional} tem a própria lista. Você vê todas. Um ${theme.labels.professional} não vê os clientes do outro.`
        : `Só os seus clientes. Outro ${theme.labels.professional} da loja não vê esta lista.`}</p>
      {error && <p className="alert mt-3" role="alert">{error}</p>}
      <div className="mt-4 grid gap-2">
        {clients.map((client) => (
          <article key={client.id} className="card flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <strong>{client.name}</strong>
              <p className="muted text-sm">{session.profile!.role === "owner" && client.professionalName ? `${client.professionalName} · ` : ""}{client.phone || "Sem telefone"}{client.lastVisit ? ` · última visita ${formatDay(dayKey(client.lastVisit))}` : ""}</p>
            </div>
            <p className="text-sm">{client.visits} visita(s) · {formatBRL(client.spentCents)}</p>
          </article>
        ))}
        {clients.length === 0 && <p className="muted">Ainda não há {theme.labels.clients} por aqui.</p>}
      </div>
    </div>
  )
}
