"use client"

import { useSession } from "@/components/session"
import { api } from "@/lib/api"
import {
  PAYMENT_LABEL,
  STATUS_LABEL,
  addDays,
  formatBRL,
  formatDay,
  formatTime,
  hmToMinutes,
  todayKey,
  weekStart,
  weekdayIndex,
  type AppointmentStatus,
  type AppointmentView,
  type BusinessHour,
  type PaymentMethod,
  type Service,
  type TeamMember,
} from "@rumo/core"
import { verticalById } from "@rumo/theme"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

function clockMinutes(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0)
}

function pad(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

export default function AgendaPage() {
  const { session } = useSession()
  const theme = verticalById(session.store!.vertical)
  const owner = session.profile!.role === "owner"
  const [day, setDay] = useState(todayKey())
  const [people, setPeople] = useState<TeamMember[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [items, setItems] = useState<AppointmentView[]>([])
  const [personFilter, setPersonFilter] = useState(session.profile!.id)
  const [statusFilter, setStatusFilter] = useState("all")
  const [composer, setComposer] = useState(false)
  const [selected, setSelected] = useState<AppointmentView | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const [nextPeople, nextServices, nextHours, nextItems] = await Promise.all([
      api<TeamMember[]>("/api/team"),
      api<Service[]>("/api/services"),
      api<BusinessHour[]>("/api/hours"),
      api<AppointmentView[]>(`/api/appointments?from=${day}&to=${day}`),
    ])
    setPeople(nextPeople)
    setServices(nextServices.filter((service) => service.active))
    setHours(nextHours)
    setItems(nextItems)
  }, [day])

  useEffect(() => {
    void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Falha ao carregar."))
  }, [load])

  useEffect(() => {
    const source = new EventSource("/api/stream")
    source.onmessage = () => { void load() }
    return () => source.close()
  }, [load])

  const visible = items.filter((item) => (personFilter === "all" || item.professionalId === personFilter) && (statusFilter === "all" || item.status === statusFilter))
  const columns = people.filter((person) => {
    if (personFilter !== "all") return person.id === personFilter
    return person.attends || visible.some((item) => item.professionalId === person.id)
  })
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart(day), index)), [day])

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="muted text-sm uppercase tracking-[0.16em]">{formatDay(day)}</p>
          <h1 className="text-4xl">Agenda</h1>
        </div>
        <button type="button" className="btn" onClick={() => setComposer(true)}>Novo horário</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" onClick={() => setDay(addDays(weekStart(day), -7))}>Semana anterior</button>
        <button type="button" className="btn-ghost" onClick={() => setDay(todayKey())}>Hoje</button>
        <button type="button" className="btn-ghost" onClick={() => setDay(addDays(weekStart(day), 7))}>Próxima</button>
      </div>
      <div className="mt-3 flex gap-2 overflow-auto">
        {week.map((item) => (
          <button key={item} type="button" className="chip" data-active={item === day} onClick={() => setDay(item)}>{formatDay(item)}</button>
        ))}
      </div>
      <div className="mt-3 flex gap-2 overflow-auto">
        {owner && <button type="button" className="chip" data-active={personFilter === "all"} onClick={() => setPersonFilter("all")}>Toda a equipe</button>}
        {people.filter((person) => owner || person.id === session.profile!.id).map((person) => (
          <button key={person.id} type="button" className="chip" data-active={personFilter === person.id} onClick={() => setPersonFilter(person.id)}>{person.fullName}</button>
        ))}
      </div>
      <div className="mt-3 flex gap-2 overflow-auto">
        <button type="button" className="chip" data-active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Todos os status</button>
        {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((status) => (
          <button key={status} type="button" className="chip" data-active={statusFilter === status} onClick={() => setStatusFilter(status)}>{STATUS_LABEL[status]}</button>
        ))}
      </div>
      {error && <p className="alert mt-3" role="alert">{error}</p>}
      <div className="mt-5 flex gap-3 overflow-auto pb-6">
        {columns.length === 0 && <p className="muted">Ninguém está recebendo horário neste filtro.</p>}
        {columns.map((person) => (
          <DayColumn
            key={person.id}
            name={person.fullName}
            hour={hours.find((item) => item.professionalId === person.id && item.weekday === weekdayIndex(day)) ?? hours.find((item) => item.professionalId === null && item.weekday === weekdayIndex(day))}
            items={visible.filter((item) => item.professionalId === person.id)}
            onOpen={setSelected}
          />
        ))}
      </div>
      {selected && (
        <StatusSheet
          item={selected}
          onClose={() => setSelected(null)}
          onChange={async () => { setSelected(null); await load() }}
        />
      )}
      {composer && (
        <Composer
          day={day}
          preferredId={personFilter === "all" ? session.profile!.id : personFilter}
          lockPerson={!owner || personFilter !== "all"}
          people={people.filter((person) => person.attends && (owner || person.id === session.profile!.id))}
          services={services}
          serviceLabel={theme.labels.service}
          professionalLabel={theme.labels.professional}
          onClose={() => setComposer(false)}
          onSaved={async () => { setComposer(false); await load() }}
        />
      )}
      <p className="muted text-sm">
        Link do cliente: <Link href={`/s/${session.store!.slug}`}>/s/{session.store!.slug}</Link>
      </p>
    </div>
  )
}

