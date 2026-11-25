"use client"

import { BrandMark } from "@/components/brand-mark"
import { SessionProvider } from "@/components/session"
import { ThemeScope } from "@/components/theme-scope"
import { api } from "@/lib/api"
import type { SessionState } from "@rumo/core"
import { verticalById } from "@rumo/theme"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type ReactNode } from "react"

export default function PainelLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<SessionState | null>(null)

  const reload = useCallback(async () => {
    const next = await api<SessionState | null>("/api/me")
    if (!next) {
      router.replace("/entrar")
      return
    }
    if (!next.store || !next.profile) {
      router.replace("/comecar")
      return
    }
    setSession(next)
  }, [router])

  useEffect(() => {
    void reload().catch(() => router.replace("/entrar"))
  }, [reload, router])

  async function logout() {
    await api("/api/auth/logout", { method: "POST" })
    router.replace("/entrar")
  }

  if (!session?.store || !session.profile) {
    return <ThemeScope className="min-h-screen p-8">Abrindo a agenda...</ThemeScope>
  }

  const theme = verticalById(session.store.vertical)
  const owner = session.profile.role === "owner"
  const links = [
    ["/painel", "Agenda"],
    ["/painel/financeiro", "Financeiro"],
    ["/painel/clientes", theme.labels.clients],
    ...(owner
      ? [
          ["/painel/equipe", "Equipe"],
          ["/painel/servicos", theme.labels.services],
          ["/painel/horarios", "Horários"],
        ]
      : []),
  ]

  return (
    <ThemeScope vertical={session.store.vertical} brandColor={session.store.brandColor} unified className="min-h-screen">
      <SessionProvider value={{ session, reload }}>
        <div className="lg:grid lg:grid-cols-[230px_1fr]">
          <aside className="border-b border-[var(--line)] px-4 py-4 lg:min-h-screen lg:border-r lg:border-b-0">
            <BrandMark href="/painel" size="sm" />
            <p className="mt-3 font-semibold">{session.store.name}</p>
            <p className="muted text-sm">{theme.label}</p>
            <nav className="mt-4 flex gap-2 overflow-auto lg:grid">
              {links.map(([href, label]) => {
                const active = href === "/painel" ? pathname === href : pathname.startsWith(href)
                return <Link key={href} href={href} data-active={active} className="nav-link whitespace-nowrap">{label}</Link>
              })}
            </nav>
            <button type="button" onClick={() => void logout()} className="btn-ghost mt-4 w-full">Sair</button>
            <button
              type="button"
              className="btn-ghost mt-2 w-full text-[var(--danger)]"
              onClick={() => {
                const ok = window.confirm(
                  owner
                    ? "Excluir conta apaga a loja, a equipe, os clientes e a agenda. Não dá para desfazer. Continuar?"
                    : "Excluir conta remove seu acesso a esta loja. Não dá para desfazer. Continuar?",
                )
                if (!ok) return
                void api("/api/me", { method: "DELETE" })
                  .then(() => router.replace("/entrar"))
                  .catch((error: unknown) => {
                    window.alert(error instanceof Error ? error.message : "Não foi possível excluir a conta.")
                  })
              }}
            >
              Excluir conta
            </button>
          </aside>
          <div className="min-w-0 px-4 py-5 sm:px-6">{children}</div>
        </div>
      </SessionProvider>
    </ThemeScope>
  )
}
