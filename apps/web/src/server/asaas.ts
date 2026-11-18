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

export type AsaasCustomerAddress = {
  postalCode: string
  address: string
  addressNumber: string
  province: string
  /** Código IBGE do município — exigido pela Asaas no checkout. */
  city: number
  cityName: string
  complement?: string
}

export async function lookupBrazilAddress(postalCode: string): Promise<AsaasCustomerAddress> {
  const cep = onlyDigits(postalCode)
  if (cep.length !== 8) throw new HttpError(400, "Informe um CEP com 8 dígitos.")
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  const data = (await response.json().catch(() => ({}))) as {
    erro?: boolean
    logradouro?: string
    bairro?: string
    localidade?: string
    ibge?: string
    uf?: string
  }
  if (!response.ok || data.erro) throw new HttpError(400, "CEP não encontrado. Confira e tente de novo.")
  const address = (data.logradouro || "").trim() || "Endereço"
  const province = (data.bairro || "").trim() || (data.localidade || "").trim() || "Centro"
  const cityName = (data.localidade || "").trim()
  const city = Number(onlyDigits(String(data.ibge || "")))
  if (!cityName || !city) throw new HttpError(400, "Não deu para ler a cidade desse CEP.")
  return {
    postalCode: cep,
    address,
    addressNumber: "S/N",
    province,
    city,
    cityName,
  }
}

function customerPayload(input: {
  name: string
  email: string
  cpfCnpj: string
  phone?: string
  externalReference?: string
  address: AsaasCustomerAddress
}) {
  return {
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj,
    mobilePhone: input.phone || undefined,
    externalReference: input.externalReference,
    notificationDisabled: true,
    postalCode: onlyDigits(input.address.postalCode),
    address: input.address.address,
    addressNumber: input.address.addressNumber,
    complement: input.address.complement || undefined,
    province: input.address.province,
    city: input.address.city,
  }
}

export async function asaasCreateCustomer(input: {
  name: string
  email: string
  cpfCnpj: string
  phone?: string
  externalReference: string
  address: AsaasCustomerAddress
}) {
  return asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify(customerPayload(input)),
  })
}

export async function asaasUpdateCustomer(
  customerId: string,
  input: {
    name: string
    email: string
    cpfCnpj: string
    phone?: string
    address: AsaasCustomerAddress
  },
) {
  return asaasFetch<{ id: string }>(`/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    body: JSON.stringify(customerPayload(input)),
  })
}

export async function asaasFindCustomerByCpf(cpfCnpj: string) {
  const digits = onlyDigits(cpfCnpj)
  const data = await asaasFetch<{ data?: { id: string }[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(digits)}&limit=1`,
  )
  return data.data?.[0] ?? null
}

export async function asaasGetCustomer(customerId: string) {
  return asaasFetch<{
    id: string
    postalCode?: string | null
    address?: string | null
    addressNumber?: string | null
    province?: string | null
    city?: number | null
  }>(`/customers/${encodeURIComponent(customerId)}`)
}

/** Garante cliente Asaas com endereço completo (CEP/ViaCEP/IBGE). */
export async function asaasEnsureCustomerWithAddress(input: {
  customerId?: string | null
  name: string
  email: string
  cpfCnpj: string
  phone?: string
  externalReference: string
  address: AsaasCustomerAddress
}) {
  let customerId = input.customerId || null
  if (!customerId) {
    const found = await asaasFindCustomerByCpf(input.cpfCnpj)
    customerId = found?.id ?? null
  }

  if (!customerId) {
    const created = await asaasCreateCustomer(input)
    customerId = created.id
  } else {
    await asaasUpdateCustomer(customerId, input)
  }

  const current = await asaasGetCustomer(customerId)
  const hasAddress = Boolean(
    onlyDigits(String(current.postalCode || "")).length === 8 &&
      String(current.address || "").trim() &&
      String(current.addressNumber || "").trim() &&
      String(current.province || "").trim() &&
      current.city,
  )
  if (!hasAddress) {
    // Segunda tentativa: só campos de endereço (Asaas preenche cidade pelo CEP).
    await asaasFetch(`/customers/${encodeURIComponent(customerId)}`, {
      method: "PUT",
      body: JSON.stringify({
        postalCode: onlyDigits(input.address.postalCode),
        address: input.address.address,
        addressNumber: input.address.addressNumber,
        complement: input.address.complement || undefined,
        province: input.address.province,
        city: input.address.city,
      }),
    })
  }

  return customerId
}

function clipAsaasName(value: string, max = 30) {
  const text = value.replace(/\s+/g, " ").trim()
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

function checkoutBody(input: {
  value: number
  nextDueDate: string
  externalReference: string
  description: string
  successUrl: string
  cancelUrl: string
  customerData?: Record<string, unknown>
}) {
  const itemName = clipAsaasName(input.description, 30)
  const itemDescription = clipAsaasName(input.description, 120)
  return {
    billingTypes: ["CREDIT_CARD"],
    chargeTypes: ["RECURRENT"],
    minutesToExpire: 60,
    externalReference: input.externalReference,
    ...(input.customerData ? { customerData: input.customerData } : {}),
    items: [
      {
        name: itemName,
        description: itemDescription,
        quantity: 1,
        value: input.value,
      },
    ],
    subscription: {
      cycle: "MONTHLY",
      nextDueDate: input.nextDueDate,
      description: itemDescription,
      externalReference: input.externalReference,
    },
    callback: {
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      expiredUrl: input.cancelUrl,
    },
  }
}

export async function asaasCreateCheckout(input: {
  name: string
  email: string
  cpfCnpj: string
  phone?: string
  address: AsaasCustomerAddress
  value: number
  nextDueDate: string
  externalReference: string
  description: string
  successUrl: string
  cancelUrl: string
}) {
  // Assinatura recorrente: CREDIT_CARD + RECURRENT.
  // Nunca envia `customer` (id) — clientes antigos sem endereço quebram o checkout.
  // Envia customerData completo; se a Asaas ainda recusar, tenta sem pré-preenchimento.
  const customerData = {
    name: input.name,
    email: input.email,
    cpfCnpj: onlyDigits(input.cpfCnpj),
    phone: input.phone || undefined,
    mobilePhone: input.phone || undefined,
    postalCode: onlyDigits(input.address.postalCode),
    address: input.address.address,
    addressNumber: input.address.addressNumber,
    complement: input.address.complement || undefined,
    province: input.address.province,
    city: input.address.city,
  }

  try {
    const created = await asaasFetch<{ id: string }>("/checkouts", {
      method: "POST",
      body: JSON.stringify(checkoutBody({ ...input, customerData })),
    })
    return { id: created.id, url: asaasCheckoutUrl(created.id) }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ""
    const addressBlocked =
      /address|addressNumber|postalCode|province|city|customer informado/i.test(message)
    if (!addressBlocked) throw cause
    const created = await asaasFetch<{ id: string }>("/checkouts", {
      method: "POST",
      body: JSON.stringify(checkoutBody(input)),
    })
    return { id: created.id, url: asaasCheckoutUrl(created.id) }
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
