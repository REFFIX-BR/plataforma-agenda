"use client"

import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"
import { api } from "@/lib/api"
import { formatBRL } from "@rumo/core"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

type CheckoutPage = {
  token: string
  storeName: string
  vertical: string
  brandColor: string | null
  logoData: string | null
  status: string
  demo: boolean
  basePriceCents: number
  seatPriceCents: number
  seatCount: number
  planCents: number
  payUrl: string | null
  nextDueDate: string | null
}

function formatDue(iso: string | null) {
  if (!iso) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split("-").reverse().join("/")
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("pt-BR")
}

export default function CheckoutPayPage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const [page, setPage] = useState<CheckoutPage | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    void api<CheckoutPage>(`/api/billing/page/${encodeURIComponent(token)}`)
      .then((next) => {
        setPage(next)
        if (next.status === "active") setDone(true)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Checkout indisponível."))
  }, [token])

  async function pay() {
    if (!page) return
    if (page.payUrl) {
      window.location.href = page.payUrl
      return
    }
    setError("Link de pagamento ainda não ficou pronto. Volte ao app e gere de novo.")
  }

  if (error && !page) {
    return (
      <ThemeScope className="min-h-screen">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
          <BrandMark href={null} size="md" priority />
          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-[0.18em] text-[color:var(--muted)]">CHECKOUT</p>
            <h1 className="serif text-4xl">Link inválido</h1>
            <p className="text-lg text-[color:var(--muted)]">{error}</p>
          </div>
        </main>
      </ThemeScope>
    )
  }

  if (!page) {
    return (
      <ThemeScope className="min-h-screen">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
          <BrandMark href={null} size="md" priority />
          <p className="text-[color:var(--muted)]">Preparando seu checkout...</p>
        </main>
      </ThemeScope>
    )
  }

  if (done || page.status === "active") {
    const paidDue = formatDue(page.nextDueDate)
    return (
      <ThemeScope vertical={page.vertical} brandColor={page.brandColor} unified className="min-h-screen">
        <main className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center overflow-hidden px-6 py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,color-mix(in_srgb,var(--primary)_28%,transparent),transparent_42%),radial-gradient(circle_at_90%_80%,color-mix(in_srgb,var(--accent)_55%,transparent),transparent_40%)]" />
          <div className="relative space-y-5">
            <BrandMark href={null} size="md" priority />
            <p className="text-sm font-semibold tracking-[0.18em] text-[color:var(--primary)]">PAGAMENTO CONCLUÍDO</p>
            <h1 className="serif text-5xl leading-none">Tudo certo</h1>
            <p className="text-lg text-[color:var(--muted)]">
              O pagamento de {formatBRL(page.planCents)} para {page.storeName} foi confirmado. Volte ao app — a agenda já está liberada.
            </p>
            {paidDue && (
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)]/90 px-5 py-4">
                <p className="text-xs font-semibold tracking-[0.14em] text-[color:var(--muted)]">PRÓXIMO VENCIMENTO</p>
                <p className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">{paidDue}</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">Renovação automática mensal de {formatBRL(page.planCents)}</p>
              </div>
            )}
          </div>
        </main>
      </ThemeScope>
    )
  }

  const seatsCents = page.seatCount * page.seatPriceCents
  const dueLabel = formatDue(page.nextDueDate)
  const seatLabel =
    page.seatCount === 0
      ? "Nenhum atendente extra"
      : `${page.seatCount} atendente${page.seatCount === 1 ? "" : "s"} × ${formatBRL(page.seatPriceCents)}`

  return (
    <ThemeScope vertical={page.vertical} brandColor={page.brandColor} unified className="min-h-screen">
      <main className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,color-mix(in_srgb,var(--primary)_26%,transparent),transparent_40%),radial-gradient(circle_at_90%_12%,color-mix(in_srgb,var(--accent)_48%,transparent),transparent_34%),linear-gradient(180deg,transparent,color-mix(in_srgb,var(--bg)_90%,black)_82%)]" />

        <div className="relative mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-5 py-10 md:px-8 md:py-14">
          <header className="flex flex-col items-center gap-3 text-center">
            <BrandMark href={null} size="lg" priority className="mx-auto object-center" />
            <p className="text-sm text-[color:var(--muted)]">Checkout seguro · Agenda</p>
          </header>

          <section className="overflow-hidden rounded-[30px] border border-[color:var(--line)] bg-[color:var(--surface)]/95 shadow-[0_34px_90px_-50px_rgba(0,0,0,0.5)] backdrop-blur">
            <div className="border-b border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--primary)_8%,var(--surface))] px-6 py-5 md:px-8">
              <div className="flex items-center gap-3">
                {page.logoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.logoData} alt="" className="h-12 w-12 rounded-2xl object-cover shadow-sm" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-base font-bold text-[color:var(--on-primary)]">
                    {page.storeName.trim().slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 text-left">
                  <p className="text-xs font-semibold tracking-[0.16em] text-[color:var(--muted)]">LOJA</p>
                  <h1 className="truncate serif text-2xl leading-none md:text-3xl">{page.storeName}</h1>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-7 md:px-8 md:py-8">
              <div className="space-y-3 text-center">
                <span className="inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-[color:var(--primary)]">
                  1 MÊS DE ACESSO
                </span>
                <p className="serif text-5xl tracking-tight md:text-6xl">{formatBRL(page.planCents)}</p>
                <p className="text-base leading-relaxed text-[color:var(--muted)]">
                  Você está pagando <strong className="text-[color:var(--ink)]">1 mês</strong> do plano Agenda para {page.storeName}.
                  A cobrança renova automaticamente no mês seguinte.
                </p>
              </div>

              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg)]/70 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[color:var(--muted)]">Período</span>
                  <strong>1 mês</strong>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-[color:var(--line)] pt-3 text-sm">
                  <span className="text-[color:var(--muted)]">Renovação</span>
                  <strong>Mensal automática</strong>
                </div>
                {dueLabel && (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[color:var(--line)] pt-3 text-sm">
                    <span className="text-[color:var(--muted)]">Próximo vencimento</span>
                    <strong>{dueLabel}</strong>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <p className="text-xs font-semibold tracking-[0.14em] text-[color:var(--muted)]">RESUMO DO MÊS</p>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Conta administradora</span>
                  <strong>{formatBRL(page.basePriceCents)}</strong>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[color:var(--muted)]">{seatLabel}</span>
                  <strong>{formatBRL(seatsCents)}</strong>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-[color:var(--line)] pt-3 text-base">
                  <span className="font-semibold">Total deste mês</span>
                  <strong className="text-[color:var(--primary)]">{formatBRL(page.planCents)}</strong>
                </div>
              </div>

              <div className="grid gap-2 text-sm text-[color:var(--muted)]">
                <p>✓ Agenda, equipe e clientes liberados por 30 dias</p>
                <p>✓ Pagamento avulso via Pix na Asaas</p>
                <p>✓ Ao acabar o prazo, gere um novo Pix para renovar</p>
              </div>

              <button
                type="button"
                className="btn w-full rounded-2xl px-5 py-4 text-base"
                onClick={() => void pay()}
                disabled={busy}
              >
                {busy ? "Abrindo..." : `Pagar ${formatBRL(page.planCents)} · 30 dias`}
              </button>

              <p className="text-center text-xs leading-relaxed text-[color:var(--muted)]">
                Ao continuar, você vai para o Pix da Asaas. O acesso libera quando o pagamento confirmar.
              </p>

              {error && <p className="alert" role="alert">{error}</p>}
            </div>
          </section>

          <footer className="flex flex-col items-center gap-2 text-center text-sm text-[color:var(--muted)]">
            <BrandMark href={null} size="sm" className="mx-auto object-center opacity-80" />
            <p>Cobrança recorrente mensal · suporte Agenda</p>
          </footer>
        </div>
      </main>
    </ThemeScope>
  )
}
