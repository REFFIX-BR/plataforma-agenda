import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"

export default function PlanoDemoPage() {
  return (
    <ThemeScope className="min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6 py-16">
        <BrandMark href={null} size="md" priority />
        <p className="text-sm font-semibold tracking-wide text-[color:var(--primary)]">MODO DEMO</p>
        <h1 className="serif text-4xl leading-none">Asaas ainda sem chave</h1>
        <p className="text-lg text-[color:var(--muted)]">
          Neste computador o checkout real da Asaas não está ligado. Volte ao app e toque em <strong>Simular pagamento</strong> para testar o fluxo.
        </p>
        <p className="text-sm text-[color:var(--muted)]">
          Para usar de verdade, configure <code>ASAAS_API_KEY</code> no servidor e reinicie.
        </p>
      </main>
    </ThemeScope>
  )
}
