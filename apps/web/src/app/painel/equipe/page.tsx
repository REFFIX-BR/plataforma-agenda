"use client"

import { useSession } from "@/components/session"
import { api } from "@/lib/api"
import { formatBRL, type Profession, type TeamMember } from "@rumo/core"
import { BRAND_COLORS, inkOn, verticalById } from "@rumo/theme"
import { useEffect, useState } from "react"

export default function TeamPage() {
  const { session, reload } = useSession()
  const theme = verticalById(session.store!.vertical)
  const chosen = (session.store!.brandColor ?? theme.colors.primary).toLowerCase()
  const [people, setPeople] = useState<TeamMember[]>([])
  const [professions, setProfessions] = useState<Profession[]>([])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [professionId, setProfessionId] = useState("")
  const [commissionType, setCommissionType] = useState<"percent" | "fixed">("percent")
  const [commissionValue, setCommissionValue] = useState("50")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editProfessionId, setEditProfessionId] = useState("")
  const [editCommission, setEditCommission] = useState("50")

  async function load() {
    const [nextPeople, nextProfessions] = await Promise.all([
      api<TeamMember[]>("/api/team"),
      api<Profession[]>("/api/professions"),
    ])
    setPeople(nextPeople)
    setProfessions(nextProfessions)
    const active = nextProfessions.filter((item) => item.active)
    setProfessionId((current) => active.some((item) => item.id === current) ? current : active[0]?.id ?? "")
  }

  useEffect(() => { void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Falha ao carregar.")) }, [])

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await api("/api/team", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          professionId: professionId || null,
          commissionType,
          commissionValue: Number(commissionValue),
          attends: true,
        }),
      })
      setName(""); setEmail(""); setPassword("")
      await load()
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar.")
    } finally {
      setPending(false)
    }
  }

  async function patch(person: TeamMember, change: Record<string, unknown>) {
    setError("")
    try {
      await api(`/api/team/${person.id}`, { method: "PATCH", body: JSON.stringify(change) })
      await load()
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    }
  }

  function openEdit(person: TeamMember) {
    setEditId(person.id)
    setEditName(person.fullName)
    setEditEmail(person.email)
    setEditPassword("")
    setEditProfessionId(person.professionId ?? "")
    setEditCommission(person.commissionType === "percent" ? String(person.commissionValue) : String(person.commissionValue / 100))
    setError("")
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editId) return
    setPending(true)
    setError("")
    try {
      await api(`/api/team/${editId}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editName,
          email: editEmail,
          ...(editPassword.trim() ? { password: editPassword } : {}),
          professionId: editProfessionId || null,
          commissionType: "percent",
          commissionValue: Number(editCommission.replace(",", ".")),
        }),
      })
      setEditId(null)
      setEditPassword("")
      await load()
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    } finally {
      setPending(false)
    }
  }

  async function copy() {
    if (session.store?.inviteCode) await navigator.clipboard.writeText(session.store.inviteCode)
  }

  return (
    <div>
      <h1 className="text-4xl">Equipe</h1>
      <p className="muted mt-2">Cada {theme.labels.professional} ativo soma {formatBRL(session.store!.seatPriceCents)} no plano. Quem administra já está incluso.</p>
      <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
      <section className="card mt-4 p-4">
        <p className="text-sm font-semibold tracking-wide">COR DO APP</p>
        <p className="muted mt-1 text-sm">A agenda continua com a mesma cara. Essa cor aparece para você e para quem atende.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {BRAND_COLORS.map((item) => {
            const active = chosen === item.hex
            return (
              <button
                key={item.hex}
                type="button"
                aria-label={item.name}
                aria-pressed={active}
                className="grid h-11 w-11 place-items-center rounded-full"
                style={{ background: item.hex, outline: active ? "3px solid var(--ink)" : "none", outlineOffset: 2 }}
                onClick={() => {
                  if (active) return
                  void api("/api/store", { method: "PATCH", body: JSON.stringify({ brandColor: item.hex }) })
                    .then(() => reload())
                    .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível mudar a cor."))
                }}
              >
                {active && <span style={{ color: inkOn(item.hex) }}>✓</span>}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-sm">{BRAND_COLORS.find((item) => item.hex === chosen)?.name ?? "Cor da casa"}</p>
      </section>
        <div>
          <p className="muted text-sm">Código para a pessoa entrar sozinha</p>
          <p className="serif text-3xl tracking-[0.2em]">{session.store!.inviteCode}</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void copy()}>Copiar código</button>
      </div>
      <form onSubmit={create} className="card mt-4 grid gap-3 p-4 md:grid-cols-2">
        <h2 className="text-2xl md:col-span-2">Novo {theme.labels.professional}</h2>
        <label className="field"><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="field"><span>Senha inicial</span><input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></label>
        <label className="field">
          <span>Profissão</span>
          <select value={professionId} onChange={(event) => setProfessionId(event.target.value)} required={professions.some((item) => item.active)}>
            <option value="">Escolha</option>
            {professions.filter((item) => item.active).map((profession) => (
              <option key={profession.id} value={profession.id}>{profession.name}</option>
            ))}
          </select>
        </label>
        <label className="field md:col-span-2">
          <span>Comissão</span>
          <div className="flex gap-2">
            <select value={commissionType} onChange={(event) => setCommissionType(event.target.value as "percent" | "fixed")}>
              <option value="percent">Porcentagem</option>
              <option value="fixed">Valor fixo por horário</option>
            </select>
            <input value={commissionValue} onChange={(event) => setCommissionValue(event.target.value)} inputMode="decimal" required />
          </div>
        </label>
        <p className="muted text-sm md:col-span-2">As profissões e os serviços ficam em Serviços. Aqui você só liga a pessoa à profissão.</p>
        <p className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-3 text-sm font-semibold md:col-span-2">
          Esta conta adiciona {formatBRL(session.store!.seatPriceCents)} na próxima mensalidade.
        </p>
        <button className="btn md:col-span-2" disabled={pending}>Cadastrar</button>
      </form>
      {error && <p className="alert mt-3" role="alert">{error}</p>}
      <div className="mt-4 grid gap-3">
        {people.map((person) => {
          const profession = professions.find((item) => item.id === person.professionId)
          return (
            <article key={person.id} className="card grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <strong>{person.fullName}</strong>
                <p className="muted text-sm">{person.email} · {person.role === "owner" ? "administração" : theme.labels.professional}</p>
                <p className="text-sm">
                  Profissão: {profession?.name ?? "sem profissão"}
                  {" · "}
                  Comissão: {person.commissionType === "percent" ? `${person.commissionValue}%` : formatBRL(person.commissionValue)}
                  {person.attends ? " · recebe horário" : " · não aparece na agenda pública"}
                  {person.active ? "" : " · inativo"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {professions.filter((item) => item.active).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="chip"
                      data-active={person.professionId === item.id}
                      onClick={() => void patch(person, { professionId: item.id })}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
              {person.role === "professional" && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost" onClick={() => openEdit(person)}>Editar conta</button>
                  <button type="button" className="btn-ghost" onClick={() => void patch(person, { attends: !person.attends })}>{person.attends ? "Tirar da agenda" : "Colocar na agenda"}</button>
                  <button type="button" className="btn-ghost" onClick={() => void patch(person, { active: !person.active })}>{person.active ? "Desativar" : "Reativar"}</button>
                </div>
              )}
              {editId === person.id && (
                <form onSubmit={saveEdit} className="grid gap-3 border-t border-[var(--line)] pt-3 md:col-span-2 md:grid-cols-2">
                  <label className="field"><span>Nome</span><input value={editName} onChange={(event) => setEditName(event.target.value)} required /></label>
                  <label className="field"><span>E-mail</span><input type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required /></label>
                  <label className="field"><span>Nova senha</span><input value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder="Em branco para manter" minLength={6} /></label>
                  <label className="field">
                    <span>Profissão</span>
                    <select value={editProfessionId} onChange={(event) => setEditProfessionId(event.target.value)}>
                      <option value="">Sem profissão</option>
                      {professions.filter((item) => item.active).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field"><span>Comissão %</span><input value={editCommission} onChange={(event) => setEditCommission(event.target.value)} inputMode="decimal" required /></label>
                  <div className="flex flex-wrap gap-2 self-end">
                    <button className="btn" disabled={pending}>Salvar</button>
                    <button type="button" className="btn-ghost" onClick={() => setEditId(null)}>Cancelar</button>
                  </div>
                </form>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
