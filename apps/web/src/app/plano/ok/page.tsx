import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"

export default function PlanoOkPage() {
  return (
    <ThemeScope unified className="min-h-screen">
      <main className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center overflow-hidden px-6 py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,color-mix(in_srgb,var(--primary)_28%,transparent),transparent_42%)]" />
        <div className="relative space-y-5">
          <BrandMark href={null} size="md" priority />
          <p className="text-sm font-semibold tracking-[0.18em] text-[color:var(--primary)]">PAGAMENTO</p>
          <h1 className="serif text-5xl leading-none">Quase lá</h1>
          <p className="text-lg leading-relaxed text-[color:var(--muted)]">
            Se o Pix confirmar, o plano libera sozinho por 1 mês. Volte ao app e abra Menu → Plano.
          </p>
        </div>
      </main>
    </ThemeScope>
  )
}
