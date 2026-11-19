import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"

export default function PlanoDemoPage() {
  return (
    <ThemeScope className="min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6 py-16">
        <BrandMark href={null} size="md" priority />
        <p className="text-sm font-semibold tracking-wide text-[color:var(--primary)]">CHECKOUT</p>
        <h1 className="serif text-4xl leading-none">Pagamento só via Pix</h1>
        <p className="text-lg text-[color:var(--muted)]">
          A simulação foi desligada. Em produção o plano libera depois do Pix confirmado pela Asaas.
        </p>
      </main>
    </ThemeScope>
  )
}
