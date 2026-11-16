import assert from "node:assert/strict"
import test from "node:test"
import { summarize, summarizePayments } from "./finance"

test("separa realizado, previsto, comissão e falta", () => {
  const summary = summarize(
    [
      {
        startsAt: "2026-11-16T12:00:00.000Z",
        endsAt: "2026-11-16T13:00:00.000Z",
        status: "completed",
        role: "professional",
        totalCents: 10000,
        commissionCents: 5000,
      },
      {
        startsAt: "2026-11-16T14:00:00.000Z",
        endsAt: "2026-11-16T15:00:00.000Z",
        status: "completed",
        role: "owner",
        totalCents: 8000,
        commissionCents: 8000,
      },
      {
        startsAt: "2026-11-16T16:00:00.000Z",
        endsAt: "2026-11-16T17:00:00.000Z",
        status: "confirmed",
        role: "professional",
        totalCents: 4000,
        commissionCents: 2000,
      },
      {
        startsAt: "2026-11-16T18:00:00.000Z",
        endsAt: "2026-11-16T19:00:00.000Z",
        status: "no_show",
        role: "professional",
        totalCents: 4000,
        commissionCents: 0,
      },
      {
        startsAt: "2026-11-16T20:00:00.000Z",
        endsAt: "2026-11-16T21:00:00.000Z",
        status: "cancelled",
        role: "professional",
        totalCents: 9000,
        commissionCents: 0,
      },
    ],
    600,
  )

  assert.equal(summary.realizedCents, 22000)
  assert.equal(summary.forecastCents, 4000)
  assert.equal(summary.payableCents, 7000)
  assert.equal(summary.noShowCount, 1)
  assert.equal(summary.noShowRate, 1 / 3)
  assert.equal(summary.occupancy, 240 / 600)
})

test("soma pix, cartão e dinheiro sem cancelado", () => {
  const payments = summarizePayments([
    {
      startsAt: "2026-11-16T12:00:00.000Z",
      endsAt: "2026-11-16T13:00:00.000Z",
      status: "scheduled",
      role: "professional",
      totalCents: 10000,
      commissionCents: 5000,
      paymentMethod: "pix",
    },
    {
      startsAt: "2026-11-16T14:00:00.000Z",
      endsAt: "2026-11-16T15:00:00.000Z",
      status: "confirmed",
      role: "owner",
      totalCents: 8000,
      commissionCents: 0,
      paymentMethod: "card",
    },
    {
      startsAt: "2026-11-16T16:00:00.000Z",
      endsAt: "2026-11-16T17:00:00.000Z",
      status: "scheduled",
      role: "professional",
      totalCents: 4000,
      commissionCents: 2000,
      paymentMethod: "cash",
    },
    {
      startsAt: "2026-11-16T18:00:00.000Z",
      endsAt: "2026-11-16T19:00:00.000Z",
      status: "cancelled",
      role: "professional",
      totalCents: 9000,
      commissionCents: 0,
      paymentMethod: "pix",
    },
    {
      startsAt: "2026-11-16T20:00:00.000Z",
      endsAt: "2026-11-16T21:00:00.000Z",
      status: "scheduled",
      role: "professional",
      totalCents: 3000,
      commissionCents: 1500,
      paymentMethod: null,
    },
  ])
  assert.equal(payments.pixCents, 10000)
  assert.equal(payments.cardCents, 8000)
  assert.equal(payments.cashCents, 4000)
  assert.equal(payments.unsetCents, 3000)
})
