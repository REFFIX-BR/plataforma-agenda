import { domain } from "@/server/domain"
import { subscribe } from "@/server/db"
import { HttpError } from "@/server/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ path: string[] }> }

function tokenFrom(request: Request) {
  const header = request.headers.get("authorization")
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim()
  const cookie = request.headers.get("cookie") ?? ""
  const match = cookie.match(/(?:^|;\s*)rumo_session=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `rumo_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`
}

function clearCookie() {
  return "rumo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
}

async function readBody(request: Request) {
  const text = await request.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new HttpError(400, "Não entendi os dados enviados.")
  }
}

function stream(storeId: string) {
  const encoder = new TextEncoder()
  let unsubscribe = () => {}
  let heartbeat: ReturnType<typeof setInterval> | undefined
  const body = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          unsubscribe()
          if (heartbeat) clearInterval(heartbeat)
        }
      }
      send("data: update\n\n")
      unsubscribe = subscribe(storeId, () => send("data: update\n\n"))
      heartbeat = setInterval(() => send(": ping\n\n"), 25000)
    },
    cancel() {
      unsubscribe()
      if (heartbeat) clearInterval(heartbeat)
    },
  })
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

async function handle(request: Request, path: string[]) {
  const method = request.method
  const url = new URL(request.url)
  const key = `${method} ${path.join("/")}`
  const token = tokenFrom(request)
  const body = method === "GET" || method === "DELETE" ? {} : await readBody(request)

  if (method === "GET" && path[0] === "stream") {
    const slug = url.searchParams.get("slug")
    const storeId = slug
      ? await domain.storeIdForSlug(slug)
      : (await domain.session(token))?.profile?.storeId ?? null
    if (!storeId) throw new HttpError(404, "Agenda não encontrada.")
    return stream(storeId)
  }

  if (key === "POST auth/signup") {
    const result = await domain.signup(body)
    return Response.json({ token: result.token, session: result.session }, { headers: { "Set-Cookie": sessionCookie(result.token) } })
  }
  if (key === "POST auth/login") {
    const result = await domain.login(body)
    return Response.json({ token: result.token, session: result.session }, { headers: { "Set-Cookie": sessionCookie(result.token) } })
  }
  if (key === "POST auth/logout") {
    await domain.logout(token)
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } })
  }
  if (key === "GET me") return Response.json(await domain.session(token))
  if (key === "GET health") return Response.json({ ok: true })
  if (key === "POST billing/webhook") {
    const secret = process.env.ASAAS_WEBHOOK_TOKEN?.trim()
    if (!secret) throw new HttpError(503, "ASAAS_WEBHOOK_TOKEN não configurado no servidor.")
    const header = request.headers.get("asaas-access-token") || request.headers.get("x-asaas-token") || ""
    if (header !== secret) throw new HttpError(401, "Webhook sem autorização.")
    return Response.json(await domain.asaasWebhook(body))
  }
  if (method === "GET" && path[0] === "billing" && path[1] === "page" && path[2]) {
    return Response.json(await domain.checkoutPage(decodeURIComponent(path[2])))
  }
  if (method === "POST" && path[0] === "billing" && path[1] === "page" && path[2] === "demo") {
    throw new HttpError(404, "Simulação de pagamento desligada em produção.")
  }

  const userId = await domain.userIdFromToken(token).catch((error: unknown) => {
    if (path[0] === "public") return null
    throw error
  })

  if (userId && method === "PATCH" && path[0] === "me" && path.length === 1) {
    return Response.json(await domain.updateAccount(userId, token, body))
  }
  if (userId && method === "DELETE" && path[0] === "me" && path.length === 1) {
    await domain.deleteAccount(userId)
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } })
  }

  if (path[0] === "public" && path.length >= 2) {
    const slug = decodeURIComponent(path[1])
    if (method === "GET" && path.length === 2) {
      const store = await domain.publicStore(slug)
      if (!store) throw new HttpError(404, "Loja não encontrada.")
      return Response.json(store)
    }
    if (method === "GET" && path[2] === "slots") {
      return Response.json(await domain.publicSlots(slug, {
        professionalId: url.searchParams.get("professionalId") ?? undefined,
        day: url.searchParams.get("day") ?? undefined,
        serviceIds: url.searchParams.get("serviceIds") ?? undefined,
      }))
    }
    if (method === "POST" && path[2] === "book") return Response.json(await domain.publicBook(slug, body), { status: 201 })
  }

  if (!userId) throw new HttpError(401, "Entre para continuar.")

  if (key === "POST stores") return Response.json(await domain.createStore(userId, body), { status: 201 })
  if (key === "PATCH store") return Response.json(await domain.updateStore(userId, body))
  if (key === "POST stores/join") return Response.json(await domain.joinStore(userId, body.code))
  if (key === "GET team") return Response.json(await domain.listTeam(userId))
  if (key === "POST team") return Response.json(await domain.createProfessional(userId, body), { status: 201 })
  if (method === "PATCH" && path[0] === "team" && path[1]) {
    await domain.updateProfessional(userId, path[1], body)
    return Response.json({ ok: true })
  }
  if (key === "GET professions") return Response.json(await domain.listProfessions(userId))
  if (key === "POST professions") return Response.json(await domain.createProfession(userId, body), { status: 201 })
  if (method === "PATCH" && path[0] === "professions" && path[1]) {
    return Response.json(await domain.updateProfession(userId, path[1], body))
  }
  if (method === "DELETE" && path[0] === "professions" && path[1]) {
    await domain.deleteProfession(userId, path[1])
    return Response.json({ ok: true })
  }
  if (key === "GET services") return Response.json(await domain.listServices(userId))
  if (key === "POST services") return Response.json(await domain.createService(userId, body), { status: 201 })
  if (method === "PATCH" && path[0] === "services" && path[1]) {
    return Response.json(await domain.updateService(userId, path[1], body))
  }
  if (key === "GET hours") return Response.json(await domain.listHours(userId))
  if (key === "PUT hours") {
    if (body.clear === true) {
      await domain.clearHours(userId, body.professionalId)
      return Response.json({ ok: true })
    }
    return Response.json(await domain.saveHours(userId, body.professionalId ?? null, body.hours))
  }
  if (key === "GET blocks") return Response.json(await domain.listBlocks(userId))
  if (key === "POST blocks") return Response.json(await domain.createBlock(userId, body), { status: 201 })
  if (method === "DELETE" && path[0] === "blocks" && path[1]) {
    await domain.deleteBlock(userId, path[1])
    return Response.json({ ok: true })
  }
  if (key === "GET clients") return Response.json(await domain.listClients(userId, url.searchParams.get("professionalId")))
  if (key === "POST clients") return Response.json(await domain.createClient(userId, body), { status: 201 })
  if (key === "GET appointments") {
    return Response.json(await domain.listAppointments(userId, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      professionalId: url.searchParams.get("professionalId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    }))
  }
  if (key === "POST appointments") return Response.json(await domain.createAppointment(userId, body), { status: 201 })
  if (method === "PATCH" && path[0] === "appointments" && path[1]) {
    return Response.json(await domain.setStatus(userId, path[1], body))
  }
  if (method === "POST" && path[0] === "appointments" && path[1] && path[2] === "repeat") {
    return Response.json(await domain.repeatAppointment(userId, path[1], body))
  }
  if (method === "POST" && path[0] === "appointments" && path[1] && path[2] === "cancel") {
    return Response.json(await domain.cancelAppointments(userId, path[1], body))
  }
  if (method === "POST" && path[0] === "appointments" && path[1] && path[2] === "restore") {
    return Response.json(await domain.restoreAppointments(userId, path[1], body))
  }
  if (key === "GET slots") {
    return Response.json(await domain.slots(userId, {
      professionalId: url.searchParams.get("professionalId") ?? undefined,
      day: url.searchParams.get("day") ?? undefined,
      serviceIds: url.searchParams.get("serviceIds") ?? undefined,
      except: url.searchParams.get("except") ?? undefined,
    }))
  }
  if (key === "GET finance") return Response.json(await domain.finance(userId, url.searchParams.get("anchor") ?? undefined))
  if (key === "GET reminders") return Response.json(await domain.reminders(userId))
  if (key === "PUT reminders") return Response.json(await domain.saveReminders(userId, body))
  if (key === "GET billing") return Response.json(await domain.billing(userId))
  if (key === "POST billing/checkout") return Response.json(await domain.createBillingCheckout(userId, body))
  if (key === "POST billing/demo-confirm") {
    throw new HttpError(404, "Simulação de pagamento desligada em produção.")
  }

  throw new HttpError(404, "Não encontrei esse caminho.")
}

async function dispatch(request: Request, context: Context) {
  try {
    const { path } = await context.params
    return await handle(request, path)
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status })
    console.error(error)
    return Response.json({ error: "Algo saiu do eixo. Tente de novo." }, { status: 500 })
  }
}

export const GET = dispatch
export const POST = dispatch
export const PUT = dispatch
export const PATCH = dispatch
export const DELETE = dispatch
