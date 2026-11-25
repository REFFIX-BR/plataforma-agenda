import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Excluir conta · +Agenda",
}

export default function DeleteAccountPage() {
  return (
    <ThemeScope unified className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <BrandMark size="md" />
        <Link href="/" className="btn-ghost no-underline">Início</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <p className="muted text-sm uppercase tracking-[0.18em]">Reffix · +Agenda</p>
        <h1 className="mt-3 text-4xl">Excluir conta e dados</h1>
        <div className="mt-8 space-y-6 text-base leading-relaxed">
          <p>
            O +Agenda, da Reffix, permite apagar a conta e os dados direto no aplicativo. Não é preciso enviar e-mail.
          </p>
          <h2 className="text-2xl">Como excluir</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Abra o +Agenda e entre com seu e-mail e senha.</li>
            <li>Abra o Menu da loja.</li>
            <li>Toque em Excluir conta, abaixo de Sair.</li>
            <li>Confirme. A exclusão é imediata e não pode ser desfeita.</li>
          </ol>
          <p>No site, o mesmo botão fica na barra lateral do painel, em https://agenda.reffix.com.br.</p>
          <h2 className="text-2xl">O que é apagado</h2>
          <p>Se você administra a loja, saem a conta, a loja, a equipe, os clientes, os horários, o caixa e o CPF usado no Pix.</p>
          <p>Se você é da equipe, saem a sua conta, o acesso à loja e os seus horários de trabalho. A agenda da loja continua com o administrador.</p>
          <p>Não guardamos cópia desses dados depois da exclusão. Avisos de horário que estavam só no celular também deixam de ser agendados.</p>
        </div>
      </main>
    </ThemeScope>
  )
}