function DayColumn({
  name,
  hour,
  items,
  onOpen,
}: {
  name: string
  hour?: BusinessHour
  items: AppointmentView[]
  onOpen: (item: AppointmentView) => void
}) {
  const open = hour?.enabled ? hmToMinutes(hour.start) : 9 * 60
  const close = hour?.enabled ? hmToMinutes(hour.end) : 19 * 60
  const used = items.flatMap((item) => [clockMinutes(item.startsAt), clockMinutes(item.endsAt)])
  const start = Math.min(open, ...(used.length ? used : [open]))
  const end = Math.max(close, ...(used.length ? used : [close]))
  const scale = 1.15
  const height = Math.max(80, (end - start) * scale)

  return (
    <section className="card min-w-[240px] flex-1 p-3">
      <h2 className="text-xl">{name}</h2>
      {!hour?.enabled && <p className="muted text-sm">Fechado neste dia</p>}
      <div className="relative mt-6 ml-12" style={{ height }}>
        {Array.from({ length: Math.floor((end - start) / 60) + 1 }, (_, index) => (
          <div key={index} className="absolute right-0 left-0 border-t border-[var(--line)]" style={{ top: index * 60 * scale }}>
            <span className="muted absolute -left-12 -translate-y-1/2 text-xs">{pad(start + index * 60)}</span>
          </div>
        ))}
        {items.map((item) => {
          const top = (clockMinutes(item.startsAt) - start) * scale
          const block = Math.max(36, (clockMinutes(item.endsAt) - clockMinutes(item.startsAt)) * scale - 4)
          return (
            <button
              key={item.id}
              type="button"
              className="appt absolute"
              data-status={item.status}
              style={{ top, height: block }}
              onClick={() => onOpen(item)}
            >
              <strong className="block text-sm">{formatTime(item.startsAt)} {item.clientName}</strong>
              <span className="block truncate text-xs">{item.services.map((service) => service.name).join(", ")} · {STATUS_LABEL[item.status]}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Composer({
  day,
  preferredId,
  lockPerson,
  people,
  services,
  serviceLabel,
  professionalLabel,
  onClose,
  onSaved,
}: {
  day: string
  preferredId: string
  lockPerson: boolean
  people: TeamMember[]
  services: Service[]
  serviceLabel: string
  professionalLabel: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [professionalId, setProfessionalId] = useState(preferredId || people[0]?.id ?? "")
  const [date, setDate] = useState(day)
  const [slots, setSlots] = useState<string[]>([])
  const [startsAt, setStartsAt] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const roster = lockPerson ? people.filter((person) => person.id === preferredId) : people
  const eligible = roster.filter((person) => serviceIds.every((id) => services.find((service) => service.id === id)?.professionalIds.includes(person.id)))

  useEffect(() => {
    if (lockPerson) {
      setProfessionalId(preferredId)
      return
    }
    if (!eligible.some((person) => person.id === professionalId)) setProfessionalId(eligible[0]?.id ?? preferredId)
  }, [eligible, professionalId, lockPerson, preferredId])

  useEffect(() => {
    if (!professionalId || serviceIds.length === 0) {
      setSlots([])
      return
    }
    const params = new URLSearchParams({ professionalId, day: date, serviceIds: serviceIds.join(",") })
    api<string[]>(`/api/slots?${params}`)
      .then((next) => {
        setSlots(next)
        setStartsAt(next[0] ?? "")
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Sem horários."))
  }, [professionalId, date, serviceIds])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({ professionalId, serviceIds, startsAt, clientName, clientPhone, notes }),
      })
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível agendar.")
    } finally {
      setPending(false)
    }
  }

  function toggle(id: string) {
    setServiceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <form className="modal grid gap-3" onMouseDown={(event) => event.stopPropagation()} onSubmit={save}>
        <h2 className="text-3xl">Novo horário</h2>
        <div className="flex flex-wrap gap-2">
          {services.map((service) => (
            <button key={service.id} type="button" className="chip" data-active={serviceIds.includes(service.id)} onClick={() => toggle(service.id)}>
              {service.name} · {service.durationMin} min · {formatBRL(service.priceCents)}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{professionalLabel}</span>
          <select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} disabled={lockPerson}>
            {eligible.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
          </select>
        </label>
        <label className="field"><span>Dia</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
          {slots.length === 0 && <p className="muted text-sm">Escolha o {serviceLabel} para ver os horários livres.</p>}
          {slots.map((slot) => (
            <button key={slot} type="button" className="chip" data-active={startsAt === slot} onClick={() => setStartsAt(slot)}>{formatTime(slot)}</button>
          ))}
        </div>
        <label className="field"><span>Cliente</span><input value={clientName} onChange={(event) => setClientName(event.target.value)} required /></label>
        <label className="field"><span>Telefone</span><input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} required /></label>
        <label className="field"><span>Observação</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} /></label>
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="flex gap-2">
          <button className="btn" disabled={pending || !startsAt}>Guardar</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Fechar</button>
        </div>
      </form>
    </div>
  )
}

function StatusSheet({
  item,
  onClose,
  onChange,
}: {
  item: AppointmentView
  onClose: () => void
  onChange: () => Promise<void>
}) {
  const [payment, setPayment] = useState<PaymentMethod>(item.paymentMethod ?? "pix")
  const [error, setError] = useState("")

  async function update(status: AppointmentStatus) {
    setError("")
    try {
      await api(`/api/appointments/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, paymentMethod: status === "completed" ? payment : undefined }),
      })
      await onChange()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar.")
    }
  }

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal grid gap-3" onMouseDown={(event) => event.stopPropagation()}>
        <h2 className="text-3xl">{item.clientName}</h2>
        <p>{formatTime(item.startsAt)} – {formatTime(item.endsAt)}</p>
        <p>{item.professionalName} · {item.services.map((service) => service.name).join(", ")}</p>
        <p>{formatBRL(item.totalCents)} · {STATUS_LABEL[item.status]} · {item.source === "online" ? "Online" : "Manual"}</p>
        {item.clientPhone && <p className="muted">{item.clientPhone}</p>}
        {item.status === "cancelled" ? (
          <p>Cancelado</p>
        ) : (
          <>
            <label className="field">
              <span>Forma de pagamento</span>
              <select
                value={payment}
                onChange={(event) => {
                  const method = event.target.value as PaymentMethod
                  setPayment(method)
                  void api(`/api/appointments/${item.id}`, { method: "PATCH", body: JSON.stringify({ paymentMethod: method }) }).then(() => onChange()).catch((cause: unknown) => {
                    setError(cause instanceof Error ? cause.message : "Não foi possível salvar o pagamento.")
                  })
                }}
              >
                {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((method) => <option key={method} value={method}>{PAYMENT_LABEL[method]}</option>)}
              </select>
            </label>
            <button type="button" className="btn-danger" onClick={() => void update("cancelled")}>Cancelar horário</button>
          </>
        )}
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="button" className="btn-ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}
