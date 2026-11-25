import { BrandMark } from "@/components/brand-mark"
import { ThemeScope } from "@/components/theme-scope"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Política de privacidade · +Agenda",
}

export default function PrivacyPage() {
  return (
    <ThemeScope unified className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <BrandMark size="md" />
        <Link href="/" className="btn-ghost no-underline">Início</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <p className="muted text-sm uppercase tracking-[0.18em]">+Agenda</p>
        <h1 className="mt-3 text-4xl">Política de privacidade</h1>
        <p className="muted mt-3">Atualizada em 25 de novembro de 2026.</p>
        <div className="mt-8 space-y-6 text-base leading-relaxed">
          <p>
            O +Agenda é um aplicativo de agendamento para salões, clínicas e negócios de atendimento, operado pela Reffix.
            Esta página explica quais dados o app coleta, para que usa e como você pode apagá-los.
          </p>
          <h2 className="text-2xl">Dados que coletamos</h2>
          <p>Quando você cria uma conta ou usa a agenda, guardamos:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>nome, e-mail e senha (a senha fica criptografada, não em texto puro);</li>
            <li>dados da loja: nome, telefone, endereço e equipe;</li>
            <li>clientes e horários que você cadastra: nome, telefone, observações, serviços e valores;</li>
            <li>CPF usado só na cobrança do plano via Pix.</li>
          </ul>
          <h2 className="text-2xl">Para que usamos</h2>
          <p>
            Esses dados servem para manter sua agenda, mostrar a equipe, calcular o caixa e liberar o acesso depois do período de teste.
            Avisos de horário são agendados no próprio celular. Não vendemos esses dados.
          </p>
          <h2 className="text-2xl">Quem mais trata os dados</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Asaas, para gerar o Pix do plano;</li>
            <li>ViaCEP, para completar o endereço na cobrança;</li>
            <li>servidores da Reffix, onde a agenda fica armazenada.</li>
          </ul>
          <h2 className="text-2xl">Exclusão da conta</h2>
          <p>
            No app, abra o Menu e toque em Excluir conta. Quem administra a loja apaga a loja, a equipe, os clientes e a agenda.
            Quem é da equipe apaga a própria conta. O mesmo botão existe no painel web.
          </p>
          <h2 className="text-2xl">Contato</h2>
          <p>
            Dúvidas sobre privacidade: <a href="mailto:contato.reffix@gmail.com">contato.reffix@gmail.com</a>.
          </p>
        </div>
      </main>
    </ThemeScope>
  )
}
