"use client"

import { ThemeScope } from "@/components/theme-scope"
import { api } from "@/lib/api"
import { WEEKDAY_LABEL, formatBRL, formatTime, weekdayIndex, type PublicStorefront } from "@rumo/core"
import { verticalById } from "@rumo/theme"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const [storefront, setStorefront] = useState<PublicStorefront | null>(null)
  const [missing, setMissing] = useState(false)
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [professionalId, setProfessionalId] = useState("")
  const [day, setDay] = useState("")
  const [slots, setSlots] = useState<string[]>([])
  const [startsAt, setStartsAt] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [done, setDone] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void api<PublicStorefront>(`/api/public/${slug}`)
      .then(setStorefront)
      .catch(() => setMissing(true))
  }, [slug])

  useEffect(() => {
    const source = new EventSource(`/api/stream?slug=${slug}`)
    source.onmessage = () => {
      if (!professionalId || !day || serviceIds.length === 0) return
      const query = new URLSearchParams({ professionalId, day, serviceIds: serviceIds.join(",") })
      void api<string[]>(`/api/public/${slug}/slots?${query}`).then(setSlots).catch(() => undefined)
    }
    return () => source.close()
  }, [slug, professionalId, day, serviceIds])

  const theme = storefront ? verticalById(storefront.store.vertical) : null
  const eligible = useMemo(() => {
    if (!storefront) return []
    return storefront.professionals.filter((person) =>
      serviceIds.every((id) => storefront.services.find((service) => service.id === id)?.professionalIds.includes(person.id)),
    )
  }, [storefront, serviceIds])

  useEffect(() => {
    if (!eligible.some((person) => person.id === professionalId)) setProfessionalId(eligible[0]?.id ?? "")
  }, [eligible, professionalId])

  useEffect(() => {
    if (!professionalId || !day || serviceIds.length === 0) {
      setSlots([])
      return
    }
    const query = new URLSearchParams({ professionalId, day, serviceIds: serviceIds.join(",") })
    void api<string[]>(`/api/public/${slug}/slots?${query}`)
      .then((next) => { setSlots(next); setStartsAt(next[0] ?? "") })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Sem horários."))
  }, [slug, professionalId, day, serviceIds])

  async function book(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const created = await api<{ startsAt: string }>(`/api/public/${slug}/book`, {
        method: "POST",
        body: JSON.stringify({ professionalId, serviceIds, startsAt, clientName, clientPhone }),
      })
      setDone(created.startsAt)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível reservar.")
    } finally {
      setPending(false)
    }
  }

  if (missing) return <ThemeScope className="min-h-screen p-8">Não encontrei essa casa.</ThemeScope>
  if (!storefront || !theme) return <ThemeScope className="min-h-screen p-8">Abrindo a agenda...</ThemeScope>

  const closed = day ? !storefront.hours.some((hour) => hour.professionalId === null && hour.weekday === weekdayIndex(day) && hour.enabled) : false

  return (
    <ThemeScope vertical={storefront.store.vertical} brandColor={storefront.store.brandColor} unified className="min-h-screen">
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="muted text-sm uppercase tracking-[0.16em]">{theme.label}</p>
        <h1 className="mt-2 text-5xl">{storefront.store.name}</h1>
        <p className="muted mt-2">{storefront.store.address} {storefront.store.phone}</p>
        {done ? (
          <section className="card mt-8 p-5">
            <h2 className="text-3xl">Horário reservado</h2>
            <p className="mt-2">Te esperamos às {formatTime(done)}. Se precisar mudar, fale direto com a casa.</p>
          </section>
        ) : (
          <form onSubmit={book} className="mt-8 grid gap-4">
            <section>
              <h2 className="text-2xl capitalize">{theme.labels.services}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {storefront.services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    className="chip"
                    data-active={serviceIds.includes(service.id)}
                    onClick={() => setServiceIds((current) => current.includes(service.id) ? current.filter((id) => id !== service.id) : [...current, service.id])}
                  >
                    {service.name} · {service.durationMin} min · {formatBRL(service.priceCents)}
                  </button>
                ))}
              </div>
            </section>
            <label className="field">
              <span className="capitalize">{theme.labels.professional}</span>
              <select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
                {eligible.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
              </select>
            </label>
            <label className="field"><span>Dia</span><input type="date" value={day} onChange={(event) => setDay(event.target.value)} required /></label>
            {closed && <p className="muted">A casa fecha neste dia.</p>}
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button key={slot} type="button" className="chip" data-active={startsAt === slot} onClick={() => setStartsAt(slot)}>{formatTime(slot)}</button>
              ))}
            </div>
            <label className="field"><span>Seu nome</span><input value={clientName} onChange={(event) => setClientName(event.target.value)} required /></label>
            <label className="field"><span>Seu telefone</span><input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} required /></label>
            {error && <p className="alert" role="alert">{error}</p>}
            <button className="btn" disabled={pending || !startsAt}>Reservar</button>
            <p className="muted text-sm">
              Funcionamento: {storefront.hours.filter((hour) => hour.professionalId === null && hour.enabled).map((hour) => `${WEEKDAY_LABEL[hour.weekday].slice(0, 3)} ${hour.start}–${hour.end}`).join(" · ")}
            </p>
          </form>
        )}
      </main>
    </ThemeScope>
  )
}
