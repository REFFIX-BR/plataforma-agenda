import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { defaultProfessionName, verticalById } from "@rumo/theme"
import { loadFromPostgres, saveToPostgres, usingPostgres } from "./pg"

export type Role = "owner" | "professional"
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled"
export type AppointmentSource = "online" | "manual"
export type PaymentMethod = "cash" | "pix" | "card"
export type CommissionType = "percent" | "fixed"

export type UserRow = {
  id: string
  email: string
  passwordHash: string
  salt: string
  name: string
  createdAt: string
}

export type SessionRow = { token: string; userId: string; createdAt: string }

export type SubscriptionStatus = "trialing" | "pending" | "active" | "past_due" | "canceled" | "none"

export type StoreRow = {
  id: string
  name: string
  slug: string
  vertical: string
  phone: string
  address: string
  timezone: string
  inviteCode: string
  basePriceCents: number
  seatPriceCents: number
  brandColor?: string | null
  logoData?: string | null
  billingStatus?: SubscriptionStatus
  billingCpfCnpj?: string | null
  asaasCustomerId?: string | null
  asaasSubscriptionId?: string | null
  asaasCheckoutId?: string | null
  asaasPayUrl?: string | null
  checkoutPageToken?: string | null
  checkoutUrl?: string | null
  trialEndsAt?: string | null
  nextDueDate?: string | null
  lastPaidAt?: string | null
  createdAt: string
}

export type ProfileRow = {
  id: string
  storeId: string
  role: Role
  fullName: string
  active: boolean
  attends: boolean
  professionId?: string | null
  createdAt: string
}

export type ProfessionRow = {
  id: string
  storeId: string
  name: string
  active: boolean
  createdAt: string
}

export type CommissionRow = {
  professionalId: string
  storeId: string
  kind: CommissionType
  amount: number
}

export type ServiceRow = {
  id: string
  storeId: string
  name: string
  durationMin: number
  priceCents: number
  active: boolean
  createdAt: string
}

export type HourRow = {
  id: string
  storeId: string
  professionalId: string | null
  weekday: number
  start: string
  end: string
  enabled: boolean
}

export type BlockRow = {
  id: string
  storeId: string
  professionalId: string | null
  startsAt: string
  endsAt: string
  reason: string
}

export type ClientRow = {
  id: string
  storeId: string
  professionalId?: string
  name: string
  phone: string
  notes: string
  createdAt: string
}

export type AppointmentRow = {
  id: string
  storeId: string
  professionalId: string
  clientId: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  source: AppointmentSource
  notes: string
  totalCents: number
  commissionCents: number
  paymentMethod: PaymentMethod | null
  durationMin?: number
  seriesId?: string | null
  createdAt: string
}

export type ReminderRow = {
  professionalId: string
  minutes: number[]
}

export type ItemRow = {
  id: string
  appointmentId: string
  serviceId: string | null
  name: string
  priceCents: number
  durationMin: number
  commissionKind: CommissionType
  commissionAmount: number
}

export type ServiceLink = {
  serviceId: string
  professionId?: string
  professionalId?: string
}

export type DB = {
  users: UserRow[]
  sessions: SessionRow[]
  stores: StoreRow[]
  profiles: ProfileRow[]
  professions: ProfessionRow[]
  commissions: CommissionRow[]
  services: ServiceRow[]
  links: ServiceLink[]
  hours: HourRow[]
  blocks: BlockRow[]
  clients: ClientRow[]
  appointments: AppointmentRow[]
  items: ItemRow[]
  reminders: ReminderRow[]
}

const listeners = new Set<(storeId: string) => void>()
let queue: Promise<unknown> = Promise.resolve()
let pendingStore: string | null = null

export function emptyDb(): DB {
  return {
    users: [],
    sessions: [],
    stores: [],
    profiles: [],
    professions: [],
    commissions: [],
    services: [],
    links: [],
    hours: [],
    blocks: [],
    clients: [],
    appointments: [],
    items: [],
    reminders: [],
  }
}

function dbPath() {
  return process.env.RUMO_DB_PATH || path.join(process.cwd(), "data", "db.json")
}

function loadFromFile(): DB {
  const file = dbPath()
  if (!fs.existsSync(file)) return emptyDb()
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as DB
  return { ...emptyDb(), ...parsed }
}

function saveToFile(db: DB) {
  const file = dbPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(db, null, 2))
}

async function load(): Promise<DB> {
  if (usingPostgres()) {
    const payload = await loadFromPostgres()
    return { ...emptyDb(), ...payload }
  }
  return loadFromFile()
}

async function save(db: DB) {
  if (usingPostgres()) {
    await saveToPostgres(db)
    return
  }
  saveToFile(db)
}

export function touch(storeId: string) {
  pendingStore = storeId
}

export function publish(storeId: string) {
  for (const listener of listeners) {
    try {
      listener(storeId)
    } catch {
      listeners.delete(listener)
    }
  }
}

export function subscribe(storeId: string, listener: () => void) {
  const wrapped = (id: string) => {
    if (id === storeId) listener()
  }
  listeners.add(wrapped)
  return () => listeners.delete(wrapped)
}

