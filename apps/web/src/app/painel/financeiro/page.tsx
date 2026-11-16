"use client"

import { useSession } from "@/components/session"
import { api } from "@/lib/api"
import {
  STATUS_LABEL,
  addDays,
  dayKey,
  formatBRL,
  formatDay,
  formatPercent,
  formatTime,
  todayKey,
  type FinanceReport,
  type PaymentBreakdown,
} from "@rumo/core"
import { verticalById } from "@rumo/theme"
import { useEffect, useState } from "react"

export default function FinancePage() {
  const { session } = useSession()
  const theme = verticalById(session.store!.vertical)
  const owner = session.profile!.role === "owner"
  const [anchor, setAnchor] = useState(todayKey())
  const [report, setReport] = useState<FinanceReport | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    void api<FinanceReport>(`/api/finance?anchor=${anchor}`)
      .then(setReport)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Falha ao calcular."))
  }, [anchor])

  useEffect(() => {
    const source = new EventSource("/api/stream")
    source.onmessage = () => {
      void api<FinanceReport>(`/api/finance?anchor=${anchor}`).then(setReport).catch(() => undefined)
    }
    return () => source.close()
  }, [anchor])

  const max = Math.max(1, ...(report?.professionals.map((person) => person.week.realizedCents) ?? [1]))

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="muted text-sm uppercase tracking-[0.16em]">{owner ? "A casa" : "Sua semana"}</p>
          <h1 className="text-4xl">Faturamento</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => setAnchor(addDays(report?.weekStart ?? anchor, -7))}>Semana anterior</button>
          <button type="button" className="btn-ghost" onClick={() => setAnchor(todayKey())}>Esta semana</button>
          <button type="button" className="btn-ghost" onClick={() => setAnchor(addDays(report?.weekStart ?? anchor, 7))}>Próxima</button>
        </div>
      </div>
      {owner && (
        <p className="card mt-4 p-4 text-sm">
          Plano {formatBRL(session.store!.basePriceCents)} + {session.seatCount} atendente{session.seatCount === 1 ? "" : "s"} × {formatBRL(session.store!.seatPriceCents)} = <strong>{formatBRL(session.planCents)}</strong> por mês. A assinatura Asaas fica no app em Menu → Plano.
        </p>
      )}
      {error && <p className="alert mt-3" role="alert">{error}</p>}
      {report && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label={`Na agenda em ${formatDay(report.anchor)}`} value={formatBRL(report.day.realizedCents)} hint="cancelado não entra" />
            <Stat label="Na semana" value={formatBRL(report.week.realizedCents)} hint={`${formatDay(report.weekStart)} em diante`} />
            <Stat label="No mês" value={formatBRL(report.month.realizedCents)} hint="soma da casa neste mês" />
            <Stat label="Ainda vai acontecer" value={formatBRL(report.week.forecastCents)} hint="já está dentro do total da semana" />
            <Stat label="Ocupação da semana" value={formatPercent(Math.min(report.week.occupancy, 1))} hint="horário ocupado sobre a grade" />
            <Stat label="Faltas" value={formatPercent(report.week.noShowRate)} hint={`${report.week.noShowCount} falta(s) entre os encerrados`} />
            <Stat label={owner ? "A repassar na semana" : "Sua comissão na semana"} value={formatBRL(report.week.payableCents)} hint="sai só se o horário for cancelado" />
          </div>
          {owner && (
            <section className="card mt-4 p-4">
              <h2 className="text-2xl">Formas de pagamento</h2>
              <p className="muted mt-1 text-sm">Quanto entrou nesta semana por Pix, cartão e dinheiro.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Pix" value={formatBRL(report.weekPayments.pixCents)} hint="semana" />
                <Stat label="Cartão" value={formatBRL(report.weekPayments.cardCents)} hint="crédito ou débito" />
                <Stat label="Dinheiro" value={formatBRL(report.weekPayments.cashCents)} hint="semana" />
                {report.weekPayments.unsetCents > 0 && (
                  <Stat label="Sem forma" value={formatBRL(report.weekPayments.unsetCents)} hint="ainda sem marcar" />
                )}
              </div>
            </section>
          )}
          <section className="card mt-4 p-4">
            <h2 className="text-2xl">Semana por {theme.labels.professional}</h2>
            <div className="mt-4 grid gap-4">
              {report.professionals.map((person) => (
                <div key={person.id} className="grid gap-2">
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span>{person.name}{person.role === "owner" ? " · administração" : ""}</span>
                    <span>{formatBRL(person.week.realizedCents)}{person.role === "professional" ? ` · comissão ${formatBRL(person.week.payableCents)}` : ""}</span>
                  </div>
                  <div className="bar"><span style={{ width: `${(person.week.realizedCents / max) * 100}%`, background: "var(--primary)" }} /></div>
                  {owner && <PaymentRow payments={person.weekPayments} />}
                  {(person.weekServices?.length ?? 0) > 0 && (
                    <div className="grid gap-1 rounded-2xl border border-[var(--line)] p-3 text-sm">
                      {person.weekServices.map((service) => (
                        <div key={service.name} className="flex justify-between gap-3">
                          <span>{service.name} · {service.count}×{person.role === "professional" ? ` · comissão ${formatBRL(service.payableCents)}` : ""}</span>
                          <strong>{formatBRL(service.totalCents)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="mt-4 grid gap-2">
            {report.appointments.map((item) => (
              <article key={item.id} className="card flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <strong>{formatDay(dayKey(item.startsAt))} · {formatTime(item.startsAt)} · {item.clientName}</strong>
                  <p className="muted text-sm">{item.professionalName} · {item.services.map((service) => service.name).join(", ")} · {STATUS_LABEL[item.status]}</p>
                </div>
                <strong>{formatBRL(item.totalCents)}</strong>
              </article>
            ))}
            {report.appointments.length === 0 && <p className="muted">Nenhum agendamento nesta semana.</p>}
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="card p-4">
      <p className="muted text-sm">{label}</p>
      <p className="serif mt-1 text-3xl">{value}</p>
      <p className="muted mt-1 text-sm">{hint}</p>
    </article>
  )
}

function PaymentRow({ payments }: { payments: PaymentBreakdown }) {
  const parts = [
    payments.pixCents > 0 ? `Pix ${formatBRL(payments.pixCents)}` : null,
    payments.cardCents > 0 ? `Cartão ${formatBRL(payments.cardCents)}` : null,
    payments.cashCents > 0 ? `Dinheiro ${formatBRL(payments.cashCents)}` : null,
    payments.unsetCents > 0 ? `Sem forma ${formatBRL(payments.unsetCents)}` : null,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return <p className="muted text-sm">{parts.join(" · ")}</p>
}
