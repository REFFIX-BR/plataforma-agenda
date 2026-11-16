"use client"

import { useSession } from "@/components/session"
import { api } from "@/lib/api"
import { WEEKDAY_LABEL, dayKey, formatDay, formatTime, type BusinessHour, type TeamMember, type TimeBlock } from "@rumo/core"
import { useEffect, useState } from "react"

const emptyWeek = () => WEEKDAY_LABEL.map((_, weekday) => ({
  weekday,
  start: "06:00",
  end: "23:30",
  enabled: weekday >= 1 && weekday <= 6,
  professionalId: null as string | null,
}))

export default function HoursPage() {
  const { session } = useSession()
  const [people, setPeople] = useState<TeamMember[]>([])
  const [target, setTarget] = useState("")
  const [hours, setHours] = useState<BusinessHour[]>(emptyWeek())
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [date, setDate] = useState("")
  const [start, setStart] = useState("12:00")
  const [end, setEnd] = useState("13:00")
  const [blockPerson, setBlockPerson] = useState("")
  const [reason, setReason] = useState("Intervalo")
  const [error, setError] = useState("")

  useEffect(() => {
    void Promise.all([api<TeamMember[]>("/api/team"), api<BusinessHour[]>("/api/hours"), api<TimeBlock[]>("/api/blocks")])
      .then(([nextPeople, nextHours, nextBlocks]) => {
        setPeople(nextPeople)
        setBlocks(nextBlocks)
        apply(nextHours, "")
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Falha ao carregar."))
  }, [])

  function apply(all: BusinessHour[], professionalId: string) {
    const own = all.filter((hour) => hour.professionalId === (professionalId || null))
    const source = own.length === 7 ? own : all.filter((hour) => hour.professionalId === null)
    const next = emptyWeek().map((hour) => source.find((item) => item.weekday === hour.weekday) ?? hour)
    setHours(next.map((hour) => ({ ...hour, professionalId: professionalId || null })))
  }

  async function changeTarget(professionalId: string) {
    setTarget(professionalId)
    const all = await api<BusinessHour[]>("/api/hours")
    apply(all, professionalId)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    try {
      await api("/api/hours", {
        method: "PUT",
        body: JSON.stringify({
          professionalId: target || null,
          hours: hours.map((hour, weekday) => ({ weekday, start: hour.start, end: hour.end, enabled: hour.enabled })),
        }),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    }
  }

  async function clearCustom() {
    await api("/api/hours", { method: "PUT", body: JSON.stringify({ clear: true, professionalId: target }) })
    await changeTarget(target)
  }

  async function createBlock(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    try {
      await api("/api/blocks", {
        method: "POST",
        body: JSON.stringify({
          professionalId: blockPerson || null,
          startsAt: new Date(`${date}T${start}:00-03:00`).toISOString(),
          endsAt: new Date(`${date}T${end}:00-03:00`).toISOString(),
          reason,
        }),
      })
      setBlocks(await api<TimeBlock[]>("/api/blocks"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível bloquear.")
    }
  }

  async function removeBlock(id: string) {
    await api(`/api/blocks/${id}`, { method: "DELETE" })
    setBlocks(await api<TimeBlock[]>("/api/blocks"))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={save} className="card grid gap-3 p-4">
        <h1 className="text-4xl">Horários</h1>
        <label className="field">
          <span>De quem é esta grade</span>
          <select value={target} onChange={(event) => void changeTarget(event.target.value)}>
            <option value="">Casa inteira</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
          </select>
        </label>
        {hours.map((hour, index) => (
          <div key={hour.weekday} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
            <span>{WEEKDAY_LABEL[index]}</span>
            <input type="time" value={hour.start} onChange={(event) => setHours((current) => current.map((item) => item.weekday === hour.weekday ? { ...item, start: event.target.value } : item))} />
            <input type="time" value={hour.end} onChange={(event) => setHours((current) => current.map((item) => item.weekday === hour.weekday ? { ...item, end: event.target.value } : item))} />
            <label className="text-sm"><input type="checkbox" checked={hour.enabled} onChange={(event) => setHours((current) => current.map((item) => item.weekday === hour.weekday ? { ...item, enabled: event.target.checked } : item))} /> aberto</label>
          </div>
        ))}
        <div className="flex gap-2">
          <button className="btn">Salvar grade</button>
          {target && <button type="button" className="btn-ghost" onClick={() => void clearCustom()}>Voltar ao horário da casa</button>}
        </div>
      </form>
      <form onSubmit={createBlock} className="card grid content-start gap-3 p-4">
        <h2 className="text-2xl">Bloqueios e folgas</h2>
        <label className="field"><span>Dia</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="field"><span>Começa</span><input type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></label>
          <label className="field"><span>Termina</span><input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></label>
        </div>
        <label className="field">
          <span>Quem</span>
          <select value={blockPerson} onChange={(event) => setBlockPerson(event.target.value)}>
            <option value="">Casa inteira</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
          </select>
        </label>
        <label className="field"><span>Motivo</span><input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <button className="btn">Bloquear</button>
        <div className="grid gap-2">
          {blocks.map((block) => (
            <div key={block.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{formatDay(dayKey(block.startsAt))} {formatTime(block.startsAt)}–{formatTime(block.endsAt)} · {block.reason || "Bloqueio"} · {people.find((person) => person.id === block.professionalId)?.fullName ?? "Casa"}</span>
              <button type="button" className="btn-ghost" onClick={() => void removeBlock(block.id)}>Remover</button>
            </div>
          ))}
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
        <p className="muted text-sm">A casa de {session.store!.name} usa o fuso de Brasília.</p>
      </form>
    </div>
  )
}
