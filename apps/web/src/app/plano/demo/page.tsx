import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"

export default function PlanoDemoPage() {
  return (
    <ThemeScope className="min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6 py-16">
        <BrandMark href={null} size="md" priority />
        <p className="text-sm font-semibold tracking-wide text-[color:var(--primary)]">CHECKOUT</p>
        <h1 className="serif text-4xl leading-none">Asaas ainda sem chave</h1>
        <p className="text-lg text-[color:var(--muted)]">
          Este servidor está sem <code>ASAAS_API_KEY</code>. Em produção, configure a chave da Asaas e reinicie o app para o pagamento real.
        </p>
        <p className="text-sm text-[color:var(--muted)]">
          Em desenvolvimento local, com a chave vazia, o app ainda pode simular o pagamento. Com a Asaas ligada (sandbox ou produção), a simulação some.
        </p>
      </main>
    </ThemeScope>
  )
}
