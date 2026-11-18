import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import {
  addDays,
  buildSlots,
  commissionCents,
  dayKey,
  formatClock,
  hmToMinutes,
  monthStart,
  nextMonth,
  rangesOverlap,
  repeatDays,
  summarize,
  todayKey,
  weekStart,
  weekdayIndex,
  zonedDateTime,
  type AppointmentView,
  type BillingAccess,
  type BillingSnapshot,
  type BusinessHour,
  type SessionBilling,
  type ClientRecord,
  type CommissionType,
  type FinanceReport,
  type PaymentBreakdown,
  type PaymentMethod,
  type Profession,
  type PublicStorefront,
  type RepeatUnit,
  type Service,
  type ServiceBreakdown,
  type SessionState,
  type TeamMember,
  summarizePayments,
} from "@rumo/core"
import { defaultProfessionName, isVerticalId, normalizeBrandColor, planCents, verticals } from "@rumo/theme"
import {
  asaasConfigured,
  asaasCreateCheckout,
  asaasCreateCustomer,
  asaasUpdateSubscriptionValue,
  nextDueDateIso,
  onlyDigits,
  planValueReais,
  validCpfCnpj,
} from "./asaas"
import {
  touch,
  withDb,
  type AppointmentRow,
  type AppointmentStatus,
  type BlockRow,
  type ClientRow,
  type DB,
  type ProfileRow,
  type StoreRow,
  type SubscriptionStatus,
} from "./db"
import { HttpError } from "./errors"

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function id() {
  return randomBytes(16).toString("hex")
}

function digits(value: string) {
  return value.replace(/\D/g, "")
}

function clientRecord(db: DB, client: ClientRow): ClientRecord {
  const related = db.appointments.filter(
    (item) => item.storeId === client.storeId && item.clientId === client.id && item.status !== "cancelled",
  )
  const visits = related.filter((item) => item.status === "completed")
  const last = [...related].sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0]
  const professional = db.profiles.find((item) => item.id === client.professionalId)
  return {
    id: client.id,
    professionalId: client.professionalId ?? "",
    professionalName: professional?.fullName ?? "",
    name: client.name,
    phone: client.phone,
    notes: client.notes,
    visits: visits.length,
    spentCents: visits.reduce((sum, item) => sum + item.totalCents, 0),
    lastVisit: last ? last.startsAt : null,
  }
}

function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return base || "loja"
}

function uniqueSlug(db: DB, name: string) {
  const base = slugify(name)
  let slug = base
  let n = 2
  while (db.stores.some((store) => store.slug === slug)) {
    slug = `${base}-${n}`
    n += 1
  }
  return slug
}

function inviteCode(db: DB) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const taken = new Set(db.stores.map((store) => store.inviteCode))
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const bytes = randomBytes(6)
    let code = ""
    for (let index = 0; index < 6; index += 1) code += alphabet[bytes[index] % alphabet.length]
    if (!taken.has(code)) return code
  }
  throw new HttpError(500, "Não foi possível gerar o código da equipe.")
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 32).toString("hex") }
}

function samePassword(password: string, salt: string, hash: string) {
  const next = scryptSync(password, salt, 32)
  const previous = Buffer.from(hash, "hex")
  if (next.length !== previous.length) return false
  return timingSafeEqual(next, previous)
}

function cleanEmail(value: unknown) {
  if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new HttpError(400, "Informe um e-mail válido.")
  }
  return value.trim().toLowerCase()
}

function cleanName(value: unknown, label = "Nome") {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 80) {
    throw new HttpError(400, `${label} precisa ter entre 2 e 80 caracteres.`)
  }
  return value.trim()
}

function cleanPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 6) {
    throw new HttpError(400, "A senha precisa ter pelo menos 6 caracteres.")
  }
  return value
}

function cleanLogoData(value: unknown) {
  if (value === null || value === "") return null
  if (typeof value !== "string") throw new HttpError(400, "Envie a imagem da logo.")
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)) {
    throw new HttpError(400, "Use uma imagem JPG, PNG ou WebP.")
  }
  if (value.length > 900_000) throw new HttpError(400, "A logo está grande demais. Escolha uma imagem menor.")
  return value
}

function userById(db: DB, userId: string) {
  const user = db.users.find((item) => item.id === userId)
  if (!user) throw new HttpError(401, "Sessão inválida. Entre de novo.")
  return user
}

function profileOf(db: DB, userId: string) {
  return db.profiles.find((item) => item.id === userId) ?? null
}

function requireProfile(db: DB, userId: string) {
  const profile = profileOf(db, userId)
  if (!profile || !profile.active) throw new HttpError(403, "Sua conta não está ativa nesta loja.")
  return profile
}

function requireOwner(db: DB, userId: string) {
  const profile = requireProfile(db, userId)
  if (profile.role !== "owner") throw new HttpError(403, "Só quem administra a loja pode fazer isso.")
  return profile
}

function storeOf(db: DB, storeId: string) {
  const store = db.stores.find((item) => item.id === storeId)
  if (!store) throw new HttpError(404, "Loja não encontrada.")
  return store
}

function commissionOf(db: DB, professionalId: string) {
  return db.commissions.find((item) => item.professionalId === professionalId) ?? {
    professionalId,
    storeId: "",
    kind: "percent" as const,
    amount: 0,
  }
}

function seatCountOf(db: DB, storeId: string) {
  return db.profiles.filter((item) => item.storeId === storeId && item.role === "professional" && item.active).length
}

const TRIAL_DAYS = 7
const WARN_DAYS = [5, 3, 1] as const