function assignClientOwners(db: DB) {
  let changed = false
  for (const client of [...db.clients]) {
    if (client.professionalId) continue
    const appointments = db.appointments
      .filter((item) => item.clientId === client.id)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const professionals = [...new Set(appointments.map((item) => item.professionalId))]
    const owner = db.profiles.find((item) => item.storeId === client.storeId && item.role === "owner")
    client.professionalId = professionals[0] ?? owner?.id ?? ""
    changed = true
    for (const professionalId of professionals.slice(1)) {
      const copy: ClientRow = {
        ...client,
        id: randomBytes(16).toString("hex"),
        professionalId,
      }
      db.clients.push(copy)
      for (const appointment of appointments) {
        if (appointment.professionalId === professionalId) appointment.clientId = copy.id
      }
    }
  }
  return changed
}

function addTrialDays(iso: string, days: number) {
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function migrateBilling(db: DB) {
  let changed = false
  for (const store of db.stores) {
    if (store.billingCpfCnpj === undefined) {
      store.billingCpfCnpj = null
      changed = true
    }
    if (store.asaasCustomerId === undefined) {
      store.asaasCustomerId = null
      changed = true
    }
    if (store.asaasSubscriptionId === undefined) {
      store.asaasSubscriptionId = null
      changed = true
    }
    if (store.asaasCheckoutId === undefined) {
      store.asaasCheckoutId = null
      changed = true
    }
    if (store.asaasPayUrl === undefined) {
      store.asaasPayUrl = null
      changed = true
    }
    if (store.checkoutPageToken === undefined) {
      store.checkoutPageToken = null
      changed = true
    }
    if (store.checkoutUrl === undefined) {
      store.checkoutUrl = null
      changed = true
    }
    if (store.nextDueDate === undefined) {
      store.nextDueDate = null
      changed = true
    }
    if (store.lastPaidAt === undefined) {
      store.lastPaidAt = null
      changed = true
    }
    if (store.trialEndsAt === undefined || store.trialEndsAt === null) {
      // Lojas antigas ganham 7 dias a partir da migração para não travar o teste de uma vez.
      store.trialEndsAt = addTrialDays(new Date().toISOString(), 7)
      changed = true
    }
    if (!store.billingStatus || store.billingStatus === "none") {
      const paid = Boolean(store.asaasSubscriptionId)
      store.billingStatus = paid ? "active" : "trialing"
      changed = true
    }
  }
  return changed
}

function migrateProfessions(db: DB) {
  let changed = false
  if (!Array.isArray(db.professions)) {
    db.professions = []
    changed = true
  }
  for (const profile of db.profiles) {
    if (profile.professionId === undefined) {
      profile.professionId = null
      changed = true
    }
  }

  for (const store of db.stores) {
    const proper = defaultProfessionName(store.vertical)
    const themeLabel = verticalById(store.vertical).label
    for (const profession of db.professions.filter((item) => item.storeId === store.id)) {
      if (profession.name === "Geral" || profession.name === themeLabel) {
        profession.name = proper
        changed = true
      }
    }
  }

  const legacy = db.links.filter((link) => Boolean(link.professionalId) && !link.professionId)
  if (legacy.length === 0) return changed

  for (const store of db.stores) {
    const storeServices = new Set(db.services.filter((service) => service.storeId === store.id).map((service) => service.id))
    const storeLegacy = legacy.filter((link) => storeServices.has(link.serviceId))
    if (storeLegacy.length === 0 && db.professions.some((item) => item.storeId === store.id)) continue

    const proper = defaultProfessionName(store.vertical)
    let profession = db.professions.find((item) => item.storeId === store.id && item.name === proper)
      ?? db.professions.find((item) => item.storeId === store.id && item.active)
    if (!profession) {
      profession = {
        id: randomBytes(16).toString("hex"),
        storeId: store.id,
        name: proper,
        active: true,
        createdAt: new Date().toISOString(),
      }
      db.professions.push(profession)
      changed = true
    }

    const people = new Set(storeLegacy.map((link) => link.professionalId!).filter(Boolean))
    for (const profile of db.profiles.filter((item) => item.storeId === store.id)) {
      if ((people.has(profile.id) || profile.attends) && !profile.professionId) {
        profile.professionId = profession.id
        changed = true
      }
    }

    for (const serviceId of new Set(storeLegacy.map((link) => link.serviceId))) {
      if (!db.links.some((link) => link.serviceId === serviceId && link.professionId === profession!.id)) {
        db.links.push({ serviceId, professionId: profession.id })
        changed = true
      }
    }
  }

  const next = db.links.filter((link) => Boolean(link.professionId))
  if (next.length !== db.links.length) {
    db.links = next
    changed = true
  }
  return changed
}

export function withDb<T>(fn: (db: DB) => T, write = false): Promise<T> {
  const run = queue.then(async () => {
    pendingStore = null
    const db = await load()
    const claimed = assignClientOwners(db)
    const migrated = migrateProfessions(db)
    const billing = migrateBilling(db)
    const result = fn(db)
    if (write || claimed || migrated || billing) {
      await save(db)
      if (pendingStore) publish(pendingStore)
    }
    pendingStore = null
    return result
  })
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
