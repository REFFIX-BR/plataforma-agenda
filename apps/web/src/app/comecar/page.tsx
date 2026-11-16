"use client"

import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"
import { api } from "@/lib/api"
import type { SessionState } from "@rumo/core"
import { verticalList, type VerticalId } from "@rumo/theme"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function StartPage() {
  const router = useRouter()
  const [vertical, setVertical] = useState<VerticalId>("estetica")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const theme = verticalList.find((item) => item.id === vertical) ?? verticalList[0]

  useEffect(() => {
    api<SessionState | null>("/api/me")
      .then((session) => {
        if (!session) router.replace("/entrar")
        else if (session.store) router.replace("/painel")
      })
      .catch(() => router.replace("/entrar"))
  }, [router])

  async function createStore(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await api("/api/stores", { method: "POST", body: JSON.stringify({ name, vertical, phone, address }) })
      router.push("/painel")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a casa.")
    } finally {
      setPending(false)
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await api("/api/stores/join", { method: "POST", body: JSON.stringify({ code }) })
      router.push("/painel")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Código não encontrado.")
    } finally {
      setPending(false)
    }
  }

  return (
    <ThemeScope vertical={vertical} unified className="min-h-screen">
      <main className="mx-auto grid max-w-5xl gap-8 px-5 py-10 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <BrandMark size="md" priority />
          <p className="muted mt-5 text-sm uppercase tracking-[0.16em]">Passo único</p>
          <h1 className="mt-2 text-4xl">Qual é o rumo da casa?</h1>
          <p className="muted mt-2 max-w-xl">A agenda tem uma cara só. O ramo muda o vocabulário e os serviços. A cor quem administra escolhe depois, e a equipe vê a mesma.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {verticalList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setVertical(item.id)}
                className="card p-3 text-left"
                style={{ borderColor: item.id === vertical ? "var(--primary)" : "var(--line)", borderWidth: item.id === vertical ? 2 : 1 }}
              >
                <strong>{item.label}</strong>
                <span className="muted mt-1 block text-sm">{item.pitch}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="grid content-start gap-4">
          <form onSubmit={createStore} className="card grid gap-3 p-4">
            <h2 className="text-2xl">Abrir {theme.labels.store}</h2>
            <label className="field"><span>Nome da casa</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label className="field"><span>Telefone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label className="field"><span>Endereço</span><input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
            <button className="btn" disabled={pending}>Criar e abrir a agenda</button>
          </form>
          <form onSubmit={join} className="card grid gap-3 p-4">
            <h2 className="text-2xl">Sou da equipe</h2>
            <label className="field"><span>Código</span><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required /></label>
            <button className="btn-ghost" disabled={pending}>Entrar com o código</button>
          </form>
          {error && <p className="alert" role="alert">{error}</p>}
        </section>
      </main>
    </ThemeScope>
  )
}