function addDaysIso(iso: string, days: number) {
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function daysUntil(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null
  const end = new Date(iso).getTime()
  if (Number.isNaN(end)) return null
  return Math.ceil((end - now) / (24 * 60 * 60 * 1000))
}

function resolveBillingState(store: StoreRow, now = Date.now()) {
  let status = (store.billingStatus ?? "trialing") as SubscriptionStatus
  const trialEndsAt = store.trialEndsAt ?? addDaysIso(store.createdAt, TRIAL_DAYS)
  const nextDueDate = store.nextDueDate ?? null

  if (status === "active" || status === "pending") {
    // pending ainda libera se estiver em trial
  } else if (status === "trialing" || status === "none") {
    status = "trialing"
  }

  let access: BillingAccess = "open"
  let daysLeft: number | null = null

  if (status === "active") {
    daysLeft = daysUntil(nextDueDate, now)
    if (daysLeft != null && daysLeft < 0) {
      access = "blocked"
      status = "past_due"
    }
  } else if (status === "pending") {
    const trialLeft = daysUntil(trialEndsAt, now)
    daysLeft = trialLeft
    if (trialLeft != null && trialLeft < 0 && !store.asaasSubscriptionId) access = "blocked"
    else access = "open"
  } else if (status === "past_due" || status === "canceled") {
    access = "blocked"
    daysLeft = daysUntil(nextDueDate ?? trialEndsAt, now)
  } else {
    // trialing / none
    daysLeft = daysUntil(trialEndsAt, now)
    if (daysLeft != null && daysLeft < 0) access = "blocked"
  }

  const warnSource = status === "active" ? daysUntil(nextDueDate, now) : daysUntil(trialEndsAt, now)
  const warnDays = warnSource != null && (WARN_DAYS as readonly number[]).includes(warnSource)
    ? (warnSource as 5 | 3 | 1)
    : null

  return { status, access, trialEndsAt, nextDueDate, daysLeft, warnDays }
}

function wantsLiveAsaas() {
  const sandbox = (process.env.ASAAS_USE_SANDBOX || "").toLowerCase()
  const env = (process.env.ASAAS_ENV || "").toLowerCase()
  return sandbox === "false" || sandbox === "0" || sandbox === "no" || env === "production"
}

/** Demo/simular só quando não há Asaas configurada. Sandbox e produção usam checkout real. */
function isDemoBilling(_store?: StoreRow) {
  return !asaasConfigured()
}

function billingOf(db: DB, store: StoreRow): BillingSnapshot {
  const seats = seatCountOf(db, store.id)
  const resolved = resolveBillingState(store)
  return {
    status: resolved.status,
    access: resolved.access,
    configured: asaasConfigured(),
    demo: isDemoBilling(store),
    basePriceCents: store.basePriceCents,
    seatPriceCents: store.seatPriceCents,
    seatCount: seats,
    planCents: planCents(seats),
    cpfCnpj: store.billingCpfCnpj ?? null,
    checkoutUrl: store.checkoutUrl ?? null,
    trialEndsAt: resolved.trialEndsAt,
    nextDueDate: resolved.nextDueDate,
    daysLeft: resolved.daysLeft,
    warnDays: resolved.warnDays,
    lastPaidAt: store.lastPaidAt ?? null,
    asaasCustomerId: store.asaasCustomerId ?? null,
    asaasSubscriptionId: store.asaasSubscriptionId ?? null,
  }
}

function sessionBillingOf(db: DB, store: StoreRow): SessionBilling {
  const seats = seatCountOf(db, store.id)
  const resolved = resolveBillingState(store)
  return {
    status: resolved.status,
    access: resolved.access,
    trialEndsAt: resolved.trialEndsAt,
    nextDueDate: resolved.nextDueDate,
    daysLeft: resolved.daysLeft,
    warnDays: resolved.warnDays,
    planCents: planCents(seats),
    seatCount: seats,
  }
}

function planDescription(store: StoreRow, seats: number) {
  const total = planCents(seats)
  return `Agenda · ${store.name} · R$ ${(store.basePriceCents / 100).toFixed(2).replace(".", ",")} + ${seats} atendente(s) · ${formatPlan(total)} / mês`
}

function formatPlan(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`
}

function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001").replace(/\/$/, "")
}

async function syncSubscriptionValue(storeId: string) {
  if (!asaasConfigured()) return
  const payload = await withDb((db) => {
    const store = db.stores.find((item) => item.id === storeId)
    if (!store?.asaasSubscriptionId) return null
    const seats = seatCountOf(db, store.id)
    return {
      subscriptionId: store.asaasSubscriptionId,
      value: planValueReais(planCents(seats)),
      description: planDescription(store, seats),
    }
  })
  if (!payload) return
  try {
    await asaasUpdateSubscriptionValue(payload.subscriptionId, payload.value, payload.description)
  } catch {
    // Não quebra cadastro de equipe se a Asaas falhar; o próximo webhook/checkout corrige.
  }
}

function toSession(db: DB, userId: string): SessionState {
  const user = userById(db, userId)
  const profile = profileOf(db, userId)
  const store = profile ? storeOf(db, profile.storeId) : null
  const commission = profile ? commissionOf(db, profile.id) : null
  const profession = profile?.professionId
    ? db.professions.find((item) => item.id === profile.professionId) ?? null
    : null
  const seatCount = profile ? seatCountOf(db, profile.storeId) : 0
  return {
    user: { id: user.id, email: user.email, name: user.name },
    profile: profile
      ? {
          id: profile.id,
          storeId: profile.storeId,
          role: profile.role,
          fullName: profile.fullName,
          active: profile.active,
          attends: profile.attends,
          professionId: profile.professionId ?? null,
          professionName: profession?.name ?? null,
          commissionType: commission?.kind ?? "percent",
          commissionValue: commission?.amount ?? 0,
        }
      : null,
    store: store
      ? {
          id: store.id,
          name: store.name,
          slug: store.slug,
          vertical: store.vertical,
          phone: store.phone,
          address: store.address,
          timezone: store.timezone,
          inviteCode: profile?.role === "owner" ? store.inviteCode : null,
          basePriceCents: store.basePriceCents,
          seatPriceCents: store.seatPriceCents,
          brandColor: store.brandColor ?? null,
          logoData: store.logoData ?? null,
        }
      : null,
    seatCount,
    planCents: planCents(seatCount),
    billing: store ? sessionBillingOf(db, store) : null,
  }
}

function defaultHours(storeId: string): DB["hours"] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    id: id(),
    storeId,
    professionalId: null,
    weekday,
    start: "06:00",
    end: "23:30",
    enabled: weekday >= 1 && weekday <= 6,
  }))
}

function personOffersService(db: DB, professionalId: string, serviceId: string, actor?: ProfileRow | null) {
  const service = db.services.find((item) => item.id === serviceId && item.active)
  if (!service) return false
  const person = db.profiles.find((item) => item.id === professionalId)
  if (!person || person.storeId !== service.storeId) return false
  // Quem administra pode marcar qualquer serviço da loja na agenda de alguém.
  if (actor?.role === "owner" && actor.storeId === service.storeId) return true
  if (!person.professionId) return false
  return db.links.some((link) => link.serviceId === serviceId && link.professionId === person.professionId)
}

function professionView(row: DB["professions"][number]): Profession {
  return { id: row.id, name: row.name, active: row.active }
}

function storeProfessionName(db: DB, storeId: string) {
  const store = db.stores.find((item) => item.id === storeId)
  return defaultProfessionName(store?.vertical ?? "estetica")
}

function ensureDefaultProfession(db: DB, storeId: string, name?: string) {
  const existing = db.professions.find((item) => item.storeId === storeId && item.active)
  if (existing) return existing
  const row = {
    id: id(),
    storeId,
    name: (name?.trim() || storeProfessionName(db, storeId)),
    active: true,
    createdAt: new Date().toISOString(),
  }
  db.professions.push(row)
  return row
}

function createUser(db: DB, input: { name: string; email: string; password: string }) {
  if (db.users.some((user) => user.email === input.email)) {
    throw new HttpError(409, "Esse e-mail já está em uso.")
  }
  const password = hashPassword(input.password)
  const user = {
    id: id(),
    email: input.email,
    name: input.name,
    salt: password.salt,
    passwordHash: password.hash,
    createdAt: new Date().toISOString(),
  }
  db.users.push(user)
  const token = randomBytes(24).toString("hex")
  db.sessions.push({ token, userId: user.id, createdAt: user.createdAt })
  return { user, token }
}

function effectiveHour(db: DB, storeId: string, professionalId: string, weekday: number) {
  const own = db.hours.find((hour) => hour.professionalId === professionalId && hour.weekday === weekday)
  if (own) return own
  return db.hours.find((hour) => hour.storeId === storeId && hour.professionalId === null && hour.weekday === weekday) ?? null
}

function busyRanges(db: DB, storeId: string, professionalId: string, exceptId?: string) {
  const appointments = db.appointments
    .filter((item) => item.professionalId === professionalId && item.status !== "cancelled" && item.id !== exceptId)
    .map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt }))
  const blocks = db.blocks
    .filter((item) => item.storeId === storeId && (item.professionalId === null || item.professionalId === professionalId))
    .map((item) => ({ startsAt: item.startsAt, endsAt: item.endsAt }))
  return [...appointments, ...blocks]
}

function assertInsideHours(db: DB, store: StoreRow, professionalId: string, startsAt: string, endsAt: string) {
  const startDay = dayKey(startsAt)
  const endDay = dayKey(new Date(endsAt).getTime() - 1)
  if (startDay !== endDay) throw new HttpError(400, "O atendimento precisa caber no mesmo dia.")
  const hour = effectiveHour(db, store.id, professionalId, weekdayIndex(startDay))
  if (!hour?.enabled) throw new HttpError(400, "A agenda está fechada nesse dia.")
  const open = zonedDateTime(startDay, hour.start).getTime()
  const close = zonedDateTime(startDay, hour.end).getTime()
  if (new Date(startsAt).getTime() < open || new Date(endsAt).getTime() > close) {
    throw new HttpError(400, "Esse horário fica fora do funcionamento.")
  }
}

const OVERLAP_CONFIRM = "Esse horário encosta no próximo. Confirme para marcar mesmo assim."

function assertFree(db: DB, storeId: string, professionalId: string, startsAt: string, endsAt: string, allowOverlap = false) {
  if (!allowOverlap) {
    const clash = db.appointments.find(
      (item) =>
        item.professionalId === professionalId &&
        item.status !== "cancelled" &&
        rangesOverlap(startsAt, endsAt, item.startsAt, item.endsAt),
    )
    if (clash) throw new HttpError(409, OVERLAP_CONFIRM)
  }
  const block = db.blocks.find(
    (item) =>
      item.storeId === storeId &&
      (item.professionalId === null || item.professionalId === professionalId) &&
      rangesOverlap(startsAt, endsAt, item.startsAt, item.endsAt),
  )
  if (block) throw new HttpError(409, "Esse horário está bloqueado.")
}

function serviceView(db: DB, service: DB["services"][number], viewer: ProfileRow | null): Service {
  const professionIds = db.links
    .filter((link) => link.serviceId === service.id && link.professionId)
    .map((link) => link.professionId!)
  const professionalIds = db.profiles
    .filter((person) =>
      person.storeId === service.storeId &&
      person.active &&
      person.professionId &&
      professionIds.includes(person.professionId) &&
      (viewer?.role !== "professional" || person.id === viewer.id),
    )
    .map((person) => person.id)
  return {
    id: service.id,
    name: service.name,
    durationMin: service.durationMin,
    priceCents: service.priceCents,
    active: service.active,
    professionIds,
    professionalIds,
  }
}

function applyServices(db: DB, actor: ProfileRow, row: AppointmentRow, value: unknown, allowOverlap = false, durationValue?: unknown) {
  if (row.status === "cancelled") throw new HttpError(400, "Horário cancelado não muda de serviço.")
  if (actor.role !== "owner" && actor.id !== row.professionalId) throw new HttpError(403, "Você só altera a própria agenda.")
  const uniqueIds = [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))]
  const store = storeOf(db, row.storeId)
  const professional = db.profiles.find((item) => item.id === row.professionalId && item.storeId === row.storeId)
  if (!professional) throw new HttpError(404, "Profissional não encontrado.")
  const services = uniqueIds.map((serviceId) => {
    const service = db.services.find((item) => item.id === serviceId && item.storeId === row.storeId && item.active)
    if (!service || !personOffersService(db, professional.id, serviceId, actor)) {
      throw new HttpError(400, "Escolha serviços que essa pessoa realiza.")
    }
    return service
  })
  if (services.length === 0) throw new HttpError(400, "Escolha ao menos um serviço.")
  const catalog = services.reduce((sum, service) => sum + service.durationMin, 0)
  const duration = durationValue === undefined ? (row.durationMin && row.durationMin > 0 ? row.durationMin : catalog) : readDuration(durationValue, catalog)
  const endsAt = new Date(new Date(row.startsAt).getTime() + duration * 60_000).toISOString()
  assertInsideHours(db, store, professional.id, row.startsAt, endsAt)
  const clash = db.appointments.some(
    (item) =>
      item.id !== row.id &&
      item.professionalId === row.professionalId &&
      item.status !== "cancelled" &&
      rangesOverlap(row.startsAt, endsAt, item.startsAt, item.endsAt),
  )
  if (clash && !allowOverlap) throw new HttpError(409, OVERLAP_CONFIRM)
  const commission = commissionOf(db, professional.id)
  const totalCents = services.reduce((sum, service) => sum + service.priceCents, 0)
  row.endsAt = endsAt
  row.durationMin = duration
  row.totalCents = totalCents
  row.commissionCents = professional.role === "professional" ? commissionCents(totalCents, commission.kind, commission.amount) : 0
  db.items = db.items.filter((item) => item.appointmentId !== row.id)
  for (const service of services) {
    db.items.push({
      id: id(),
      appointmentId: row.id,
      serviceId: service.id,
      name: service.name,
      priceCents: service.priceCents,
      durationMin: service.durationMin,
      commissionKind: commission.kind,
      commissionAmount: commission.amount,
    })
  }
}

function sameSeries(row: AppointmentRow, other: AppointmentRow) {
  if (other.storeId !== row.storeId || other.professionalId !== row.professionalId || other.clientId !== row.clientId) return false
  if (other.status === "cancelled") return false
  if (row.seriesId) return other.seriesId === row.seriesId
  return formatClock(other.startsAt) === formatClock(row.startsAt)
}

function sameCancelledSeries(row: AppointmentRow, other: AppointmentRow) {
  if (other.storeId !== row.storeId || other.professionalId !== row.professionalId || other.clientId !== row.clientId) return false
  if (other.status !== "cancelled") return false
  if (row.seriesId || other.seriesId) return Boolean(row.seriesId) && row.seriesId === other.seriesId
  return formatClock(other.startsAt) === formatClock(row.startsAt)
}

function seriesTargets(db: DB, row: AppointmentRow) {
  const now = new Date().toISOString()
  return db.appointments.filter((item) => sameSeries(row, item) && (item.id === row.id || item.startsAt >= now))
}

function cancelledSeriesFrom(db: DB, row: AppointmentRow) {
  return db.appointments
    .filter((item) => sameCancelledSeries(row, item) && (item.id === row.id || item.startsAt >= row.startsAt))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

function appointmentView(db: DB, row: AppointmentRow): AppointmentView {
  const professional = db.profiles.find((item) => item.id === row.professionalId)
  const client = db.clients.find((item) => item.id === row.clientId)
  const services = db.items
    .filter((item) => item.appointmentId === row.id)
    .map((item) => ({ serviceId: item.serviceId, name: item.name, priceCents: item.priceCents, durationMin: item.durationMin }))
  const cancelledFollowing = row.status === "cancelled"
    ? Math.max(0, cancelledSeriesFrom(db, row).length - 1)
    : 0
  return {
    id: row.id,
    professionalId: row.professionalId,
    professionalName: professional?.fullName ?? "Profissional",
    role: professional?.role ?? "professional",
    clientId: row.clientId,
    clientName: client?.name ?? "Cliente",
    clientPhone: client?.phone ?? "",
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    source: row.source,
    notes: row.notes,
    totalCents: row.totalCents,
    commissionCents: row.commissionCents,
    paymentMethod: row.paymentMethod,
    services,
    seriesId: row.seriesId ?? null,
    seriesAhead: seriesTargets(db, row).length,
    cancelledFollowing,
  }
}

function visibleAppointment(profile: ProfileRow, row: AppointmentRow) {
  return profile.role === "owner" || row.professionalId === profile.id
}

function openMinutes(db: DB, storeId: string, professionalIds: string[], fromDay: string, toDay: string) {
  let total = 0
  for (let day = fromDay; day < toDay; day = addDays(day, 1)) {
    for (const professionalId of professionalIds) {
      const profile = db.profiles.find((item) => item.id === professionalId)
      if (!profile?.attends) continue
      const hour = effectiveHour(db, storeId, professionalId, weekdayIndex(day))
      if (!hour?.enabled) continue
      total += Math.max(0, hmToMinutes(hour.end) - hmToMinutes(hour.start))
    }
  }
  return total
}

function inSpan(iso: string, fromDay: string, toDay: string) {
  const day = dayKey(iso)
  return day >= fromDay && day < toDay
}

function readDuration(value: unknown, catalog: number) {
  if (value == null || value === "") return catalog
  const minutes = Number(value)
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 8 * 60) {
    throw new HttpError(400, "A duração fica entre 5 minutos e 8 horas.")
  }
  return minutes
}

function readPayment(value: unknown): "cash" | "pix" | "card" | null {
  if (value == null || value === "") return null
  if (value === "cash" || value === "pix" || value === "card") return value
  throw new HttpError(400, "Informe se o pagamento foi em Pix, dinheiro ou cartão de crédito ou débito.")
}

function ensureClient(db: DB, storeId: string, professionalId: string, nameRaw: unknown, phoneRaw: unknown) {
  const phone = cleanName(phoneRaw, "Telefone")
  const phoneDigits = digits(phone)
  if (phoneDigits.length < 8) throw new HttpError(400, "Informe um telefone com DDD.")
  const name = cleanName(nameRaw, "Nome do cliente")
  let client = db.clients.find((item) => item.storeId === storeId && item.professionalId === professionalId && digits(item.phone) === phoneDigits)
  if (!client) {
    client = {
      id: id(),
      storeId,
      professionalId,
      name,
      phone,
      notes: "",
      createdAt: new Date().toISOString(),
    }
    db.clients.push(client)
  } else if (client.name !== name) {
    client.name = name
  }
  return client
}

function moveStart(db: DB, row: AppointmentRow, allowOverlap = false) {
  const summed = db.items.filter((item) => item.appointmentId === row.id).reduce((sum, item) => sum + item.durationMin, 0)
  const duration = row.durationMin && row.durationMin > 0 ? row.durationMin : summed
  if (duration <= 0) throw new HttpError(400, "Escolha ao menos um serviço.")
  const endsAt = new Date(new Date(row.startsAt).getTime() + duration * 60_000).toISOString()
  const store = storeOf(db, row.storeId)
  assertInsideHours(db, store, row.professionalId, row.startsAt, endsAt)
  const clash = db.appointments.some(
    (item) =>
      item.id !== row.id &&
      item.professionalId === row.professionalId &&
      item.status !== "cancelled" &&
      rangesOverlap(row.startsAt, endsAt, item.startsAt, item.endsAt),
  )
  if (clash && !allowOverlap) throw new HttpError(409, OVERLAP_CONFIRM)
  row.endsAt = endsAt
}

function book(db: DB, input: {
  store: StoreRow
  actor: ProfileRow | null
  professionalId: string
  serviceIds: string[]
  startsAt: string
  clientName: unknown
  clientPhone: unknown
  notes: string
  source: "online" | "manual"
  paymentMethod?: unknown
  allowOverlap?: boolean
  durationMin?: unknown
  seriesId?: string | null
}) {
  const professional = db.profiles.find((item) => item.id === input.professionalId && item.storeId === input.store.id)
  if (!professional || !professional.active || !professional.attends) {
    throw new HttpError(400, "Esse profissional não está recebendo horários.")
  }
  if (input.source === "manual") {
    if (!input.actor) throw new HttpError(401, "Entre para lançar um horário.")
    if (input.actor.role !== "owner" && input.actor.id !== professional.id) {
      throw new HttpError(403, "Você só pode agendar na sua própria agenda.")
    }
  }

  const uniqueIds = [...new Set(input.serviceIds)]
  const services = uniqueIds.map((serviceId) => {
    const service = db.services.find((item) => item.id === serviceId && item.storeId === input.store.id && item.active)
    if (!service || !personOffersService(db, professional.id, serviceId, input.actor)) {
      throw new HttpError(400, "Escolha serviços que essa pessoa realiza.")
    }
    return service
  })
  if (services.length === 0) throw new HttpError(400, "Escolha ao menos um serviço.")

  const startsAt = new Date(input.startsAt)
  if (Number.isNaN(startsAt.getTime())) throw new HttpError(400, "Horário inválido.")
  const duration = readDuration(input.durationMin, services.reduce((sum, service) => sum + service.durationMin, 0))
  const endsAt = new Date(startsAt.getTime() + duration * 60_000).toISOString()
  const startsIso = startsAt.toISOString()
  assertInsideHours(db, input.store, professional.id, startsIso, endsAt)
  assertFree(db, input.store.id, professional.id, startsIso, endsAt, input.source === "manual" && input.allowOverlap === true)

  const client = ensureClient(db, input.store.id, professional.id, input.clientName, input.clientPhone)

  const commission = commissionOf(db, professional.id)
  const totalCents = services.reduce((sum, service) => sum + service.priceCents, 0)
  const due = professional.role === "professional" ? commissionCents(totalCents, commission.kind, commission.amount) : 0
  const appointment: AppointmentRow = {
    id: id(),
    storeId: input.store.id,
    professionalId: professional.id,
    clientId: client.id,
    startsAt: startsIso,
    endsAt,
    status: "scheduled",
    source: input.source,
    notes: input.notes.slice(0, 400),
    totalCents,
    commissionCents: due,
    paymentMethod: readPayment(input.paymentMethod),
    durationMin: duration,
    seriesId: input.seriesId ?? null,
    createdAt: new Date().toISOString(),
  }
  db.appointments.push(appointment)
  for (const service of services) {
    db.items.push({
      id: id(),
      appointmentId: appointment.id,
      serviceId: service.id,
      name: service.name,
      priceCents: service.priceCents,
      durationMin: service.durationMin,
      commissionKind: commission.kind,
      commissionAmount: commission.amount,
    })
  }
  touch(input.store.id)
  return appointmentView(db, appointment)
}

function financeFor(db: DB, profile: ProfileRow, anchor: string): FinanceReport {
  const store = storeOf(db, profile.storeId)
  const week = weekStart(anchor)
  const month = monthStart(anchor)
  const spans = {
    day: [anchor, addDays(anchor, 1)] as const,
    week: [week, addDays(week, 7)] as const,
    month: [month, nextMonth(anchor)] as const,
  }
  const rows = db.appointments.filter((item) => item.storeId === store.id && visibleAppointment(profile, item))
  const people = db.profiles.filter((item) => {
    if (item.storeId !== store.id) return false
    if (profile.role === "professional") return item.id === profile.id
    if (item.active) return true
    return rows.some((row) => row.professionalId === item.id && inSpan(row.startsAt, week, addDays(week, 7)))
  })

  const financeRows = (fromDay: string, toDay: string, professionalId?: string) =>
    rows
      .filter((item) => inSpan(item.startsAt, fromDay, toDay) && (!professionalId || item.professionalId === professionalId))
      .map((item) => ({
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        status: item.status,
        role: db.profiles.find((person) => person.id === item.professionalId)?.role ?? "professional",
        totalCents: item.totalCents,
        commissionCents: item.commissionCents,
        paymentMethod: item.paymentMethod,
      }))

  const pack = (fromDay: string, toDay: string, professionalId?: string) => {
    const selected = financeRows(fromDay, toDay, professionalId)
    const ids = professionalId ? [professionalId] : people.map((item) => item.id)
    return summarize(selected, openMinutes(db, store.id, ids, fromDay, toDay))
  }

  const payments = (fromDay: string, toDay: string, professionalId?: string): PaymentBreakdown =>
    summarizePayments(financeRows(fromDay, toDay, professionalId))

  const servicesOf = (fromDay: string, toDay: string, professionalId: string): ServiceBreakdown[] => {
    const selected = rows.filter(
      (item) =>
        item.professionalId === professionalId &&
        inSpan(item.startsAt, fromDay, toDay) &&
        item.status !== "cancelled" &&
        item.status !== "no_show",
    )
    const person = db.profiles.find((item) => item.id === professionalId)
    const map = new Map<string, ServiceBreakdown>()
    for (const row of selected) {
      for (const item of db.items.filter((entry) => entry.appointmentId === row.id)) {
        const current = map.get(item.name) ?? { name: item.name, count: 0, totalCents: 0, payableCents: 0 }
        current.count += 1
        current.totalCents += item.priceCents
        if (person?.role === "professional") {
          current.payableCents += commissionCents(item.priceCents, item.commissionKind, item.commissionAmount)
        }
        map.set(item.name, current)
      }
    }
    return [...map.values()].sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, "pt-BR"))
  }

  return {
    anchor,
    weekStart: week,
    monthStart: month,
    day: pack(...spans.day),
    week: pack(...spans.week),
    month: pack(...spans.month),
    dayPayments: payments(...spans.day),
    weekPayments: payments(...spans.week),
    monthPayments: payments(...spans.month),
    professionals: people.map((person) => {
      const commission = commissionOf(db, person.id)
      return {
        id: person.id,
        name: person.fullName,
        role: person.role,
        commissionType: commission.kind,
        commissionValue: commission.kind === "percent" ? commission.amount : commission.amount / 100,
        day: pack(spans.day[0], spans.day[1], person.id),
        week: pack(spans.week[0], spans.week[1], person.id),
        month: pack(spans.month[0], spans.month[1], person.id),
        weekPayments: payments(spans.week[0], spans.week[1], person.id),
        weekServices: servicesOf(spans.week[0], spans.week[1], person.id),
      }
    }),
    appointments: rows
      .filter((item) => inSpan(item.startsAt, spans.week[0], spans.week[1]))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((item) => appointmentView(db, item)),
  }
}

function parseCommission(type: unknown, value: unknown): { kind: CommissionType; amount: number } {
  if (type !== "percent" && type !== "fixed") throw new HttpError(400, "Escolha comissão em porcentagem ou valor fixo.")
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, "Comissão inválida.")
  if (type === "percent" && amount > 100) throw new HttpError(400, "A porcentagem vai de 0 a 100.")
  if (type === "fixed" && amount > 10_000_000) throw new HttpError(400, "Valor de comissão alto demais.")
  return { kind: type, amount: type === "fixed" ? Math.round(amount * 100) : Math.round(amount * 100) / 100 }
}

function hourPayload(value: unknown): { weekday: number; start: string; end: string; enabled: boolean }[] {
  if (!Array.isArray(value) || value.length !== 7) throw new HttpError(400, "Informe os sete dias da semana.")
  return value.map((item, index) => {
    const row = item as { weekday?: number; start?: string; end?: string; enabled?: boolean }
    const start = row.start ?? ""
    const end = row.end ?? ""
    if (row.weekday !== index || !TIME_RE.test(start) || !TIME_RE.test(end)) {
      throw new HttpError(400, "Horário inválido.")
    }
    if (end <= start) throw new HttpError(400, "O fechamento precisa ser depois da abertura.")
    return { weekday: index, start, end, enabled: Boolean(row.enabled) }
  })
}

export const domain = {
  async signup(input: Record<string, unknown>) {
    return withDb((db) => {
      const name = cleanName(input.name)
      const email = cleanEmail(input.email)
      const password = cleanPassword(input.password)
      const { user, token } = createUser(db, { name, email, password })
      if (typeof input.inviteCode === "string" && input.inviteCode.trim()) {
        join(db, user.id, input.inviteCode, name)
      }
      return { token, session: toSession(db, user.id) }
    }, true)
  },

  async login(input: Record<string, unknown>) {
    return withDb((db) => {
      const email = cleanEmail(input.email)
      const password = typeof input.password === "string" ? input.password : ""
      const user = db.users.find((item) => item.email === email)
      if (!user || !samePassword(password, user.salt, user.passwordHash)) {
        throw new HttpError(401, "E-mail ou senha não conferem.")
      }
      const profile = profileOf(db, user.id)
      if (profile && !profile.active) throw new HttpError(403, "Sua conta foi desativada.")
      const token = randomBytes(24).toString("hex")
      db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() })
      return { token, session: toSession(db, user.id) }
    }, true)
  },

  async logout(token: string | null) {
    if (!token) return
    await withDb((db) => {
      db.sessions = db.sessions.filter((session) => session.token !== token)
    }, true)
  },

  async session(token: string | null) {
    if (!token) return null
    return withDb((db) => {
      const session = db.sessions.find((item) => item.token === token)
      if (!session) return null
      return toSession(db, session.userId)
    })
  },

  async userIdFromToken(token: string | null) {
    if (!token) throw new HttpError(401, "Entre para continuar.")
    return withDb((db) => {
      const session = db.sessions.find((item) => item.token === token)
      if (!session) throw new HttpError(401, "Sessão inválida. Entre de novo.")
      return session.userId
    })
  },

  async updateAccount(userId: string, token: string | null, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const user = db.users.find((item) => item.id === userId)
      if (!user) throw new HttpError(404, "Conta não encontrada.")
      if (typeof input.fullName === "string") {
        profile.fullName = cleanName(input.fullName)
        user.name = profile.fullName
      }
      if (typeof input.email === "string") {
        const email = cleanEmail(input.email)
        if (db.users.some((item) => item.email === email && item.id !== user.id)) {
          throw new HttpError(409, "Esse e-mail já está em uso.")
        }
        user.email = email
      }
      if (typeof input.password === "string" && input.password.trim().length > 0) {
        const next = hashPassword(cleanPassword(input.password))
        user.salt = next.salt
        user.passwordHash = next.hash
        db.sessions = db.sessions.filter((session) => session.userId !== user.id || (token != null && session.token === token))
      }
      touch(profile.storeId)
      return toSession(db, userId)
    }, true)
  },

  async createStore(userId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      userById(db, userId)
      if (profileOf(db, userId)) throw new HttpError(409, "Essa conta já está ligada a uma loja.")
      if (typeof input.vertical !== "string" || !isVerticalId(input.vertical)) {
        throw new HttpError(400, "Escolha o ramo da casa.")
      }
      const name = cleanName(input.name, "Nome da loja")
      const phone = typeof input.phone === "string" ? input.phone.trim().slice(0, 40) : ""
      const address = typeof input.address === "string" ? input.address.trim().slice(0, 120) : ""
      const theme = verticals[input.vertical]
      const store: StoreRow = {
        id: id(),
        name,
        slug: uniqueSlug(db, name),
        vertical: input.vertical,
        phone,
        address,
        timezone: "America/Sao_Paulo",
        inviteCode: inviteCode(db),
        basePriceCents: 3990,
        seatPriceCents: 1000,
        brandColor: null,
        logoData: null,
        billingStatus: "trialing",
        billingCpfCnpj: null,
        asaasCustomerId: null,
        asaasSubscriptionId: null,
        asaasCheckoutId: null,
        asaasPayUrl: null,
        checkoutPageToken: null,
        checkoutUrl: null,
        trialEndsAt: addDaysIso(new Date().toISOString(), TRIAL_DAYS),
        nextDueDate: null,
        lastPaidAt: null,
        createdAt: new Date().toISOString(),
      }
      const profession = {
        id: id(),
        storeId: store.id,
        name: defaultProfessionName(input.vertical),
        active: true,
        createdAt: store.createdAt,
      }
      const profile: ProfileRow = {
        id: userId,
        storeId: store.id,
        role: "owner",
        fullName: userById(db, userId).name,
        active: true,
        attends: true,
        professionId: profession.id,
        createdAt: store.createdAt,
      }
      db.stores.push(store)
      db.professions.push(profession)
      db.profiles.push(profile)
      db.commissions.push({ professionalId: userId, storeId: store.id, kind: "percent", amount: 0 })
      db.hours.push(...defaultHours(store.id))
      for (const service of theme.services) {
        const row = {
          id: id(),
          storeId: store.id,
          name: service.name,
          durationMin: service.durationMin,
          priceCents: service.priceCents,
          active: true,
          createdAt: store.createdAt,
        }
        db.services.push(row)
        db.links.push({ professionId: profession.id, serviceId: row.id })
      }
      touch(store.id)
      return toSession(db, userId)
    }, true)
  },

  async updateStore(userId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireOwner(db, userId)
      const store = storeOf(db, profile.storeId)
      let changed = false
      if (input.brandColor !== undefined) {
        const color = normalizeBrandColor(input.brandColor)
        if (!color) throw new HttpError(400, "Escolha uma cor do app.")
        store.brandColor = color
        changed = true
      }
      if (input.logoData !== undefined) {
        store.logoData = cleanLogoData(input.logoData)
        changed = true
      }
      if (!changed) throw new HttpError(400, "Nada para atualizar.")
      touch(profile.storeId)
      return toSession(db, userId)
    }, true)
  },

  async setBrandColor(userId: string, input: Record<string, unknown>) {
    return this.updateStore(userId, input)
  },

  async joinStore(userId: string, code: unknown) {
    return withDb((db) => {
      const user = userById(db, userId)
      join(db, userId, code, user.name)
      return toSession(db, userId)
    }, true)
  },

  async listTeam(userId: string): Promise<TeamMember[]> {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const people = db.profiles.filter((item) => item.storeId === profile.storeId && (profile.role === "owner" || item.id === profile.id))
      return people
        .map((person) => {
          const commission = commissionOf(db, person.id)
          const user = db.users.find((item) => item.id === person.id)
          const profession = person.professionId
            ? db.professions.find((item) => item.id === person.professionId) ?? null
            : null
          return {
            id: person.id,
            storeId: person.storeId,
            role: person.role,
            fullName: person.fullName,
            active: person.active,
            attends: person.attends,
            professionId: person.professionId ?? null,
            professionName: profession?.name ?? null,
            commissionType: commission.kind,
            commissionValue: commission.amount,
            email: user?.email ?? "",
          }
        })
        .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner") || a.fullName.localeCompare(b.fullName, "pt-BR"))
    })
  },

  async listProfessions(userId: string) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      return db.professions
        .filter((item) => item.storeId === profile.storeId)
        .map(professionView)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    })
  },

  async createProfession(userId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const owner = requireOwner(db, userId)
      const name = cleanName(input.name, "Profissão")
      if (db.professions.some((item) => item.storeId === owner.storeId && item.name.toLowerCase() === name.toLowerCase())) {
        throw new HttpError(409, "Essa profissão já existe.")
      }
      const row = {
        id: id(),
        storeId: owner.storeId,
        name,
        active: true,
        createdAt: new Date().toISOString(),
      }
      db.professions.push(row)
      touch(owner.storeId)
      return professionView(row)
    }, true)
  },

  async updateProfession(userId: string, professionId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const owner = requireOwner(db, userId)
      const row = db.professions.find((item) => item.id === professionId && item.storeId === owner.storeId)
      if (!row) throw new HttpError(404, "Profissão não encontrada.")
      if (typeof input.name === "string") {
        const name = cleanName(input.name, "Profissão")
        if (db.professions.some((item) => item.storeId === owner.storeId && item.id !== row.id && item.name.toLowerCase() === name.toLowerCase())) {
          throw new HttpError(409, "Essa profissão já existe.")
        }
        row.name = name
      }
      if (typeof input.active === "boolean") row.active = input.active
      touch(owner.storeId)
      return professionView(row)
    }, true)
  },

  async deleteProfession(userId: string, professionId: string) {
    return withDb((db) => {
      const owner = requireOwner(db, userId)
      const row = db.professions.find((item) => item.id === professionId && item.storeId === owner.storeId)
      if (!row) throw new HttpError(404, "Profissão não encontrada.")
      const linkedPeople = db.profiles.filter((item) => item.storeId === owner.storeId && item.professionId === professionId).length
      const linkedServices = db.links.filter((link) => link.professionId === professionId).length
      if (linkedPeople > 0 || linkedServices > 0) {
        throw new HttpError(
          400,
          linkedPeople > 0 && linkedServices > 0
            ? "Tire essa profissão das pessoas e dos serviços antes de excluir."
            : linkedPeople > 0
              ? "Tire essa profissão das pessoas antes de excluir."
              : "Desligue os serviços dessa profissão antes de excluir.",
        )
      }
      db.professions = db.professions.filter((item) => item.id !== professionId)
      touch(owner.storeId)
      return true
    }, true)
  },

  async createProfessional(userId: string, input: Record<string, unknown>) {
    const session = await withDb((db) => {
      const owner = requireOwner(db, userId)
      const name = cleanName(input.name)
      const email = cleanEmail(input.email)
      const password = cleanPassword(input.password)
      const commission = parseCommission(input.commissionType ?? "percent", input.commissionValue ?? 50)
      const professionId = readProfessionId(db, owner.storeId, input.professionId, true)
      const { user } = createUser(db, { name, email, password })
      db.sessions = db.sessions.filter((session) => session.userId !== user.id)
      const profile: ProfileRow = {
        id: user.id,
        storeId: owner.storeId,
        role: "professional",
        fullName: name,
        active: true,
        attends: input.attends !== false,
        professionId,
        createdAt: new Date().toISOString(),
      }
      db.profiles.push(profile)
      db.commissions.push({ professionalId: user.id, storeId: owner.storeId, kind: commission.kind, amount: commission.amount })
      touch(owner.storeId)
      return { session: toSession(db, userId), storeId: owner.storeId }
    }, true)
    void syncSubscriptionValue(session.storeId)
    return session.session
  },

  async updateProfessional(userId: string, professionalId: string, input: {
    fullName?: unknown
    email?: unknown
    password?: unknown
    active?: unknown
    attends?: unknown
    professionId?: unknown
    commissionType?: unknown
    commissionValue?: unknown
  }) {
    const result = await withDb((db) => {
      const owner = requireOwner(db, userId)
      const profile = db.profiles.find((item) => item.id === professionalId && item.storeId === owner.storeId)
      if (!profile) throw new HttpError(404, "Pessoa não encontrada.")
      const user = db.users.find((item) => item.id === profile.id)
      if (!user) throw new HttpError(404, "Conta não encontrada.")
      let seatsChanged = false
      if (typeof input.fullName === "string") {
        profile.fullName = cleanName(input.fullName)
        user.name = profile.fullName
      }
      if (typeof input.email === "string") {
        const email = cleanEmail(input.email)
        if (db.users.some((item) => item.email === email && item.id !== user.id)) {
          throw new HttpError(409, "Esse e-mail já está em uso.")
        }
        user.email = email
      }
      if (typeof input.password === "string" && input.password.trim().length > 0) {
        const next = hashPassword(cleanPassword(input.password))
        user.salt = next.salt
        user.passwordHash = next.hash
        db.sessions = db.sessions.filter((session) => session.userId !== user.id)
      }
      if (typeof input.active === "boolean") {
        if (profile.role === "owner" && !input.active) throw new HttpError(400, "A conta administradora permanece ativa.")
        if (profile.active !== input.active) seatsChanged = true
        profile.active = input.active
      }
      if (typeof input.attends === "boolean") profile.attends = input.attends
      if (input.professionId !== undefined) {
        profile.professionId = readProfessionId(db, owner.storeId, input.professionId, false)
      }
      if (input.commissionType !== undefined || input.commissionValue !== undefined) {
        const current = commissionOf(db, profile.id)
        const next = parseCommission(input.commissionType ?? current.kind, input.commissionValue ?? (current.kind === "fixed" ? current.amount / 100 : current.amount))
        const row = db.commissions.find((item) => item.professionalId === profile.id)
        if (row) {
          row.kind = next.kind
          row.amount = next.amount
        } else {
          db.commissions.push({ professionalId: profile.id, storeId: profile.storeId, kind: next.kind, amount: next.amount })
        }
      }
      touch(owner.storeId)
      return { ok: true as const, storeId: owner.storeId, seatsChanged }
    }, true)
    if (result.seatsChanged) void syncSubscriptionValue(result.storeId)
    return true
  },

  async listServices(userId: string) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      return db.services
        .filter((service) => {
          if (service.storeId !== profile.storeId) return false
          if (profile.role === "owner") return true
          return personOffersService(db, profile.id, service.id)
        })
        .map((service) => serviceView(db, service, profile))
    })
  },

  async createService(userId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const owner = requireOwner(db, userId)
      const name = cleanName(input.name, "Serviço")
      const durationMin = Number(input.durationMin)
      const priceCents = Number(input.priceCents)
      if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 480) {
        throw new HttpError(400, "A duração fica entre 5 e 480 minutos.")
      }
      if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 10_000_000) {
        throw new HttpError(400, "Preço inválido.")
      }
      const service = {
        id: id(),
        storeId: owner.storeId,
        name,
        durationMin,
        priceCents,
        active: true,
        createdAt: new Date().toISOString(),
      }
      db.services.push(service)
      assignProfessions(db, owner.storeId, service.id, input.professionIds ?? input.professionalIds)
      touch(owner.storeId)
      return serviceView(db, service, owner)
    }, true)
  },

  async updateService(userId: string, serviceId: string, input: {
    name?: unknown
    durationMin?: unknown
    priceCents?: unknown
    active?: unknown
    professionIds?: unknown
    professionalIds?: unknown
  }) {
    return withDb((db) => {
      const owner = requireOwner(db, userId)
      const service = db.services.find((item) => item.id === serviceId && item.storeId === owner.storeId)
      if (!service) throw new HttpError(404, "Serviço não encontrado.")
      if (typeof input.name === "string") service.name = cleanName(input.name, "Serviço")
      if (input.durationMin !== undefined) {
        const durationMin = Number(input.durationMin)
        if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 480) {
          throw new HttpError(400, "A duração fica entre 5 e 480 minutos.")
        }
        service.durationMin = durationMin
      }
      if (input.priceCents !== undefined) {
        const priceCents = Number(input.priceCents)
        if (!Number.isInteger(priceCents) || priceCents < 0) throw new HttpError(400, "Preço inválido.")
        service.priceCents = priceCents
      }
      if (typeof input.active === "boolean") service.active = input.active
      if (input.professionIds !== undefined || input.professionalIds !== undefined) {
        assignProfessions(db, owner.storeId, service.id, input.professionIds ?? input.professionalIds)
      }
      touch(owner.storeId)
      return serviceView(db, service, owner)
    }, true)
  },

  async listHours(userId: string) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      return db.hours
        .filter((hour) => hour.storeId === profile.storeId && (profile.role === "owner" || hour.professionalId === null || hour.professionalId === profile.id))
        .map(hourView)
    })
  },

  async saveHours(userId: string, professionalId: unknown, hours: unknown) {
    return withDb((db) => {
      const owner = requireOwner(db, userId)
      const target = professionalId === null || professionalId === "" || professionalId === undefined ? null : String(professionalId)
      if (target && !db.profiles.some((item) => item.id === target && item.storeId === owner.storeId)) {
        throw new HttpError(404, "Pessoa não encontrada.")
      }
      const next = hourPayload(hours)
      db.hours = db.hours.filter((hour) => !(hour.storeId === owner.storeId && hour.professionalId === target))
      for (const hour of next) {
        db.hours.push({
          id: id(),
          storeId: owner.storeId,
          professionalId: target,
          weekday: hour.weekday,
          start: hour.start,
          end: hour.end,
          enabled: hour.enabled,
        })
      }
      touch(owner.storeId)
      return db.hours.filter((hour) => hour.storeId === owner.storeId && hour.professionalId === target).map(hourView)
    }, true)
  },

  async clearHours(userId: string, professionalId: unknown) {
    return withDb((db) => {
      const owner = requireOwner(db, userId)
      const target = String(professionalId ?? "")
      if (!target) throw new HttpError(400, "Escolha a pessoa.")
      db.hours = db.hours.filter((hour) => !(hour.storeId === owner.storeId && hour.professionalId === target))
      touch(owner.storeId)
      return true
    }, true)
  },

  async listBlocks(userId: string) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      return db.blocks
        .filter((block) => block.storeId === profile.storeId && (profile.role === "owner" || block.professionalId === null || block.professionalId === profile.id))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map(blockView)
    })
  },

  async createBlock(userId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const professionalId = input.professionalId ? String(input.professionalId) : null
      if (profile.role !== "owner" && professionalId !== profile.id) {
        throw new HttpError(403, "Você só bloqueia a própria agenda.")
      }
      if (professionalId && !db.profiles.some((item) => item.id === professionalId && item.storeId === profile.storeId)) {
        throw new HttpError(404, "Pessoa não encontrada.")
      }
      const startsAt = new Date(String(input.startsAt))
      const endsAt = new Date(String(input.endsAt))
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
        throw new HttpError(400, "Informe o começo e o fim do bloqueio.")
      }
      const overlap = db.appointments.some(
        (item) =>
          item.storeId === profile.storeId &&
          item.status !== "cancelled" &&
          (professionalId === null || item.professionalId === professionalId) &&
          rangesOverlap(startsAt.toISOString(), endsAt.toISOString(), item.startsAt, item.endsAt),
      )
      if (overlap) throw new HttpError(409, "Já existe agendamento nesse intervalo. Mova ou cancele antes de bloquear.")
      const block: BlockRow = {
        id: id(),
        storeId: profile.storeId,
        professionalId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: typeof input.reason === "string" ? input.reason.trim().slice(0, 120) : "",
      }
      db.blocks.push(block)
      touch(profile.storeId)
      return blockView(block)
    }, true)
  },

  async deleteBlock(userId: string, blockId: string) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const block = db.blocks.find((item) => item.id === blockId && item.storeId === profile.storeId)
      if (!block) throw new HttpError(404, "Bloqueio não encontrado.")
      if (profile.role !== "owner" && block.professionalId !== profile.id) throw new HttpError(403, "Você só remove o próprio bloqueio.")
      db.blocks = db.blocks.filter((item) => item.id !== block.id)
      touch(profile.storeId)
      return true
    }, true)
  },

  async listClients(userId: string, professionalId?: string | null): Promise<ClientRecord[]> {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const owner = profile.role === "owner"
      const target = owner ? professionalId || null : profile.id
      return db.clients
        .filter((item) => {
          if (item.storeId !== profile.storeId) return false
          if (!owner) return item.professionalId === profile.id
          return target ? item.professionalId === target : true
        })
        .map((client) => clientRecord(db, client))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    })
  },

  async createClient(userId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const name = cleanName(input.name, "Nome do cliente")
      const phone = cleanName(input.phone, "WhatsApp")
      const phoneDigits = digits(phone)
      if (phoneDigits.length < 8) throw new HttpError(400, "Informe o WhatsApp com DDD.")

      const attending = db.profiles.filter((item) => item.storeId === profile.storeId && item.active && item.attends)
      let targets: string[]
      if (profile.role !== "owner") {
        targets = [profile.id]
      } else if (input.forAll === true || input.professionalId === "all") {
        targets = attending.map((item) => item.id)
      } else if (Array.isArray(input.professionalIds)) {
        targets = [...new Set(input.professionalIds.map(String).filter(Boolean))]
      } else if (typeof input.professionalId === "string" && input.professionalId) {
        targets = [input.professionalId]
      } else {
        throw new HttpError(400, "Escolha o atendente deste cliente.")
      }
      if (targets.length === 0) throw new HttpError(400, "Ninguém está recebendo cliente nesta loja.")
      for (const professionalId of targets) {
        if (!db.profiles.some((item) => item.id === professionalId && item.storeId === profile.storeId && item.active)) {
          throw new HttpError(400, "Escolha o atendente deste cliente.")
        }
      }

      let created = 0
      let updated = 0
      const clients = targets.map((professionalId) => {
        const existing = db.clients.find((item) => item.storeId === profile.storeId && item.professionalId === professionalId && digits(item.phone) === phoneDigits)
        if (existing) {
          existing.name = name
          updated += 1
          return clientRecord(db, existing)
        }
        const client: ClientRow = {
          id: id(),
          storeId: profile.storeId,
          professionalId,
          name,
          phone,
          notes: "",
          createdAt: new Date().toISOString(),
        }
        db.clients.push(client)
        created += 1
        return clientRecord(db, client)
      })
      touch(profile.storeId)
      return { client: clients[0], clients, created: created > 0, createdCount: created, updatedCount: updated }
    }, true)
  },

  async listAppointments(userId: string, query: { from?: string; to?: string; professionalId?: string; status?: string }) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      return db.appointments
        .filter((item) => {
          if (item.storeId !== profile.storeId || !visibleAppointment(profile, item)) return false
          if (query.professionalId && item.professionalId !== query.professionalId) return false
          if (query.status && item.status !== query.status) return false
          if (query.from && dayKey(item.startsAt) < query.from) return false
          if (query.to && dayKey(item.startsAt) > query.to) return false
          return true
        })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((item) => appointmentView(db, item))
    })
  },

  async slots(userId: string, query: { professionalId?: string; day?: string; serviceIds?: string; except?: string }) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      return computeSlots(db, profile.storeId, query, profile)
    })
  },

  async createAppointment(userId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const store = storeOf(db, profile.storeId)
      const created = book(db, {
        store,
        actor: profile,
        professionalId: String(input.professionalId ?? ""),
        serviceIds: Array.isArray(input.serviceIds) ? input.serviceIds.map(String) : [],
        startsAt: String(input.startsAt ?? ""),
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        notes: typeof input.notes === "string" ? input.notes : "",
        source: "manual",
        paymentMethod: input.paymentMethod,
        allowOverlap: input.allowOverlap === true,
        durationMin: input.durationMin,
      })
      return created
    }, true)
  },

  async setStatus(userId: string, appointmentId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const row = db.appointments.find((item) => item.id === appointmentId && item.storeId === profile.storeId)
      if (!row || !visibleAppointment(profile, row)) throw new HttpError(404, "Agendamento não encontrado.")
      const payment = input.paymentMethod
      const hasPayment = payment === "cash" || payment === "pix" || payment === "card"
      const hasStatus = typeof input.status === "string" && input.status.length > 0
      const hasServices = Array.isArray(input.serviceIds)
      const hasNotes = typeof input.notes === "string"
      const hasStart = typeof input.startsAt === "string" && input.startsAt.length > 0
      const hasClient = typeof input.clientName === "string" && typeof input.clientPhone === "string"
      if (!hasStatus && !hasPayment && !hasServices && !hasNotes && !hasStart && !hasClient) {
        throw new HttpError(400, "Informe o pagamento, o serviço ou o cancelamento.")
      }
      if (row.status === "cancelled") {
        const restoring = hasStatus && ["scheduled", "confirmed"].includes(String(input.status))
        if (!restoring) {
          throw new HttpError(400, "Horário cancelado não muda. Reabra o agendamento para editar.")
        }
        if (hasPayment || hasServices || hasNotes || hasStart || hasClient) {
          throw new HttpError(400, "Reabra o horário antes de editar.")
        }
      }
      if (input.paymentMethod != null && !hasPayment) throw new HttpError(400, "Informe se o pagamento foi em Pix, dinheiro ou cartão de crédito ou débito.")
      if (hasClient) row.clientId = ensureClient(db, profile.storeId, row.professionalId, input.clientName, input.clientPhone).id
      if (hasStart) {
        const starts = new Date(String(input.startsAt))
        if (Number.isNaN(starts.getTime())) throw new HttpError(400, "Horário inválido.")
        row.startsAt = starts.toISOString()
      }
      const allowOverlap = input.allowOverlap === true
      if (hasPayment) row.paymentMethod = payment
      if (hasServices) applyServices(db, profile, row, input.serviceIds, allowOverlap, input.durationMin)
      else if (hasStart) moveStart(db, row, allowOverlap)
      if (hasNotes) row.notes = String(input.notes).slice(0, 400)

      const status = hasStatus ? (String(input.status) as AppointmentStatus) : row.status
      if (hasStatus && !["scheduled", "confirmed", "in_progress", "completed", "no_show", "cancelled"].includes(status)) {
        throw new HttpError(400, "Status inválido.")
      }
      if (hasStatus && status !== "cancelled") {
        const selfId = row.id
        const clash = db.appointments.some(
          (item) =>
            item.id !== selfId &&
            item.professionalId === row.professionalId &&
            item.status !== "cancelled" &&
            rangesOverlap(row.startsAt, row.endsAt, item.startsAt, item.endsAt),
        )
        if (clash && input.allowOverlap !== true) throw new HttpError(409, OVERLAP_CONFIRM)
        const blocked = db.blocks.some(
          (item) =>
            item.storeId === row.storeId &&
            (item.professionalId === null || item.professionalId === row.professionalId) &&
            rangesOverlap(row.startsAt, row.endsAt, item.startsAt, item.endsAt),
        )
        if (blocked && row.status === "cancelled") throw new HttpError(409, "Esse horário está bloqueado.")
      }
      if (hasStatus && status === "completed" && row.paymentMethod == null) {
        throw new HttpError(400, "Informe se o pagamento foi em Pix, dinheiro ou cartão de crédito ou débito.")
      }
      if (hasStatus) row.status = status
      touch(profile.storeId)
      return appointmentView(db, row)
    }, true)
  },

  async repeatAppointment(userId: string, appointmentId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const row = db.appointments.find((item) => item.id === appointmentId && item.storeId === profile.storeId)
      if (!row || !visibleAppointment(profile, row)) throw new HttpError(404, "Agendamento não encontrado.")
      if (row.status === "cancelled") throw new HttpError(400, "Horário cancelado não se repete.")
      if (profile.role !== "owner" && profile.id !== row.professionalId) {
        throw new HttpError(403, "Você só pode repetir um horário da sua agenda.")
      }
      const unit = input.unit === "weeks" || input.unit === "months" || input.unit === "days" ? input.unit : null
      const every = Number(input.every)
      const months = Number(input.months)
      const weekday = Number(input.weekday)
      if (!unit || !Number.isInteger(every) || every < 1 || every > 30) {
        throw new HttpError(400, "Escolha de quanto em quanto tempo o cliente volta.")
      }
      if (!Number.isInteger(months) || months < 1 || months > 12) {
        throw new HttpError(400, "O período fica entre 1 e 12 meses.")
      }
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        throw new HttpError(400, "Escolha o dia da semana.")
      }
      const client = db.clients.find((item) => item.id === row.clientId && item.storeId === row.storeId)
      if (!client) throw new HttpError(400, "Cliente não encontrado.")
      const serviceIds = db.items
        .filter((item) => item.appointmentId === row.id && item.serviceId)
        .map((item) => item.serviceId as string)
      if (serviceIds.length === 0) throw new HttpError(400, "Escolha ao menos um serviço.")
      const store = storeOf(db, row.storeId)
      const clock = formatClock(row.startsAt)
      const seriesId = row.seriesId || id()
      for (const item of db.appointments) {
        if (
          !item.seriesId &&
          item.storeId === row.storeId &&
          item.professionalId === row.professionalId &&
          item.clientId === row.clientId &&
          formatClock(item.startsAt) === clock
        ) {
          item.seriesId = seriesId
        }
      }
      row.seriesId = seriesId
      const dates = repeatDays(dayKey(row.startsAt), every, unit as RepeatUnit, months, weekday)
      let created = 0
      let skipped = 0
      let reason = ""
      for (const date of dates) {
        try {
          book(db, {
            store,
            actor: profile,
            professionalId: row.professionalId,
            serviceIds,
            startsAt: zonedDateTime(date, clock).toISOString(),
            clientName: client.name,
            clientPhone: client.phone,
            notes: row.notes,
            source: "manual",
            durationMin: row.durationMin,
            seriesId,
          })
          created += 1
        } catch (error) {
          if (error instanceof HttpError && error.status < 500) {
            skipped += 1
            reason = error.message
            continue
          }
          throw error
        }
      }
      return { created, skipped, reason }
    }, true)
  },

  async cancelAppointments(userId: string, appointmentId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const row = db.appointments.find((item) => item.id === appointmentId && item.storeId === profile.storeId)
      if (!row || !visibleAppointment(profile, row)) throw new HttpError(404, "Agendamento não encontrado.")
      if (row.status === "cancelled") throw new HttpError(400, "Este horário já está cancelado.")
      const scope = input.scope === "one" || input.scope === "following" ? input.scope : null
      if (!scope) throw new HttpError(400, "Escolha cancelar este horário ou todos.")
      const targets = scope === "following" ? seriesTargets(db, row) : [row]
      for (const item of targets) item.status = "cancelled"
      touch(profile.storeId)
      return { cancelled: targets.length }
    }, true)
  },

  async restoreAppointments(userId: string, appointmentId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const row = db.appointments.find((item) => item.id === appointmentId && item.storeId === profile.storeId)
      if (!row || !visibleAppointment(profile, row)) throw new HttpError(404, "Agendamento não encontrado.")
      if (row.status !== "cancelled") throw new HttpError(400, "Este horário não está cancelado.")
      const scope = input.scope === "one" || input.scope === "following" ? input.scope : null
      if (!scope) throw new HttpError(400, "Escolha reabrir só este horário ou este e os próximos.")
      const allowOverlap = input.allowOverlap === true
      const targets = scope === "following" ? cancelledSeriesFrom(db, row) : [row]
      for (const target of targets) {
        const clash = db.appointments.some(
          (item) =>
            item.id !== target.id &&
            item.professionalId === target.professionalId &&
            item.status !== "cancelled" &&
            rangesOverlap(target.startsAt, target.endsAt, item.startsAt, item.endsAt),
        )
        if (clash && !allowOverlap) throw new HttpError(409, OVERLAP_CONFIRM)
        const blocked = db.blocks.some(
          (item) =>
            item.storeId === target.storeId &&
            (item.professionalId === null || item.professionalId === target.professionalId) &&
            rangesOverlap(target.startsAt, target.endsAt, item.startsAt, item.endsAt),
        )
        if (blocked) throw new HttpError(409, "Esse horário está bloqueado.")
      }
      for (const target of targets) target.status = "scheduled"
      touch(profile.storeId)
      return { restored: targets.length, appointment: appointmentView(db, row) }
    }, true)
  },

  async finance(userId: string, anchor?: string) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const day = anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor : todayKey()
      return financeFor(db, profile, day)
    })
  },

  async publicStore(slug: string): Promise<PublicStorefront | null> {
    return withDb((db) => {
      const store = db.stores.find((item) => item.slug === slug)
      if (!store) return null
      const professionals = db.profiles
        .filter((item) => item.storeId === store.id && item.active && item.attends)
        .map((item) => ({ id: item.id, fullName: item.fullName, role: item.role }))
      const services = db.services
        .filter((item) => item.storeId === store.id && item.active)
        .map((item) => serviceView(db, item, null))
      return {
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          vertical: store.vertical,
          phone: store.phone,
          address: store.address,
          timezone: store.timezone,
          inviteCode: null,
          basePriceCents: store.basePriceCents,
          seatPriceCents: store.seatPriceCents,
          brandColor: store.brandColor ?? null,
          logoData: store.logoData ?? null,
        },
        professionals,
        services,
        hours: db.hours.filter((hour) => hour.storeId === store.id).map(hourView),
      }
    })
  },

  async publicSlots(slug: string, query: { professionalId?: string; day?: string; serviceIds?: string }) {
    return withDb((db) => {
      const store = db.stores.find((item) => item.slug === slug)
      if (!store) throw new HttpError(404, "Loja não encontrada.")
      return computeSlots(db, store.id, query, null)
    })
  },

  async publicBook(slug: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const store = db.stores.find((item) => item.slug === slug)
      if (!store) throw new HttpError(404, "Loja não encontrada.")
      return book(db, {
        store,
        actor: null,
        professionalId: String(input.professionalId ?? ""),
        serviceIds: Array.isArray(input.serviceIds) ? input.serviceIds.map(String) : [],
        startsAt: String(input.startsAt ?? ""),
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        notes: typeof input.notes === "string" ? input.notes : "",
        source: "online",
      })
    }, true)
  },

  async storeIdForSlug(slug: string) {
    return withDb((db) => db.stores.find((item) => item.slug === slug)?.id ?? null)
  },

  async billing(userId: string): Promise<BillingSnapshot> {
    return withDb((db) => {
      const owner = requireOwner(db, userId)
      return billingOf(db, storeOf(db, owner.storeId))
    })
  },

  async createBillingCheckout(userId: string, input: Record<string, unknown>) {
    const pageToken = id()
    const prepared = await withDb((db) => {
      const owner = requireOwner(db, userId)
      const store = storeOf(db, owner.storeId)
      const user = userById(db, userId)
      const cpfCnpj = onlyDigits(String(input.cpfCnpj ?? store.billingCpfCnpj ?? ""))
      if (!validCpfCnpj(cpfCnpj)) throw new HttpError(400, "Informe um CPF ou CNPJ válido.")
      store.billingCpfCnpj = cpfCnpj
      store.checkoutPageToken = pageToken
      const seats = seatCountOf(db, store.id)
      const totalCents = planCents(seats)
      touch(store.id)
      return {
        storeId: store.id,
        storeName: store.name,
        vertical: store.vertical,
        brandColor: store.brandColor ?? null,
        phone: store.phone,
        email: user.email,
        name: owner.fullName || user.name,
        cpfCnpj,
        seats,
        totalCents,
        customerId: store.asaasCustomerId ?? null,
        demo: isDemoBilling(),
        pageUrl: `${appBaseUrl()}/plano/pagar/${pageToken}`,
      }
    }, true)

    if (prepared.demo) {
      if (wantsLiveAsaas()) {
        throw new HttpError(
          503,
          "ASAAS_API_KEY não foi lida. No .env coloque SEM o $ inicial: ASAAS_API_KEY=aact_prod_... e rode: pm2 restart agenda-api --update-env",
        )
      }
      return withDb((db) => {
        const store = storeOf(db, prepared.storeId)
        store.billingStatus = "pending"
        store.checkoutUrl = prepared.pageUrl
        store.asaasPayUrl = null
        store.asaasCheckoutId = `demo_${prepared.storeId}`
        store.checkoutPageToken = pageToken
        store.nextDueDate = nextDueDateIso()
        touch(store.id)
        return {
          ...billingOf(db, store),
          checkoutUrl: prepared.pageUrl,
        }
      }, true)
    }

    let customerId = prepared.customerId
    if (!customerId) {
      const customer = await asaasCreateCustomer({
        name: prepared.name,
        email: prepared.email,
        cpfCnpj: prepared.cpfCnpj,
        phone: prepared.phone,
        externalReference: prepared.storeId,
      })
      customerId = customer.id
      await withDb((db) => {
        const store = storeOf(db, prepared.storeId)
        store.asaasCustomerId = customerId
        touch(store.id)
        return true
      }, true)
    }

    const checkout = await asaasCreateCheckout({
      customer: customerId!,
      value: planValueReais(prepared.totalCents),
      nextDueDate: nextDueDateIso(),
      externalReference: prepared.storeId,
      description: `Agenda · ${prepared.storeName} · ${prepared.seats} atendente(s)`,
      successUrl: `${appBaseUrl()}/plano/ok`,
      cancelUrl: `${appBaseUrl()}/plano/pagar/${pageToken}`,
    })

    return withDb((db) => {
      const store = storeOf(db, prepared.storeId)
      store.billingStatus = "pending"
      store.asaasCustomerId = customerId
      store.asaasCheckoutId = checkout.id
      store.asaasPayUrl = checkout.url
      store.checkoutPageToken = pageToken
      store.checkoutUrl = prepared.pageUrl
      store.nextDueDate = nextDueDateIso()
      // Limpa qualquer id de simulação antigo ao gerar checkout real.
      if (store.asaasSubscriptionId?.startsWith("demo_")) store.asaasSubscriptionId = null
      touch(store.id)
      return {
        ...billingOf(db, store),
        checkoutUrl: prepared.pageUrl,
      }
    }, true)
  },

  async checkoutPage(token: string) {
    return withDb((db) => {
      const store = db.stores.find((item) => item.checkoutPageToken === token)
      if (!store) throw new HttpError(404, "Checkout não encontrado ou já expirou.")
      const seats = seatCountOf(db, store.id)
      return {
        token,
        storeName: store.name,
        vertical: store.vertical,
        brandColor: store.brandColor ?? null,
        logoData: store.logoData ?? null,
        status: store.billingStatus ?? "none",
        demo: isDemoBilling(store),
        basePriceCents: store.basePriceCents,
        seatPriceCents: store.seatPriceCents,
        seatCount: seats,
        planCents: planCents(seats),
        payUrl: store.asaasPayUrl ?? null,
        nextDueDate: store.nextDueDate ?? null,
      }
    })
  },

  async confirmDemoBilling(userId: string) {
    return withDb((db) => {
      const owner = requireOwner(db, userId)
      const store = storeOf(db, owner.storeId)
      if (!isDemoBilling(store)) {
        throw new HttpError(400, "Pagamento só pelo checkout da Asaas. Simulação desligada neste servidor.")
      }
      store.billingStatus = "active"
      store.lastPaidAt = new Date().toISOString()
      store.nextDueDate = nextDueDateIso(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      store.checkoutUrl = null
      store.asaasPayUrl = null
      store.asaasCheckoutId = store.asaasCheckoutId || `demo_${store.id}`
      store.asaasSubscriptionId = store.asaasSubscriptionId || `demo_sub_${store.id}`
      touch(store.id)
      return billingOf(db, store)
    }, true)
  },

  async confirmDemoBillingByToken(token: string) {
    return withDb((db) => {
      const store = db.stores.find((item) => item.checkoutPageToken === token)
      if (!store) throw new HttpError(404, "Checkout não encontrado.")
      if (!isDemoBilling(store)) {
        throw new HttpError(400, "Pagamento só pelo checkout da Asaas. Simulação desligada neste servidor.")
      }
      const seats = seatCountOf(db, store.id)
      store.billingStatus = "active"
      store.lastPaidAt = new Date().toISOString()
      store.nextDueDate = nextDueDateIso(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      store.checkoutUrl = null
      store.asaasPayUrl = null
      store.asaasCheckoutId = store.asaasCheckoutId || `demo_${store.id}`
      store.asaasSubscriptionId = store.asaasSubscriptionId || `demo_sub_${store.id}`
      touch(store.id)
      return {
        ok: true,
        storeName: store.name,
        nextDueDate: store.nextDueDate,
        planCents: planCents(seats),
        lastPaidAt: store.lastPaidAt,
      }
    }, true)
  },

  async asaasWebhook(input: Record<string, unknown>) {
    const event = String(input.event ?? "")
    const payment = (input.payment ?? null) as Record<string, unknown> | null
    const subscription = (input.subscription ?? null) as Record<string, unknown> | null
    const checkout = (input.checkout ?? null) as Record<string, unknown> | null

    const external =
      (typeof payment?.externalReference === "string" && payment.externalReference) ||
      (typeof subscription?.externalReference === "string" && subscription.externalReference) ||
      (typeof checkout?.externalReference === "string" && checkout.externalReference) ||
      null
    const subscriptionId =
      (typeof payment?.subscription === "string" && payment.subscription) ||
      (typeof subscription?.id === "string" && subscription.id) ||
      null
    const customerId =
      (typeof payment?.customer === "string" && payment.customer) ||
      (typeof subscription?.customer === "string" && subscription.customer) ||
      null

    return withDb((db) => {
      const store =
        (external ? db.stores.find((item) => item.id === external) : null) ||
        (subscriptionId ? db.stores.find((item) => item.asaasSubscriptionId === subscriptionId) : null) ||
        (customerId ? db.stores.find((item) => item.asaasCustomerId === customerId) : null) ||
        null
      if (!store) return { ok: true, matched: false }

      if (subscriptionId) store.asaasSubscriptionId = subscriptionId
      if (customerId) store.asaasCustomerId = customerId

      if (
        event === "PAYMENT_RECEIVED" ||
        event === "PAYMENT_CONFIRMED" ||
        event === "CHECKOUT_PAID" ||
        event === "SUBSCRIPTION_CREATED"
      ) {
        store.billingStatus = "active"
        store.lastPaidAt = new Date().toISOString()
        store.checkoutUrl = null
        if (typeof payment?.dueDate === "string") store.nextDueDate = payment.dueDate
        else if (typeof subscription?.nextDueDate === "string") store.nextDueDate = subscription.nextDueDate
      }
      if (event === "PAYMENT_OVERDUE" || event === "SUBSCRIPTION_INACTIVATED") {
        store.billingStatus = "past_due"
      }
      if (event === "SUBSCRIPTION_DELETED" || event === "CHECKOUT_CANCELED" || event === "CHECKOUT_EXPIRED") {
        if (event.startsWith("CHECKOUT") && store.billingStatus === "active") {
          // checkout cancelado depois de ativo não derruba a assinatura
        } else if (event.startsWith("CHECKOUT")) {
          store.billingStatus = store.asaasSubscriptionId ? store.billingStatus : "none"
          store.checkoutUrl = null
        } else {
          store.billingStatus = "canceled"
        }
      }
      touch(store.id)
      return { ok: true, matched: true, storeId: store.id, status: store.billingStatus }
    }, true)
  },

  async reminders(userId: string) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const row = (db.reminders ?? []).find((item) => item.professionalId === profile.id)
      return { minutes: row?.minutes ?? [60] }
    })
  },

  async saveReminders(userId: string, input: Record<string, unknown>) {
    return withDb((db) => {
      const profile = requireProfile(db, userId)
      const minutes = cleanReminders(input.minutes)
      if (!db.reminders) db.reminders = []
      const row = db.reminders.find((item) => item.professionalId === profile.id)
      if (row) row.minutes = minutes
      else db.reminders.push({ professionalId: profile.id, minutes })
      touch(profile.storeId)
      return { minutes }
    }, true)
  },
}

function cleanReminders(value: unknown) {
  if (!Array.isArray(value)) throw new HttpError(400, "Escolha os avisos.")
  const minutes = [...new Set(value.map((item) => Number(item)))]
  if (minutes.some((item) => !Number.isInteger(item) || item < 5 || item > 24 * 60)) {
    throw new HttpError(400, "Cada aviso fica entre 5 minutos e 24 horas.")
  }
  if (minutes.length > 5) throw new HttpError(400, "Dá para marcar no máximo 5 avisos por horário.")
  return minutes.sort((a, b) => b - a)
}

function join(db: DB, userId: string, code: unknown, name: string) {
  if (profileOf(db, userId)) throw new HttpError(409, "Essa conta já está ligada a uma loja.")
  const invite = typeof code === "string" ? code.trim().toUpperCase() : ""
  const store = db.stores.find((item) => item.inviteCode === invite)
  if (!store) throw new HttpError(404, "Código da equipe não encontrado.")
  const fallback = ensureDefaultProfession(db, store.id)
  db.profiles.push({
    id: userId,
    storeId: store.id,
    role: "professional",
    fullName: name,
    active: true,
    attends: true,
    professionId: fallback.id,
    createdAt: new Date().toISOString(),
  })
  db.commissions.push({ professionalId: userId, storeId: store.id, kind: "percent", amount: 50 })
  touch(store.id)
}

function readProfessionId(db: DB, storeId: string, value: unknown, required: boolean) {
  if (value === null || value === "" || value === undefined) {
    if (required) {
      const fallback = ensureDefaultProfession(db, storeId)
      return fallback.id
    }
    return null
  }
  const professionId = String(value)
  const row = db.professions.find((item) => item.id === professionId && item.storeId === storeId && item.active)
  if (!row) throw new HttpError(400, "Escolha uma profissão válida.")
  return row.id
}

function assignProfessions(db: DB, storeId: string, serviceId: string, value: unknown) {
  let ids: string[]
  if (Array.isArray(value) && value.length > 0) {
    ids = value.map(String)
  } else {
    const fallback = ensureDefaultProfession(db, storeId)
    ids = [fallback.id]
  }
  for (const professionId of ids) {
    if (!db.professions.some((item) => item.id === professionId && item.storeId === storeId)) {
      throw new HttpError(400, "Há uma profissão na lista que não existe nesta loja.")
    }
  }
  db.links = db.links.filter((link) => link.serviceId !== serviceId)
  for (const professionId of ids) db.links.push({ professionId, serviceId })
}

function hourView(hour: DB["hours"][number]): BusinessHour {
  return {
    weekday: hour.weekday,
    start: hour.start,
    end: hour.end,
    enabled: hour.enabled,
    professionalId: hour.professionalId,
  }
}

function blockView(block: BlockRow) {
  return {
    id: block.id,
    professionalId: block.professionalId,
    startsAt: block.startsAt,
    endsAt: block.endsAt,
    reason: block.reason,
  }
}

function computeSlots(db: DB, storeId: string, query: { professionalId?: string; day?: string; serviceIds?: string; except?: string }, actor: ProfileRow | null) {
  if (!query.day || !/^\d{4}-\d{2}-\d{2}$/.test(query.day)) throw new HttpError(400, "Escolha o dia.")
  const professional = db.profiles.find((item) => item.id === query.professionalId && item.storeId === storeId)
  if (!professional || !professional.active || !professional.attends) throw new HttpError(404, "Profissional não encontrado.")
  if (actor && actor.role !== "owner" && actor.id !== professional.id) {
    throw new HttpError(403, "Você só vê a própria agenda.")
  }
  const serviceIds = (query.serviceIds ?? "").split(",").map((item) => item.trim()).filter(Boolean)
  const services = serviceIds.map((serviceId) => {
    const service = db.services.find((item) => item.id === serviceId && item.storeId === storeId && item.active)
    if (!service || !personOffersService(db, professional.id, serviceId, actor)) {
      throw new HttpError(400, "Escolha serviços que essa pessoa realiza.")
    }
    return service
  })
  if (services.length === 0) throw new HttpError(400, "Escolha ao menos um serviço.")
  const hour = effectiveHour(db, storeId, professional.id, weekdayIndex(query.day))
  if (!hour?.enabled) return []
  return buildSlots({
    day: query.day,
    open: hour.start,
    close: hour.end,
    durationMin: services.reduce((sum, service) => sum + service.durationMin, 0),
    busy: busyRanges(db, storeId, professional.id, query.except),
  })
}

