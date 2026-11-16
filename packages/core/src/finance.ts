import type { AppointmentStatus, PaymentBreakdown, PaymentMethod, Role, Summary } from "./types"
import { minutesBetween } from "./time"

export type FinanceAppointment = {
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  role: Role
  totalCents: number
  commissionCents: number
  paymentMethod?: PaymentMethod | null
}

export function emptyPayments(): PaymentBreakdown {
  return { pixCents: 0, cashCents: 0, cardCents: 0, unsetCents: 0 }
}

export function summarizePayments(items: FinanceAppointment[]): PaymentBreakdown {
  const out = emptyPayments()
  for (const item of items) {
    if (item.status === "cancelled" || item.status === "no_show") continue
    if (item.paymentMethod === "pix") out.pixCents += item.totalCents
    else if (item.paymentMethod === "cash") out.cashCents += item.totalCents
    else if (item.paymentMethod === "card") out.cardCents += item.totalCents
    else out.unsetCents += item.totalCents
  }
  return out
}

const FORECAST = new Set<AppointmentStatus>(["scheduled", "confirmed", "in_progress"])

export function emptySummary(): Summary {
  return {
    realizedCents: 0,
    forecastCents: 0,
    payableCents: 0,
    occupancy: 0,
    noShowRate: 0,
    completedCount: 0,
    noShowCount: 0,
    appointmentCount: 0,
  }
}

export function summarize(items: FinanceAppointment[], openMinutes: number): Summary {
  const earns = items.filter((item) => item.status !== "cancelled" && item.status !== "no_show")
  const completed = items.filter((item) => item.status === "completed")
  const upcoming = items.filter((item) => FORECAST.has(item.status))
  const noShow = items.filter((item) => item.status === "no_show")
  const active = items.filter((item) => item.status !== "cancelled")
  const denom = completed.length + noShow.length
  const bookedMinutes = active.reduce((sum, item) => sum + minutesBetween(item.startsAt, item.endsAt), 0)
  return {
    realizedCents: earns.reduce((sum, item) => sum + item.totalCents, 0),
    forecastCents: upcoming.reduce((sum, item) => sum + item.totalCents, 0),
    payableCents: earns
      .filter((item) => item.role === "professional")
      .reduce((sum, item) => sum + item.commissionCents, 0),
    occupancy: openMinutes <= 0 ? 0 : bookedMinutes / openMinutes,
    noShowRate: denom === 0 ? 0 : noShow.length / denom,
    completedCount: completed.length,
    noShowCount: noShow.length,
    appointmentCount: items.length,
  }
}
