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

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  no_show: "Faltou",
  cancelled: "Cancelado",
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  card: "Cartão de crédito ou débito",
}

export const WEEKDAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

export type SubscriptionStatus = "trialing" | "pending" | "active" | "past_due" | "canceled" | "none"

export type BillingAccess = "open" | "blocked"

export type SessionBilling = {
  status: SubscriptionStatus
  access: BillingAccess
  trialEndsAt: string | null
  nextDueDate: string | null
  daysLeft: number | null
  warnDays: 5 | 3 | 1 | null
  planCents: number
  seatCount: number
}

export type Store = {
  id: string
  name: string
  slug: string
  vertical: string
  phone: string
  address: string
  timezone: string
  inviteCode: string | null
  basePriceCents: number
  seatPriceCents: number
  brandColor: string | null
  logoData: string | null
}

export type BillingSnapshot = {
  status: SubscriptionStatus
  access: BillingAccess
  configured: boolean
  demo: boolean
  basePriceCents: number
  seatPriceCents: number
  seatCount: number
  planCents: number
  cpfCnpj: string | null
  checkoutUrl: string | null
  trialEndsAt: string | null
  nextDueDate: string | null
  daysLeft: number | null
  warnDays: 5 | 3 | 1 | null
  lastPaidAt: string | null
  asaasCustomerId: string | null
  asaasSubscriptionId: string | null
}

export type Profile = {
  id: string
  storeId: string
  role: Role
  fullName: string
  active: boolean
  attends: boolean
  professionId: string | null
  professionName: string | null
  commissionType: CommissionType
  commissionValue: number
}

export type Profession = {
  id: string
  name: string
  active: boolean
}

export type SessionState = {
  user: { id: string; email: string; name: string }
  profile: Profile | null
  store: Store | null
  seatCount: number
  planCents: number
  billing: SessionBilling | null
}

export type Service = {
  id: string
  name: string
  durationMin: number
  priceCents: number
  active: boolean
  professionIds: string[]
  professionalIds: string[]
}

export type BusinessHour = {
  weekday: number
  start: string
  end: string
  enabled: boolean
  professionalId: string | null
}

export type TimeBlock = {
  id: string
  professionalId: string | null
  startsAt: string
  endsAt: string
  reason: string
}

export type ClientRecord = {
  id: string
  professionalId: string
  professionalName: string
  name: string
  phone: string
  notes: string
  visits: number
  spentCents: number
  lastVisit: string | null
}

export type AppointmentView = {
  id: string
  professionalId: string
  professionalName: string
  role: Role
  clientId: string
  clientName: string
  clientPhone: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  source: AppointmentSource
  notes: string
  totalCents: number
  commissionCents: number
  paymentMethod: PaymentMethod | null
  services: { serviceId: string | null; name: string; priceCents: number; durationMin: number }[]
  seriesId?: string | null
  seriesAhead?: number
  cancelledFollowing?: number
}

export type Summary = {
  realizedCents: number
  forecastCents: number
  payableCents: number
  occupancy: number
  noShowRate: number
  completedCount: number
  noShowCount: number
  appointmentCount: number
}

export type PaymentBreakdown = {
  pixCents: number
  cashCents: number
  cardCents: number
  unsetCents: number
}

export type ServiceBreakdown = {
  name: string
  count: number
  totalCents: number
  payableCents: number
}

export type FinanceReport = {
  anchor: string
  weekStart: string
  monthStart: string
  day: Summary
  week: Summary
  month: Summary
  dayPayments: PaymentBreakdown
  weekPayments: PaymentBreakdown
  monthPayments: PaymentBreakdown
  professionals: {
    id: string
    name: string
    role: Role
    commissionType: CommissionType
    commissionValue: number
    day: Summary
    week: Summary
    month: Summary
    weekPayments: PaymentBreakdown
    weekServices: ServiceBreakdown[]
  }[]
  appointments: AppointmentView[]
}

export type TeamMember = Profile & { email: string }

export type PublicStorefront = {
  store: Store
  professionals: { id: string; fullName: string; role: Role }[]
  services: Service[]
  hours: BusinessHour[]
}
