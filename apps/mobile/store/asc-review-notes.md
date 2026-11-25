# App Review Notes — +Agenda (cole no campo Notes / App Review Information)

Use English below in App Store Connect. Keep demo credentials current before resubmit.

---

## Paste into Notes

```
1) SCREEN RECORDING
A screen recording on a physical iPhone is attached / linked here:
[PASTE iCloud / Google Drive / Dropbox LINK TO THE RECORDING]

Recording script (what we show):
- Launch +Agenda from the Home Screen
- Sign up OR sign in with the demo account below
- Create / open the store (if needed)
- Book an appointment (client + service + time)
- View day agenda and complete/checkout flow (caixa)
- Open Menu → show Plan / team areas
- Open Menu → tap “Excluir conta”, cancel the confirm dialog (do NOT delete the demo store), then show the button exists
- Sign out

2) PURPOSE AND AUDIENCE
+Agenda is a business scheduling and cash-control app for beauty salons, barbershops, aesthetics clinics and similar appointment-based businesses in Brazil.
It solves messy paper/WhatsApp booking by putting agenda, clients, team commissions and daily cash (caixa) in one place.
Value: less no-shows (local reminders), clearer day plan, and simple Pix billing for 30-day access after a 7-day free trial.

3) HOW TO ACCESS / DEMO ACCOUNT
Website (same product): https://agenda.reffix.com.br
API: https://agendaapi.reffix.com.br

Demo owner account (App Review):
Email: apple.review@reffix.com.br
Password: ReviewAgenda2026!

Steps:
1. Open the app → Entrar
2. Sign in with the credentials above
3. You land in the store agenda for the demo salon
4. Tap + to create an appointment, pick a service/time/client
5. Menu (loja) → Plano shows trial/Pix access status
6. Account deletion: Menu → “Excluir conta” (confirmation required). Please do not confirm on the shared demo; use a throwaway signup if you need to test full deletion.

4) EXTERNAL SERVICES
- Hosting / API: our Next.js backend at agendaapi.reffix.com.br (PostgreSQL or file DB)
- Payments: Asaas (Brazilian Pix checkout for 30-day access periods). Purchase opens in Safari / system browser; not Apple IAP.
- Address lookup (billing): ViaCEP
- Local device reminders: Expo Notifications (local schedules only; no remote push provider required for core use)
- OTA updates: Expo EAS Update (production channel)

5) REGIONAL AVAILABILITY
The app is designed for Brazil (Portuguese UI, BRL, Pix via Asaas, CPF for billing). Feature set is consistent for all users; there are no region-locked feature variants beyond payment rails that require a Brazilian Pix/Asaas customer.

6) REGULATED INDUSTRY / PROTECTED MATERIAL
Not a highly regulated industry app (not banking, health records EMR, gambling, etc.). No third-party protected media catalogs. Business users manage their own salon client appointments.

ADDITIONAL — BILLING MODEL (Guideline 3.1.1 / multiplatform)
+Agenda is also available on the web at https://agenda.reffix.com.br. Access is a business SaaS period (7-day trial, then Pix for 30 days) purchased outside the iOS IAP system via Asaas in the browser. The iOS app does not unlock digital content via In-App Purchase; it is a multiplatform business tool for salon operators.

ACCOUNT DELETION (Guideline 5.1.1)
Account creation is supported. Account deletion is available in-app:
Owner: Menu → Excluir conta (deletes store + related data)
Staff: Menu → Excluir conta (deletes that user account)
Also available on web painel sidebar: Excluir conta.
```

---

## Roteiro da gravação (você no iPhone físico)

1. Abrir o app na tela inicial (não pelo Expo Go)
2. Entrar com a conta demo
3. Criar um horário (cliente + serviço)
4. Mostrar agenda do dia e caixa/relatório se couber
5. Menu → mostrar botão **Excluir conta** → cancelar o alerta
6. Sair da conta
7. Subir o vídeo (iCloud/Drive) e colar o link no item 1 das Notes

## Antes de reenviar

- [ ] Deploy da API na VPS (`git pull` + build + `pm2 restart agenda-api`)
- [ ] OTA mobile `eas update --channel production` **ou** novo build se a review não pegar OTA
- [ ] Conta demo criada e testada no TestFlight
- [ ] Screenshots reais do app em uso (não só splash/login) — Guideline 2.3.3
- [ ] Link da gravação colado nas Notes
- [ ] Responder no Resolution Center e **Resubmit**
