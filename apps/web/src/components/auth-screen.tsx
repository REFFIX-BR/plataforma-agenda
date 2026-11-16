"use client"

import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"
import { api } from "@/lib/api"
import { formatBRL, type SessionState } from "@rumo/core"
import { BASE_PRICE_CENTS, SEAT_PRICE_CENTS } from "@rumo/theme"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function AuthScreen({ mode }: { mode: "login" | "signup" | "join" }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const result = mode === "login"
        ? await api<{ session: SessionState }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
        : await api<{ session: SessionState }>("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify({ name, email, password, inviteCode: mode === "join" ? inviteCode : undefined }),
          })
      router.push(result.session.store ? "/painel" : "/comecar")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.")
    } finally {
      setPending(false)
    }
  }

  const title = mode === "login" ? "Entrar" : mode === "join" ? "Entrar na equipe" : "Criar a conta"

  return (
    <ThemeScope className="min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <BrandMark size="md" priority />
        {mode !== "login" && <h1 className="mt-6 text-4xl">{title}</h1>}
        <p className={`muted ${mode === "login" ? "mt-4" : "mt-2"}`}>
          {mode === "join"
            ? "Use o código que a administração da casa passou."
            : mode === "signup"
              ? "Quem cria a conta administra a loja. A equipe é cadastrada depois, por você."
              : "Entre com o e-mail e a senha da sua conta."}
        </p>

        {mode === "signup" && (
          <div className="card mt-5 space-y-3 p-4">
            <span className="inline-flex rounded-full bg-[color:var(--primary)] px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[color:var(--on-primary)]">
              7 DIAS GRÁTIS
            </span>
            <h2 className="text-lg font-semibold">Teste a Agenda sem pagar</h2>
            <p className="muted text-sm leading-relaxed">
              Ao criar a loja, você ganha 7 dias para conhecer tudo. Depois o plano fica em {formatBRL(BASE_PRICE_CENTS)}/mês.
              Cada conta de atendente adiciona {formatBRL(SEAT_PRICE_CENTS)} na próxima mensalidade.
            </p>
            <ul className="space-y-1.5 text-sm">
              <li>Sem cartão na criação da conta</li>
              <li>Agenda, clientes e equipe liberados no teste</li>
              <li>+ {formatBRL(SEAT_PRICE_CENTS)} por conta ativa na próxima mensalidade</li>
              <li>Assine só se quiser continuar depois</li>
            </ul>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 grid gap-3">
          {mode !== "login" && (
            <label className="field"><span>Seu nome</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          )}
          <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className="field"><span>Senha</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></label>
          {mode === "join" && (
            <label className="field"><span>Código da equipe</span><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} required /></label>
          )}
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn" disabled={pending}>
            {pending ? "Salvando..." : mode === "signup" ? "Criar conta e começar o teste" : title}
          </button>
        </form>
        <p className="muted mt-4 text-sm">
          {mode === "login" ? <Link href="/criar-conta">Criar uma casa</Link> : <Link href="/entrar">Já tenho conta</Link>}
          {" · "}
          <Link href="/equipe">Código da equipe</Link>
        </p>
      </main>
    </ThemeScope>
  )
}
