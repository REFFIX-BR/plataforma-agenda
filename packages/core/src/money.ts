import type { CommissionType } from "./types"

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function formatPercent(ratio: number) {
  return `${Math.round(ratio * 100)}%`
}

export function commissionCents(priceCents: number, type: CommissionType, value: number) {
  if (type === "percent") return Math.round((priceCents * value) / 100)
  return Math.round(value)
}

export function reaisToCents(value: number) {
  return Math.round(value * 100)
}
