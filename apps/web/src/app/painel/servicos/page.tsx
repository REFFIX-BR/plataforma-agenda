"use client"

import { useSession } from "@/components/session"
import { api } from "@/lib/api"
import { formatBRL, reaisToCents, type Profession, type Service } from "@rumo/core"
import { verticalById } from "@rumo/theme"
import { useEffect, useState } from "react"

export default function ServicesPage() {
  const { session } = useSession()
  const theme = verticalById(session.store!.vertical)
  const [services, setServices] = useState<Service[]>([])
  const [professions, setProfessions] = useState<Profession[]>([])
  const [name, setName] = useState("")
  const [duration, setDuration] = useState("")
  const [price, setPrice] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [professionName, setProfessionName] = useState("")
  const [error, setError] = useState("")

  async function load() {
    const [nextServices, nextProfessions] = await Promise.all([
      api<Service[]>("/api/services"),
      api<Profession[]>("/api/professions"),
    ])
    setServices(nextServices)
    setProfessions(nextProfessions)
    const active = nextProfessions.filter((item) => item.active)
    setSelected((current) => {
      const kept = current.filter((id) => active.some((item) => item.id === id))
      if (kept.length > 0) return kept
      return active[0] ? [active[0].id] : []
    })
  }

  useEffect(() => { void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Falha ao carregar.")) }, [])

  async function createProfession(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    try {
      await api("/api/professions", { method: "POST", body: JSON.stringify({ name: professionName }) })
      setProfessionName("")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a profissão.")
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    try {
      await api("/api/services", {
        method: "POST",
        body: JSON.stringify({
          name,
          durationMin: Number(duration),
          priceCents: reaisToCents(Number(price.replace(",", "."))),
          professionIds: selected,
        }),
      })
      setName("")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    }
  }

  async function update(service: Service, change: Record<string, unknown>) {
    setError("")
    try {
      await api(`/api/services/${service.id}`, { method: "PATCH", body: JSON.stringify(change) })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    }
  }

  async function patchProfession(profession: Profession, change: Record<string, unknown>) {
    setError("")
    try {
      await api(`/api/professions/${profession.id}`, { method: "PATCH", body: JSON.stringify(change) })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    }
  }

  return (
    <div>
      <h1 className="text-4xl capitalize">{theme.labels.services}</h1>
      <p className="muted mt-2">Crie profissões (ex.: manicure) e ligue os serviços a elas. Depois, na Equipe, cada pessoa recebe uma profissão.</p>

      <form onSubmit={createProfession} className="card mt-4 grid gap-3 p-4 md:grid-cols-[1fr_auto]">
        <h2 className="text-2xl md:col-span-2">Profissões</h2>
        <label className="field">
          <span>Nova profissão</span>
          <input value={professionName} onChange={(event) => setProfessionName(event.target.value)} placeholder="Manicure, depilação..." required />
        </label>
        <button className="btn self-end">Criar</button>
        <div className="grid gap-2 md:col-span-2">
          {professions.length === 0 && <p className="muted text-sm">Nenhuma profissão ainda.</p>}
          {professions.map((profession) => (
            <div key={profession.id} className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="chip"
                data-active={profession.active}
                onClick={() => void patchProfession(profession, { active: !profession.active })}
                title={profession.active ? "Pausar" : "Reativar"}
              >
                {profession.name}{profession.active ? "" : " · pausada"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (!window.confirm(`Excluir a profissão ${profession.name}?`)) return
                  void api(`/api/professions/${profession.id}`, { method: "DELETE" })
                    .then(() => load())
                    .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível excluir."))
                }}
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      </form>

      <form onSubmit={create} className="card mt-4 grid gap-3 p-4 md:grid-cols-4">
        <h2 className="text-2xl md:col-span-4">Novo serviço</h2>
        <label className="field md:col-span-2"><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field"><span>Minutos</span><input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Tempo de duração" inputMode="numeric" required /></label>
        <label className="field"><span>Preço em reais</span><input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Preço" inputMode="decimal" required /></label>
        <div className="md:col-span-4">
          <p className="mb-2 text-sm font-medium">Profissões que fazem este serviço</p>
          <div className="flex flex-wrap gap-2">
            {professions.filter((item) => item.active).map((profession) => (
              <button
                key={profession.id}
                type="button"
                className="chip"
                data-active={selected.includes(profession.id)}
                onClick={() => setSelected((current) => current.includes(profession.id) ? current.filter((id) => id !== profession.id) : [...current, profession.id])}
              >
                {profession.name}
              </button>
            ))}
            {professions.filter((item) => item.active).length === 0 && (
              <p className="muted text-sm">Crie uma profissão acima antes de adicionar o serviço.</p>
            )}
          </div>
        </div>
        <button className="btn md:col-span-4" disabled={selected.length === 0}>Adicionar</button>
      </form>
      {error && <p className="alert mt-3" role="alert">{error}</p>}
      <div className="mt-4 grid gap-3">
        {services.map((service) => (
          <article key={service.id} className="card grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <strong>{service.name}</strong>
              <p className="muted text-sm">{service.durationMin} min · {formatBRL(service.priceCents)}{service.active ? "" : " · pausado"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {professions.map((profession) => (
                  <button
                    key={profession.id}
                    type="button"
                    className="chip"
                    data-active={service.professionIds.includes(profession.id)}
                    onClick={() => {
                      const professionIds = service.professionIds.includes(profession.id)
                        ? service.professionIds.filter((id) => id !== profession.id)
                        : [...service.professionIds, profession.id]
                      void update(service, { professionIds })
                    }}
                  >
                    {profession.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => void update(service, { active: !service.active })}>{service.active ? "Pausar" : "Reativar"}</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const value = window.prompt("Novo preço em reais", String(service.priceCents / 100))
                  if (!value) return
                  void update(service, { priceCents: reaisToCents(Number(value.replace(",", "."))) })
                }}
              >
                Preço
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
