import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { addDays, todayKey, weekdayIndex } from "@rumo/core"

function nextOpenDay() {
  let day = addDays(todayKey(), 1)
  for (let index = 0; index < 8; index += 1) {
    const weekday = weekdayIndex(day)
    if (weekday >= 1 && weekday <= 5) return day
    day = addDays(day, 1)
  }
  return day
}

test("conflito de horário, faturamento e comissão por pessoa", async () => {
  process.env.RUMO_DB_PATH = path.join(mkdtempSync(path.join(os.tmpdir(), "rumo-")), "db.json")
  const { domain } = await import("./domain.ts")
  const { HttpError } = await import("./errors.ts")

  const owner = await domain.signup({ name: "Helena Costa", email: "helena@rumo.test", password: "segredo" })
  const ownerId = owner.session.user.id
  const session = await domain.createStore(ownerId, {
    name: "Casa Helena",
    vertical: "estetica",
    phone: "11999990000",
    address: "Rua das Flores, 10",
  })
  assert.equal(session.store?.vertical, "estetica")
  assert.equal(session.planCents, 3990)
  assert.ok(session.store?.inviteCode)

  const services = await domain.listServices(ownerId)
  const cleaning = services.find((service) => service.name === "Limpeza de pele")
  assert.ok(cleaning)
  const day = nextOpenDay()
  const slots = await domain.slots(ownerId, {
    professionalId: ownerId,
    day,
    serviceIds: cleaning.id,
  })
  assert.ok(slots.length >= 2)

  const first = await domain.createAppointment(ownerId, {
    professionalId: ownerId,
    serviceIds: [cleaning.id],
    startsAt: slots[0],
    clientName: "Marina Dias",
    clientPhone: "11988887777",
  })
  assert.equal(first.totalCents, 15000)
  assert.equal(first.commissionCents, 0)

  await assert.rejects(
    () => domain.createAppointment(ownerId, {
      professionalId: ownerId,
      serviceIds: [cleaning.id],
      startsAt: slots[0],
      clientName: "Outra Pessoa",
      clientPhone: "11977776666",
    }),
    (error: unknown) => error instanceof HttpError && error.status === 409,
  )

  await domain.setStatus(ownerId, first.id, { status: "completed", paymentMethod: "pix" })
  const ownerFinance = await domain.finance(ownerId, day)
  assert.equal(ownerFinance.day.realizedCents, 15000)
  assert.equal(ownerFinance.week.payableCents, 0)

  await domain.createProfessional(ownerId, {
    name: "Lia Nunes",
    email: "lia@rumo.test",
    password: "segredo",
    commissionType: "percent",
    commissionValue: 40,
  })
  const team = await domain.listTeam(ownerId)
  const lia = team.find((person) => person.email === "lia@rumo.test")
  assert.ok(lia)
  assert.equal(lia.commissionValue, 40)

  const liaLogin = await domain.login({ email: "lia@rumo.test", password: "segredo" })
  const liaId = liaLogin.session.user.id
  const liaSlots = await domain.slots(liaId, {
    professionalId: lia.id,
    day,
    serviceIds: cleaning.id,
  })
  const liaAppointment = await domain.createAppointment(liaId, {
    professionalId: lia.id,
    serviceIds: [cleaning.id],
    startsAt: liaSlots[0],
    clientName: "Caio Lima",
    clientPhone: "11966665555",
  })
  assert.equal(liaAppointment.commissionCents, 6000)
  await domain.setStatus(liaId, liaAppointment.id, { status: "completed", paymentMethod: "cash" })

  const after = await domain.finance(ownerId, day)
  assert.equal(after.day.realizedCents, 30000)
  assert.equal(after.week.payableCents, 6000)
  const liaRow = after.professionals.find((person) => person.id === lia.id)
  assert.equal(liaRow?.week.realizedCents, 15000)

  const liaFinance = await domain.finance(liaId, day)
  assert.equal(liaFinance.professionals.length, 1)
  assert.equal(liaFinance.week.realizedCents, 15000)
  assert.equal(liaFinance.week.payableCents, 6000)

  const free = slots.find((slot) => new Date(slot).getTime() >= new Date(first.endsAt).getTime())
  assert.ok(free)
  const booked = await domain.publicBook(session.store!.slug, {
    professionalId: ownerId,
    serviceIds: [cleaning.id],
    startsAt: free,
    clientName: "Cliente Web",
    clientPhone: "11955554444",
  })
  assert.equal(booked.source, "online")
  const storefront = await domain.publicStore(session.store!.slug)
  assert.equal(storefront?.store.inviteCode, null)
  assert.equal((await domain.finance(ownerId, day)).day.forecastCents, 15000)

  await domain.deleteAccount(liaId)
  await assert.rejects(
    () => domain.login({ email: "lia@rumo.test", password: "segredo" }),
    (error: unknown) => error instanceof HttpError && error.status === 401,
  )

  await domain.deleteAccount(ownerId)
  await assert.rejects(
    () => domain.login({ email: "helena@rumo.test", password: "segredo" }),
    (error: unknown) => error instanceof HttpError && error.status === 401,
  )
  assert.equal(await domain.publicStore(session.store!.slug), null)
})
