import { HttpError } from "./errors"

type AsaasErrorBody = {
  errors?: { description?: string; code?: string }[]
  message?: string
}

/**
 * Chaves Asaas oficiais começam com `$aact_...`.
 * No .env NÃO coloque o $ inicial (o dotenv engole). Use:
 *   ASAAS_API_KEY=aact_prod_sua_chave_aqui
 * O código recoloca o $ na hora de chamar a Asaas.
 */
export function resolveAsaasApiKey() {
  let key = (process.env.ASAAS_API_KEY || "").trim()
  if (!key) return ""
  if (
    (key.startsWith("'") && key.endsWith("'")) ||
    (key.startsWith('"') && key.endsWith('"'))
  ) {
    key = key.slice(1, -1).trim()
  }
  // Remove $ / $$ sobrando no começo e normaliza.
  while (key.startsWith("$")) key = key.slice(1)
  key = key.trim()
  if (!key) return ""
  if (/^aact_/i.test(key)) return `$${key}`
  // Se já veio completa por outro meio
  if (/^\$aact_/i.test(key)) return key
  return key.startsWith("$") ? key : `$${key}`
}

export function asaasConfigured() {
  return Boolean(resolveAsaasApiKey())
}

export function asaasSandbox() {
  if (process.env.ASAAS_USE_SANDBOX != null) {
    return !["0", "false", "no"].includes(String(process.env.ASAAS_USE_SANDBOX).toLowerCase())
  }
  const env = (process.env.ASAAS_ENV || "sandbox").toLowerCase()
  return env !== "production"
}

export function asaasCheckoutUrl(checkoutId: string) {
  const host = asaasSandbox() ? "https://sandbox.asaas.com" : "https://asaas.com"
  return `${host}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`
}

function asaasBaseUrl() {
  const custom = process.env.ASAAS_API_URL?.trim().replace(/\/$/, "")
  if (custom) return custom
  return asaasSandbox() ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3"
}

function asaasHeaders() {
  const key = resolveAsaasApiKey()
  if (!key) {
    throw new HttpError(
      503,
      "Asaas não configurada. No .env use ASAAS_API_KEY='$$aact_...' (dois $$ no início) e reinicie o PM2.",
    )
  }
  return {
    "Content-Type": "application/json",
    access_token: key,
  }
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${asaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...asaasHeaders(),
      ...(init?.headers ?? {}),
    },
  })
  const data = (await response.json().catch(() => ({}))) as AsaasErrorBody & T
  if (!response.ok) {
    const detail = data.errors?.map((item) => item.description).filter(Boolean).join(" ") || data.message
    throw new HttpError(response.status >= 400 && response.status < 500 ? 400 : 502, detail || "A Asaas não aceitou a cobrança.")
  }
  return data as T
}

export async function asaasCreateCustomer(input: {
  name: string
  email: string
  cpfCnpj: string
  phone?: string
  externalReference: string
}) {
  return asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      mobilePhone: input.phone || undefined,
      externalReference: input.externalReference,
      notificationDisabled: true,
    }),
  })
}

export async function asaasCreateCheckout(input: {
  customer: string
  value: number
  nextDueDate: string
  externalReference: string
  description: string
  successUrl: string
  cancelUrl: string
}) {
  const created = await asaasFetch<{ id: string }>("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      billingTypes: ["PIX", "CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 60,
      externalReference: input.externalReference,
      customer: input.customer,
      items: [
        {
          name: input.description,
          description: input.description,
          quantity: 1,
          value: input.value,
        },
      ],
      subscription: {
        cycle: "MONTHLY",
        nextDueDate: input.nextDueDate,
        description: input.description,
        externalReference: input.externalReference,
      },
      callback: {
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        expiredUrl: input.cancelUrl,
      },
    }),
  })
  return {
    id: created.id,
    url: asaasCheckoutUrl(created.id),
  }
}

export async function asaasUpdateSubscriptionValue(subscriptionId: string, value: number, description: string) {
  return asaasFetch<{ id: string }>(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({
      value,
      updatePendingPayments: true,
      description,
    }),
  })
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

export function validCpfCnpj(value: string) {
  const digits = onlyDigits(value)
  return digits.length === 11 || digits.length === 14
}

export function planValueReais(planCents: number) {
  return Math.round(planCents) / 100
}

export function nextDueDateIso(from = new Date()) {
  const date = new Date(from)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
