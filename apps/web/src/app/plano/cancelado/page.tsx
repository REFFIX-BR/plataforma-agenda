import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"

export default function PlanoCanceladoPage() {
  return (
    <ThemeScope unified className="min-h-screen">
      <main className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center overflow-hidden px-6 py-16">
        <div className="relative space-y-5">
          <BrandMark href={null} size="md" priority />
          <p className="text-sm font-semibold tracking-[0.18em] text-[color:var(--muted)]">CHECKOUT</p>
          <h1 className="serif text-5xl leading-none">Pagamento fechado</h1>
          <p className="text-lg leading-relaxed text-[color:var(--muted)]">
            Nada foi cobrado. No app, Menu → Plano, abra o checkout de novo quando quiser.
          </p>
        </div>
      </main>
    </ThemeScope>
  )
}
