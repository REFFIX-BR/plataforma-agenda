"use client"

import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"
import { formatBRL } from "@rumo/core"
import { BASE_PRICE_CENTS, SEAT_PRICE_CENTS, verticalList, type VerticalId } from "@rumo/theme"
import Link from "next/link"
import { useState } from "react"

export default function HomePage() {
  const [preview, setPreview] = useState<VerticalId>("estetica")
  const current = verticalList.find((item) => item.id === preview) ?? verticalList[0]

  return (
    <ThemeScope vertical={preview} unified className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <BrandMark size="md" priority />
        <Link href="/entrar" className="btn-ghost no-underline">Entrar</Link>
      </header>
      <main className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <section>
          <p className="muted text-sm uppercase tracking-[0.18em]">Agenda para hora marcada</p>
          <h1 className="mt-3 max-w-xl text-5xl leading-[1.02] sm:text-6xl">
            Uma cara só. A cor da casa fica com quem administra.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed">
            Um plano só: {formatBRL(BASE_PRICE_CENTS)} por mês e {formatBRL(SEAT_PRICE_CENTS)} por profissional.
            O cliente marca de graça. Quem administra vê a agenda inteira e o faturamento de cada pessoa.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/criar-conta" className="btn no-underline">Abrir minha casa</Link>
            <Link href="/equipe" className="btn-ghost no-underline">Tenho um código da equipe</Link>
          </div>
        </section>
        <section className="card p-4">
          <p className="muted text-sm">Escolha um rumo para ver a cara</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {verticalList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPreview(item.id)}
                className="card p-3 text-left"
                style={{ borderColor: item.id === preview ? "var(--primary)" : "var(--line)", borderWidth: item.id === preview ? 2 : 1 }}
              >
                <span className="mb-2 block h-2 w-8 rounded-full" style={{ background: item.colors.primary }} />
                <strong className="block">{item.label}</strong>
                <span className="muted mt-1 block text-sm">{item.pitch}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm">
            Agora em {current.label.toLowerCase()}: o vocabulário vira “{current.labels.professional}”, “{current.labels.client}” e “{current.labels.service}”.
          </p>
        </section>
      </main>
    </ThemeScope>
  )
}
