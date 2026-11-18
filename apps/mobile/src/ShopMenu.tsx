import {
  addDays,
  commissionCents,
  formatBRL,
  formatDay,
  formatPercent,
  monthStart,
  nextMonth,
  todayKey,
  weekStart,
  type BillingSnapshot,
  type FinanceReport,
  type Profession,
  type Service,
  type ServiceBreakdown,
  type SessionState,
  type TeamMember,
} from "@rumo/core"
import { BRAND_COLORS, SEAT_PRICE_CENTS, inkOn, titledLabel, verticalById } from "@rumo/theme"
import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { api, apiUrl } from "./api"
import { CancelledPanel } from "./CancelledPanel"
import { useLayout } from "./layout"
import { SoftPress, Stagger } from "./motion"
import { Atmosphere, Avatar, PageTitle, SoftCard } from "./ui"

type Paint = {
  bg: string
  surface: string
  ink: string
  muted: string
  line: string
  primary: string
  onPrimary: string
  accent: string
  danger: string
}

type Panel = "plan" | "report" | "cancelled" | "team" | "professions" | "services" | "look"

function menuItems(
  professionHint: string,
  planHint: string,
): { id: Panel; title: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] {
  return [
    { id: "plan", title: "Plano", hint: planHint, icon: "card-outline" },
    { id: "report", title: "Relatório", hint: "Semana, mês e equipe", icon: "stats-chart-outline" },
    { id: "cancelled", title: "Cancelados", hint: "Reverter se cancelou sem querer", icon: "close-circle-outline" },
    { id: "team", title: "Equipe", hint: "Contas e comissão", icon: "people-outline" },
    { id: "professions", title: "Profissões", hint: professionHint, icon: "briefcase-outline" },
    { id: "services", title: "Serviços", hint: "Preço e profissão", icon: "pricetags-outline" },
    { id: "look", title: "Aparência", hint: "Logo e cor do app", icon: "color-palette-outline" },
  ]
}

export function ShopMenu(props: {
  session: SessionState
  colors: Paint
  input: TextStyle
  button: ViewStyle
  onLogout: () => Promise<void>
  reloadSession: () => Promise<void>
  onOpenAgenda: (id: string) => void
  onRestored: () => void
  openPlan?: boolean
  onPlanOpened?: () => void
}) {
  const theme = verticalById(props.session.store!.vertical)
  const labels = theme.labels
  const pro = titledLabel(labels.professional)
  const chosenColor = (props.session.store!.brandColor ?? theme.colors.primary).toLowerCase()
  const [panel, setPanel] = useState<Panel | null>(null)

  useEffect(() => {
    if (!props.openPlan) return
    setPanel("plan")
    props.onPlanOpened?.()
  }, [props.openPlan, props.onPlanOpened])
  const planHint =
    props.session.billing?.access === "blocked"
      ? "Assine para liberar a agenda"
      : props.session.billing?.status === "active"
        ? `Ativo · ${formatBRL(props.session.billing.planCents)}/mês`
        : "7 dias grátis · depois R$ 39,90 + R$ 10"
  const MENU = menuItems(
    theme.id === "estetica"
      ? "Esteticista, limpeza..."
      : theme.id === "salao"
        ? "Cabeleireiro, coloração..."
        : theme.id === "manicure"
          ? "Manicure, gel..."
          : `${pro}, serviços...`,
    planHint,
  )
  const [people, setPeople] = useState<TeamMember[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [professions, setProfessions] = useState<Profession[]>([])
  const [report, setReport] = useState<FinanceReport | null>(null)
  const [message, setMessage] = useState("")
  const layout = useLayout()

  const load = useCallback(async () => {
    const [nextPeople, nextServices, nextProfessions, nextReport] = await Promise.all([
      api<TeamMember[]>("/api/team"),
      api<Service[]>("/api/services"),
      api<Profession[]>("/api/professions"),
      api<FinanceReport>(`/api/finance?anchor=${todayKey()}`).catch(() => null),
    ])
    setPeople(nextPeople)
    setServices(nextServices)
    setProfessions(nextProfessions)
    setReport(nextReport)
  }, [])

  useEffect(() => { void load().catch(() => undefined) }, [load])

  const activeProfessions = professions.filter((item) => item.active)
  const attendants = people.filter((person) => person.role === "professional")

  return (
    <View style={{ flex: 1 }}>
      <Atmosphere colors={props.colors} />
      <ScrollView contentContainerStyle={{ padding: layout.pad, gap: 10, paddingBottom: 48 }}>
        <PageTitle kicker="LOJA" title="Menu" subtitle={`${props.session.store!.name} · ${theme.label}`} colors={props.colors} size={layout.title} />
        <Text style={{ color: props.colors.muted, lineHeight: 20 }}>Escolha uma área. Cada coisa fica no seu lugar.</Text>

        <SoftCard colors={props.colors} style={{ paddingVertical: 6, paddingHorizontal: 4, gap: 2 }}>
          {MENU.map((item) => (
            <SoftPress
              key={item.id}
              onPress={() => { setMessage(""); setPanel(item.id) }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: props.colors.bg, borderWidth: 1, borderColor: props.colors.line, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={item.icon} size={18} color={props.colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{item.title}</Text>
                <Text style={{ color: props.colors.muted, fontSize: 13 }}>{item.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={props.colors.muted} />
            </SoftPress>
          ))}
        </SoftCard>

        {!!message && <Text style={{ color: props.colors.ink }}>{message}</Text>}
        <SoftPress onPress={() => void props.onLogout()} style={{ padding: 14 }}>
          <Text style={{ color: props.colors.danger, textAlign: "center", fontWeight: "700" }}>Sair</Text>
        </SoftPress>
      </ScrollView>

      <PanelSheet
        visible={panel === "plan"}
        title="Plano"
        colors={props.colors}
        onClose={() => setPanel(null)}
      >
        <PlanPanel
          colors={props.colors}
          input={props.input}
          button={props.button}
          seatHint={labels.professionals}
          reloadSession={props.reloadSession}
        />
      </PanelSheet>

      <PanelSheet
        visible={panel === "report"}
        title="Relatório"
        colors={props.colors}
        onClose={() => setPanel(null)}
      >
        <ReportPanel colors={props.colors} professionalLabel="Atendente" professionalsLabel="atendentes" />
      </PanelSheet>

      <PanelSheet
        visible={panel === "cancelled"}
        title="Cancelados"
        colors={props.colors}
        onClose={() => setPanel(null)}
      >
        <CancelledPanel
          colors={props.colors}
          owner
          onRestored={() => {
            props.onRestored()
            setPanel(null)
          }}
        />
      </PanelSheet>

      <PanelSheet
        visible={panel === "team"}
        title="Equipe"
        colors={props.colors}
        onClose={() => setPanel(null)}
      >
        <TeamPanel
          colors={props.colors}
          input={props.input}
          button={props.button}
          attendants={attendants}
          professions={professions}
          activeProfessions={activeProfessions}
          services={services.filter((item) => item.active)}
          report={report}
          message={message}
          setMessage={setMessage}
          onReload={load}
          reloadSession={props.reloadSession}
          onOpenAgenda={(id) => { setPanel(null); props.onOpenAgenda(id) }}
          professionalLabel={pro}
          professionalsLabel={labels.professionals}
        />
      </PanelSheet>

      <PanelSheet
        visible={panel === "professions"}
        title="Profissões"
        colors={props.colors}
        onClose={() => setPanel(null)}
      >
        <ProfessionsPanel
          colors={props.colors}
          input={props.input}
          button={props.button}
          professions={professions}
          people={people}
          services={services}
          message={message}
          setMessage={setMessage}
          onReload={load}
        />
      </PanelSheet>

      <PanelSheet
        visible={panel === "services"}
        title="Serviços"
        colors={props.colors}
        onClose={() => setPanel(null)}
      >
        <ServicesPanel
          colors={props.colors}
          input={props.input}
          button={props.button}
          services={services}
          professions={activeProfessions}
          message={message}
          setMessage={setMessage}
          onReload={load}
        />
      </PanelSheet>

      <PanelSheet
        visible={panel === "look"}
        title="Aparência"
        colors={props.colors}
        onClose={() => setPanel(null)}
      >
        <LookPanel
          colors={props.colors}
          button={props.button}
          storeName={props.session.store!.name}
          logoData={props.session.store!.logoData}
          chosenColor={chosenColor}
          message={message}
          setMessage={setMessage}
          reloadSession={props.reloadSession}
        />
      </PanelSheet>
    </View>
  )
}

function PanelSheet(props: {
  visible: boolean
  title: string
  colors: Paint
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Modal visible={props.visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={props.onClose}>
      <SafeAreaProvider>
        <PanelSheetBody title={props.title} colors={props.colors} onClose={props.onClose}>
          {props.children}
        </PanelSheetBody>
      </SafeAreaProvider>
    </Modal>
  )
}

function PanelSheetBody(props: {
  title: string
  colors: Paint
  onClose: () => void
  children: ReactNode
}) {
  const layout = useLayout()
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: props.colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={{ paddingTop: layout.top + 10, paddingHorizontal: layout.pad, paddingBottom: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: props.colors.line, backgroundColor: props.colors.surface }}>
        <Pressable onPress={props.onClose} hitSlop={10} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={26} color={props.colors.ink} />
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", color: props.colors.ink, fontSize: 18, fontWeight: "700" }}>{props.title}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: layout.pad, gap: 12, paddingBottom: layout.bottom + 220 }}
      >
        {props.children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function TeamPanel(props: {
  colors: Paint
  input: TextStyle
  button: ViewStyle
  attendants: TeamMember[]
  professions: Profession[]
  activeProfessions: Profession[]
  services: Service[]
  report: FinanceReport | null
  message: string
  setMessage: (value: string) => void
  onReload: () => Promise<void>
  reloadSession: () => Promise<void>
  onOpenAgenda: (id: string) => void
  professionalLabel: string
  professionalsLabel: string
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [percent, setPercent] = useState("50")
  const [professionId, setProfessionId] = useState(props.activeProfessions[0]?.id ?? "")
  const [editOf, setEditOf] = useState<TeamMember | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editPercent, setEditPercent] = useState("50")
  const [editProfessionId, setEditProfessionId] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [servicesOf, setServicesOf] = useState<TeamMember | null>(null)

  useEffect(() => {
    if (!professionId && props.activeProfessions[0]) setProfessionId(props.activeProfessions[0].id)
  }, [professionId, props.activeProfessions])

  const rate = Math.min(100, Math.max(0, Number(percent.replace(",", ".")) || 0))
  const sample = commissionCents(5000, "percent", rate)
  const editSample = commissionCents(5000, "percent", Math.min(100, Math.max(0, Number(editPercent.replace(",", ".")) || 0)))
  const personServices = (person: TeamMember) =>
    props.services.filter((service) =>
      person.professionId ? service.professionIds.includes(person.professionId) : service.professionalIds.includes(person.id),
    )

  async function add() {
    props.setMessage("")
    try {
      await api("/api/team", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          professionId: professionId || null,
          commissionType: "percent",
          commissionValue: rate,
          attends: true,
        }),
      })
      setName("")
      setEmail("")
      setPassword("")
      setFormOpen(false)
      props.setMessage(`${name.trim()} entrou na equipe.`)
      await props.onReload()
      await props.reloadSession()
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível cadastrar.")
    }
  }

  async function changeRate(person: TeamMember, next: number) {
    const value = Math.min(100, Math.max(0, next))
    try {
      await api(`/api/team/${person.id}`, { method: "PATCH", body: JSON.stringify({ commissionType: "percent", commissionValue: value }) })
      await props.onReload()
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível mudar a porcentagem.")
    }
  }

  async function toggleActive(person: TeamMember) {
    try {
      await api(`/api/team/${person.id}`, { method: "PATCH", body: JSON.stringify({ active: !person.active }) })
      await props.onReload()
      await props.reloadSession()
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível atualizar a conta.")
    }
  }

  function openEdit(person: TeamMember) {
    setEditOf(person)
    setEditName(person.fullName)
    setEditEmail(person.email)
    setEditPassword("")
    setEditPercent(String(person.commissionType === "percent" ? person.commissionValue : 50))
    setEditProfessionId(person.professionId ?? props.activeProfessions[0]?.id ?? "")
    props.setMessage("")
  }

  async function saveEdit() {
    if (!editOf) return
    setEditSaving(true)
    props.setMessage("")
    try {
      const rateValue = Math.min(100, Math.max(0, Number(editPercent.replace(",", ".")) || 0))
      await api(`/api/team/${editOf.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editName.trim(),
          email: editEmail.trim(),
          ...(editPassword.trim() ? { password: editPassword } : {}),
          professionId: editProfessionId || null,
          commissionType: "percent",
          commissionValue: rateValue,
        }),
      })
      setEditOf(null)
      setEditPassword("")
      props.setMessage("Conta atualizada.")
      await props.onReload()
      await props.reloadSession()
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar a conta.")
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>Cadastre, edite e veja a comissão de cada {props.professionalsLabel}.</Text>
      <SoftPress style={[props.button, { borderRadius: 16, paddingVertical: 14 }]} onPress={() => setFormOpen((open) => !open)}>
        <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>{formOpen ? "Fechar cadastro" : "Nova conta"}</Text>
      </SoftPress>
      {formOpen && (
        <SoftCard colors={props.colors} style={{ gap: 10 }}>
          <TextInput style={props.input} placeholder="Nome" placeholderTextColor={props.colors.muted} value={name} onChangeText={setName} />
          <TextInput style={props.input} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={props.colors.muted} value={email} onChangeText={setEmail} />
          <TextInput style={props.input} placeholder="Senha" secureTextEntry placeholderTextColor={props.colors.muted} value={password} onChangeText={setPassword} />
          <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Profissão</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {props.activeProfessions.map((item) => (
              <Chip key={item.id} colors={props.colors} active={professionId === item.id} label={item.name} onPress={() => setProfessionId(item.id)} />
            ))}
          </View>
          <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Porcentagem</Text>
          <TextInput style={props.input} keyboardType="number-pad" value={percent} onChangeText={setPercent} />
          <Text style={{ color: props.colors.muted }}>R$ 50 → {props.professionalLabel.toLowerCase()} {formatBRL(sample)} · loja {formatBRL(5000 - sample)}</Text>
          <Text style={{ color: props.colors.ink, lineHeight: 20, fontWeight: "600" }}>
            Esta conta adiciona {formatBRL(SEAT_PRICE_CENTS)} na próxima mensalidade.
          </Text>
          <SoftPress style={[props.button, { borderRadius: 14, paddingVertical: 13 }]} onPress={() => void add()}>
            <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>Criar conta</Text>
          </SoftPress>
        </SoftCard>
      )}

      {props.attendants.length === 0 && <Text style={{ color: props.colors.muted }}>Nenhuma conta ainda.</Text>}
      {props.attendants.map((person, index) => {
        const current = person.commissionType === "percent" ? person.commissionValue : 0
        const week = props.report?.professionals.find((item) => item.id === person.id)?.week
        const payable = week?.payableCents ?? 0
        const made = week?.realizedCents ?? 0
        const profession = props.professions.find((item) => item.id === person.professionId)
        const offered = personServices(person)
        return (
          <Stagger key={person.id} index={index}>
            <SoftCard colors={props.colors} style={{ gap: 10, opacity: person.active ? 1 : 0.55 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Avatar name={person.fullName} colors={props.colors} solid />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 17 }}>{person.fullName}</Text>
                  <Text style={{ color: props.colors.muted }}>{person.email}</Text>
                  <Text style={{ color: props.colors.muted }}>{profession?.name ?? "Sem profissão"}</Text>
                </View>
                <Text style={{ color: props.colors.primary, fontWeight: "700", fontSize: 18 }}>{current}%</Text>
              </View>
              <Text style={{ color: props.colors.ink }}>Semana: a pagar {formatBRL(payable)} de {formatBRL(made)}</Text>
              <SoftPress
                onPress={() => setServicesOf(person)}
                style={{ borderWidth: 1, borderColor: props.colors.line, backgroundColor: props.colors.bg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Ionicons name="pricetags-outline" size={18} color={props.colors.primary} />
                <Text style={{ flex: 1, color: props.colors.ink, fontWeight: "700" }}>Serviços</Text>
                <Text style={{ color: props.colors.muted }}>{offered.length}</Text>
              </SoftPress>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <SoftPress onPress={() => openEdit(person)} style={[props.button, { flex: 1, borderRadius: 14 }]}>
                  <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>Editar</Text>
                </SoftPress>
                <SoftPress onPress={() => props.onOpenAgenda(person.id)} style={[props.button, { flex: 1, borderRadius: 14, backgroundColor: props.colors.ink }]}>
                  <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>Agenda</Text>
                </SoftPress>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <SoftPress onPress={() => void changeRate(person, current - 5)} style={[props.button, { flex: 1, borderRadius: 14, backgroundColor: props.colors.ink }]}>
                  <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>−5%</Text>
                </SoftPress>
                <SoftPress onPress={() => void changeRate(person, current + 5)} style={[props.button, { flex: 1, borderRadius: 14 }]}>
                  <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>+5%</Text>
                </SoftPress>
              </View>
              <SoftPress onPress={() => void toggleActive(person)} style={{ paddingVertical: 4 }}>
                <Text style={{ color: person.active ? props.colors.danger : props.colors.primary, fontWeight: "700", textAlign: "center" }}>
                  {person.active ? "Desativar conta" : "Reativar conta"}
                </Text>
              </SoftPress>
            </SoftCard>
          </Stagger>
        )
      })}

      {!!props.message && <Text style={{ color: props.colors.ink }}>{props.message}</Text>}

      <PanelSheet visible={Boolean(editOf)} title="Editar conta" colors={props.colors} onClose={() => { if (!editSaving) setEditOf(null) }}>
        <TextInput style={props.input} placeholder="Nome" placeholderTextColor={props.colors.muted} value={editName} onChangeText={setEditName} />
        <TextInput style={props.input} placeholder="E-mail" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={props.colors.muted} value={editEmail} onChangeText={setEditEmail} />
        <TextInput style={props.input} placeholder="Nova senha (opcional)" secureTextEntry placeholderTextColor={props.colors.muted} value={editPassword} onChangeText={setEditPassword} />
        <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Profissão</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {props.activeProfessions.map((item) => (
            <Chip key={item.id} colors={props.colors} active={editProfessionId === item.id} label={item.name} onPress={() => setEditProfessionId(item.id)} />
          ))}
        </View>
        <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Porcentagem</Text>
        <TextInput style={props.input} keyboardType="number-pad" value={editPercent} onChangeText={setEditPercent} />
        <Text style={{ color: props.colors.muted }}>R$ 50 → {formatBRL(editSample)} / loja {formatBRL(5000 - editSample)}</Text>
        <SoftPress style={[props.button, { borderRadius: 16, paddingVertical: 14, opacity: editSaving ? 0.7 : 1 }]} onPress={() => void saveEdit()} disabled={editSaving}>
          <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>{editSaving ? "Salvando..." : "Salvar"}</Text>
        </SoftPress>
      </PanelSheet>

      <PanelSheet visible={Boolean(servicesOf)} title="Serviços" colors={props.colors} onClose={() => setServicesOf(null)}>
        <Text style={{ color: props.colors.muted, lineHeight: 20 }}>
          Da profissão {servicesOf ? (props.professions.find((item) => item.id === servicesOf.professionId)?.name ?? "ainda sem") : ""}.
        </Text>
        {servicesOf && personServices(servicesOf).length === 0 && (
          <Text style={{ color: props.colors.muted }}>Nenhum serviço nesta profissão.</Text>
        )}
        {servicesOf && personServices(servicesOf).map((service) => {
          const hers = commissionCents(service.priceCents, servicesOf.commissionType, servicesOf.commissionValue)
          return (
            <SoftCard key={service.id} colors={props.colors} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: props.colors.ink, fontWeight: "700", flex: 1 }}>{service.name}</Text>
                <Text style={{ color: props.colors.primary, fontWeight: "700" }}>{formatBRL(service.priceCents)}</Text>
              </View>
              <Text style={{ color: props.colors.muted }}>{service.durationMin} min · {props.professionalLabel.toLowerCase()} {formatBRL(hers)}</Text>
            </SoftCard>
          )
        })}
      </PanelSheet>
    </>
  )
}

function ProfessionsPanel(props: {
  colors: Paint
  input: TextStyle
  button: ViewStyle
  professions: Profession[]
  people: TeamMember[]
  services: Service[]
  message: string
  setMessage: (value: string) => void
  onReload: () => Promise<void>
}) {
  const [name, setName] = useState("")

  async function create() {
    const value = name.trim()
    if (!value) return
    props.setMessage("")
    try {
      await api("/api/professions", { method: "POST", body: JSON.stringify({ name: value }) })
      setName("")
      await props.onReload()
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível criar.")
    }
  }

  function remove(profession: Profession) {
    const peopleCount = props.people.filter((person) => person.professionId === profession.id).length
    const serviceCount = props.services.filter((service) => service.professionIds.includes(profession.id)).length
    Alert.alert(
      "Excluir profissão",
      peopleCount || serviceCount
        ? `${profession.name} ainda tem ${peopleCount} pessoa(s) e ${serviceCount} serviço(s). Desligue antes de excluir.`
        : `Excluir ${profession.name}?`,
      peopleCount || serviceCount
        ? [{ text: "Ok" }]
        : [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Excluir",
              style: "destructive",
              onPress: () => {
                void api(`/api/professions/${profession.id}`, { method: "DELETE" })
                  .then(() => props.onReload())
                  .catch((cause: unknown) => props.setMessage(cause instanceof Error ? cause.message : "Não foi possível excluir."))
              },
            },
          ],
    )
  }

  return (
    <>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>Crie manicure, estética etc. Depois ligue os serviços e as pessoas a elas.</Text>
      <SoftCard colors={props.colors} style={{ gap: 10 }}>
        <TextInput style={props.input} placeholder="Nova profissão" placeholderTextColor={props.colors.muted} value={name} onChangeText={setName} />
        <SoftPress style={[props.button, { borderRadius: 14, paddingVertical: 13 }]} onPress={() => void create()}>
          <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>Criar</Text>
        </SoftPress>
      </SoftCard>
      {props.professions.length === 0 && <Text style={{ color: props.colors.muted }}>Nenhuma profissão ainda.</Text>}
      {props.professions.map((profession) => {
        const peopleCount = props.people.filter((person) => person.professionId === profession.id).length
        const serviceCount = props.services.filter((service) => service.professionIds.includes(profession.id)).length
        return (
          <SoftCard key={profession.id} colors={props.colors} style={{ gap: 8, opacity: profession.active ? 1 : 0.55 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{profession.name}</Text>
                <Text style={{ color: props.colors.muted }}>{peopleCount} pessoa(s) · {serviceCount} serviço(s){profession.active ? "" : " · pausada"}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <SoftPress
                onPress={() => void api(`/api/professions/${profession.id}`, { method: "PATCH", body: JSON.stringify({ active: !profession.active }) }).then(() => props.onReload())}
                style={[props.button, { flex: 1, borderRadius: 14, backgroundColor: props.colors.ink }]}
              >
                <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>{profession.active ? "Pausar" : "Reativar"}</Text>
              </SoftPress>
              <SoftPress onPress={() => remove(profession)} style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: props.colors.danger, paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ color: props.colors.danger, fontWeight: "700" }}>Excluir</Text>
              </SoftPress>
            </View>
          </SoftCard>
        )
      })}
      {!!props.message && <Text style={{ color: props.colors.ink }}>{props.message}</Text>}
    </>
  )
}

function ServicesPanel(props: {
  colors: Paint
  input: TextStyle
  button: ViewStyle
  services: Service[]
  professions: Profession[]
  message: string
  setMessage: (value: string) => void
  onReload: () => Promise<void>
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [filterId, setFilterId] = useState<string>("all")
  const [name, setName] = useState("")
  const [duration, setDuration] = useState("")
  const [price, setPrice] = useState("")
  const [selected, setSelected] = useState<string[]>(props.professions[0] ? [props.professions[0].id] : [])
  const [editOf, setEditOf] = useState<Service | null>(null)
  const [editName, setEditName] = useState("")
  const [editDuration, setEditDuration] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editProfessions, setEditProfessions] = useState<string[]>([])
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    setSelected((current) => {
      const kept = current.filter((id) => props.professions.some((item) => item.id === id))
      return kept.length > 0 ? kept : (props.professions[0] ? [props.professions[0].id] : [])
    })
  }, [props.professions])

  useEffect(() => {
    if (!editOf) return
    const fresh = props.services.find((item) => item.id === editOf.id)
    if (fresh) setEditOf(fresh)
  }, [props.services, editOf?.id])

  const active = props.services.filter((item) => item.active)
  const paused = props.services.filter((item) => !item.active)
  const filtered = (list: Service[]) =>
    filterId === "all"
      ? list
      : filterId === "none"
        ? list.filter((item) => item.professionIds.length === 0)
        : list.filter((item) => item.professionIds.includes(filterId))

  const groups = (() => {
    const source = filtered(active)
    if (filterId !== "all") {
      const title =
        filterId === "none"
          ? "Sem profissão"
          : props.professions.find((item) => item.id === filterId)?.name ?? "Serviços"
      return source.length ? [{ id: filterId, title, items: source }] : []
    }
    const byProfession = props.professions
      .map((profession) => ({
        id: profession.id,
        title: profession.name,
        items: source.filter((service) => service.professionIds.includes(profession.id)),
      }))
      .filter((group) => group.items.length > 0)
    const orphan = source.filter((service) => service.professionIds.length === 0)
    if (orphan.length) byProfession.push({ id: "none", title: "Sem profissão", items: orphan })
    // avoid duplicating a service that belongs to many professions: show once under first profession
    const seen = new Set<string>()
    return byProfession
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (seen.has(item.id)) return false
          seen.add(item.id)
          return true
        }),
      }))
      .filter((group) => group.items.length > 0)
  })()

  async function create() {
    props.setMessage("")
    if (!name.trim() || !duration.trim() || !price.trim()) {
      props.setMessage("Preencha nome, minutos e preço.")
      return
    }
    try {
      await api("/api/services", {
        method: "POST",
        body: JSON.stringify({
          name,
          durationMin: Number(duration),
          priceCents: Math.round(Number(price.replace(",", ".")) * 100),
          professionIds: selected,
        }),
      })
      setName("")
      setDuration("")
      setPrice("")
      setFormOpen(false)
      await props.onReload()
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    }
  }

  function openEdit(service: Service) {
    setEditOf(service)
    setEditName(service.name)
    setEditDuration(String(service.durationMin))
    setEditPrice(String(service.priceCents / 100))
    setEditProfessions([...service.professionIds])
    props.setMessage("")
  }

  async function saveEdit() {
    if (!editOf) return
    setEditSaving(true)
    props.setMessage("")
    try {
      await api(`/api/services/${editOf.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          durationMin: Number(editDuration),
          priceCents: Math.round(Number(editPrice.replace(",", ".")) * 100),
          professionIds: editProfessions,
        }),
      })
      setEditOf(null)
      await props.onReload()
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    } finally {
      setEditSaving(false)
    }
  }

  function professionLabel(service: Service) {
    const names = props.professions.filter((item) => service.professionIds.includes(item.id)).map((item) => item.name)
    if (names.length === 0) return "Sem profissão"
    if (names.length <= 2) return names.join(" · ")
    return `${names[0]} +${names.length - 1}`
  }

  return (
    <>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>
        Organizados por profissão. Toque num serviço para editar preço, tempo e quem faz.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        <Chip colors={props.colors} active={filterId === "all"} label={`Todos · ${active.length}`} onPress={() => setFilterId("all")} />
        {props.professions.map((item) => {
          const count = active.filter((service) => service.professionIds.includes(item.id)).length
          return <Chip key={item.id} colors={props.colors} active={filterId === item.id} label={`${item.name} · ${count}`} onPress={() => setFilterId(item.id)} />
        })}
        {active.some((service) => service.professionIds.length === 0) && (
          <Chip
            colors={props.colors}
            active={filterId === "none"}
            label={`Sem profissão · ${active.filter((service) => service.professionIds.length === 0).length}`}
            onPress={() => setFilterId("none")}
          />
        )}
      </ScrollView>

      <SoftPress style={[props.button, { borderRadius: 16, paddingVertical: 14 }]} onPress={() => setFormOpen((open) => !open)}>
        <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>{formOpen ? "Fechar" : "Novo serviço"}</Text>
      </SoftPress>

      {formOpen && (
        <SoftCard colors={props.colors} style={{ gap: 10 }}>
          <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Nome</Text>
          <TextInput style={props.input} placeholder="Ex.: Design de sobrancelha" placeholderTextColor={props.colors.muted} value={name} onChangeText={setName} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Minutos</Text>
              <TextInput style={props.input} keyboardType="number-pad" placeholder="Tempo de duração" placeholderTextColor={props.colors.muted} value={duration} onChangeText={setDuration} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Preço</Text>
              <TextInput style={props.input} keyboardType="decimal-pad" placeholder="Preço" placeholderTextColor={props.colors.muted} value={price} onChangeText={setPrice} />
            </View>
          </View>
          <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Profissão</Text>
          {props.professions.length === 0 ? (
            <Text style={{ color: props.colors.muted }}>Crie uma profissão no menu antes.</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {props.professions.map((item) => (
                <Chip
                  key={item.id}
                  colors={props.colors}
                  active={selected.includes(item.id)}
                  label={item.name}
                  onPress={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                />
              ))}
            </View>
          )}
          <SoftPress style={[props.button, { borderRadius: 14, paddingVertical: 13, opacity: selected.length ? 1 : 0.5 }]} onPress={() => void create()} disabled={selected.length === 0}>
            <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>Salvar serviço</Text>
          </SoftPress>
        </SoftCard>
      )}

      {groups.length === 0 && (
        <SoftCard colors={props.colors} style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
          <Ionicons name="pricetags-outline" size={26} color={props.colors.muted} />
          <Text style={{ color: props.colors.muted, textAlign: "center" }}>Nenhum serviço neste filtro.</Text>
        </SoftCard>
      )}

      {groups.map((group) => (
        <View key={group.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 }}>
            <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 15, flex: 1 }}>{group.title}</Text>
            <Text style={{ color: props.colors.muted, fontSize: 12 }}>{group.items.length}</Text>
          </View>
          {group.items.map((service) => (
            <SoftPress key={service.id} onPress={() => openEdit(service)}>
              <SoftCard colors={props.colors} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{service.name}</Text>
                    <Text style={{ color: props.colors.muted }}>{service.durationMin} min · {professionLabel(service)}</Text>
                  </View>
                  <Text style={{ color: props.colors.primary, fontWeight: "700" }}>{formatBRL(service.priceCents)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={props.colors.muted} />
                </View>
              </SoftCard>
            </SoftPress>
          ))}
        </View>
      ))}

      {filtered(paused).length > 0 && (
        <View style={{ gap: 8, paddingTop: 8 }}>
          <Text style={{ color: props.colors.muted, fontWeight: "700", fontSize: 12, letterSpacing: 1 }}>PAUSADOS</Text>
          {filtered(paused).map((service) => (
            <SoftPress key={service.id} onPress={() => openEdit(service)}>
              <SoftCard colors={props.colors} style={{ gap: 4, opacity: 0.7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{service.name}</Text>
                    <Text style={{ color: props.colors.muted }}>{service.durationMin} min · pausado</Text>
                  </View>
                  <Text style={{ color: props.colors.muted, fontWeight: "700" }}>{formatBRL(service.priceCents)}</Text>
                </View>
              </SoftCard>
            </SoftPress>
          ))}
        </View>
      )}

      {!!props.message && <Text style={{ color: props.colors.ink }}>{props.message}</Text>}

      <PanelSheet visible={Boolean(editOf)} title="Editar serviço" colors={props.colors} onClose={() => { if (!editSaving) setEditOf(null) }}>
        <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Nome</Text>
        <TextInput style={props.input} value={editName} onChangeText={setEditName} placeholderTextColor={props.colors.muted} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Minutos</Text>
            <TextInput style={props.input} keyboardType="number-pad" value={editDuration} onChangeText={setEditDuration} placeholderTextColor={props.colors.muted} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Preço</Text>
            <TextInput style={props.input} keyboardType="decimal-pad" value={editPrice} onChangeText={setEditPrice} placeholderTextColor={props.colors.muted} />
          </View>
        </View>
        <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Profissões que fazem</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {props.professions.map((item) => (
            <Chip
              key={item.id}
              colors={props.colors}
              active={editProfessions.includes(item.id)}
              label={item.name}
              onPress={() => setEditProfessions((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
            />
          ))}
        </View>
        <SoftPress style={[props.button, { borderRadius: 16, paddingVertical: 14, opacity: editSaving ? 0.7 : 1 }]} onPress={() => void saveEdit()} disabled={editSaving}>
          <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>{editSaving ? "Salvando..." : "Salvar"}</Text>
        </SoftPress>
        {editOf && (
          <SoftPress
            onPress={() => {
              void api(`/api/services/${editOf.id}`, { method: "PATCH", body: JSON.stringify({ active: !editOf.active }) })
                .then(async () => {
                  await props.onReload()
                  setEditOf(null)
                })
                .catch((cause: unknown) => props.setMessage(cause instanceof Error ? cause.message : "Não foi possível atualizar."))
            }}
            style={{ paddingVertical: 8 }}
          >
            <Text style={{ color: editOf.active ? props.colors.danger : props.colors.primary, fontWeight: "700", textAlign: "center" }}>
              {editOf.active ? "Pausar serviço" : "Reativar serviço"}
            </Text>
          </SoftPress>
        )}
        {!!props.message && <Text style={{ color: props.colors.ink }}>{props.message}</Text>}
      </PanelSheet>
    </>
  )
}

const BILLING_STATUS: Record<BillingSnapshot["status"], string> = {
  none: "Teste gratuito",
  trialing: "Teste gratuito",
  pending: "Aguardando pagamento",
  active: "Plano ativo",
  past_due: "Pagamento em atraso",
  canceled: "Assinatura cancelada",
}

const TRIAL_DAYS = 7

function formatDocInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

function PlanPanel(props: {
  colors: Paint
  input: TextStyle
  button: ViewStyle
  seatHint: string
  reloadSession: () => Promise<void>
}) {
  const [billing, setBilling] = useState<BillingSnapshot | null>(null)
  const [cpfCnpj, setCpfCnpj] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const next = await api<BillingSnapshot>("/api/billing")
    setBilling(next)
    if (next.cpfCnpj) setCpfCnpj(formatDocInput(next.cpfCnpj))
    return next
  }, [])

  useEffect(() => {
    void load().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o plano.")
    })
  }, [load])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return
      void (async () => {
        try {
          const next = await load()
          if (next.status === "active") await props.reloadSession()
        } catch {
          /* ignore */
        }
      })()
    })
    return () => sub.remove()
  }, [load, props.reloadSession])

  async function resolveExternalUrl(url: string) {
    try {
      const target = new URL(url)
      if (target.hostname !== "localhost" && target.hostname !== "127.0.0.1") return url
      const base = new URL(await apiUrl())
      target.hostname = base.hostname
      if (base.port === "8081") target.port = "3001"
      else if (base.port) target.port = base.port
      return target.toString()
    } catch {
      return url
    }
  }

  async function openExternal(url: string) {
    const finalUrl = await resolveExternalUrl(url)
    const can = await Linking.canOpenURL(finalUrl)
    if (!can) {
      setMessage(`Abra no navegador: ${finalUrl}`)
      return
    }
    await Linking.openURL(finalUrl)
    setMessage("Checkout aberto no navegador. Quando o pagamento confirmar, volte ao app.")
  }

  async function startCheckout() {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const next = await api<BillingSnapshot>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ cpfCnpj }),
      })
      setBilling(next)
      if (next.checkoutUrl) await openExternal(next.checkoutUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir o checkout.")
    } finally {
      setBusy(false)
    }
  }

  async function simulatePayment() {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const next = await api<BillingSnapshot>("/api/billing/demo-confirm", { method: "POST", body: "{}" })
      setBilling(next)
      await props.reloadSession()
      setMessage("Pagamento concluído. A agenda foi liberada.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível simular o pagamento.")
    } finally {
      setBusy(false)
    }
  }

  if (!billing) {
    return (
      <View style={{ paddingVertical: 48, alignItems: "center", gap: 12 }}>
        {error ? (
          <Text style={{ color: props.colors.danger, textAlign: "center" }}>{error}</Text>
        ) : (
          <>
            <ActivityIndicator color={props.colors.primary} />
            <Text style={{ color: props.colors.muted }}>Carregando plano...</Text>
          </>
        )}
      </View>
    )
  }

  const trialLike = billing.status === "trialing" || billing.status === "none"
  const blocked = billing.access === "blocked"
  const active = billing.status === "active"
  const daysLeft = billing.daysLeft
  const trialProgress = trialLike && daysLeft != null
    ? Math.max(0, Math.min(1, (TRIAL_DAYS - Math.max(daysLeft, 0)) / TRIAL_DAYS))
    : 0
  const statusTone = blocked || billing.status === "past_due"
    ? props.colors.danger
    : active
      ? props.colors.primary
      : props.colors.ink
  const seatsCents = billing.seatCount * billing.seatPriceCents
  const trialCaption =
    daysLeft == null
      ? "7 dias para conhecer a agenda sem compromisso."
      : daysLeft < 0
        ? "O período gratuito terminou. Assine para continuar."
        : daysLeft === 0
          ? "Último dia do período gratuito."
          : `${daysLeft} dia${daysLeft === 1 ? "" : "s"} restantes do período gratuito.`

  const perks = [
    { icon: "calendar-outline" as const, title: "Agenda completa", hint: "Horários, clientes e equipe no mesmo lugar." },
    { icon: "gift-outline" as const, title: "7 dias grátis", hint: "Teste tudo antes de assinar." },
    { icon: "people-outline" as const, title: "Equipe sob medida", hint: `Cada pessoa da equipe ativa soma ${formatBRL(billing.seatPriceCents)}.` },
    { icon: "qr-code-outline" as const, title: "Pix avulso", hint: "Paga 30 dias agora. Depois do prazo, gera outro Pix." },
  ]

  return (
    <>
      <View
        style={{
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: props.colors.primary,
          padding: 22,
          gap: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: props.colors.onPrimary, opacity: 0.78, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>
              30 DIAS DE ACESSO
            </Text>
            <Text style={{ color: props.colors.onPrimary, fontSize: 40, fontWeight: "700", letterSpacing: -1 }}>
              {formatBRL(billing.planCents)}
            </Text>
            <Text style={{ color: props.colors.onPrimary, opacity: 0.82, fontSize: 14 }}>Pix avulso · libera a agenda por 30 dias</Text>
          </View>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.16)",
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.22)",
            }}
          >
            <Text style={{ color: props.colors.onPrimary, fontWeight: "700", fontSize: 12 }}>{BILLING_STATUS[billing.status]}</Text>
          </View>
        </View>

        {trialLike && (
          <View style={{ gap: 10 }}>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
              <View style={{ width: `${Math.round(trialProgress * 100)}%`, height: "100%", backgroundColor: props.colors.onPrimary, borderRadius: 999 }} />
            </View>
            <Text style={{ color: props.colors.onPrimary, opacity: 0.9, lineHeight: 20 }}>{trialCaption}</Text>
            {billing.trialEndsAt && daysLeft != null && daysLeft >= 0 && (
              <Text style={{ color: props.colors.onPrimary, opacity: 0.72, fontSize: 13 }}>
                Válido até {new Date(billing.trialEndsAt).toLocaleDateString("pt-BR")}
              </Text>
            )}
          </View>
        )}

        {active && (
          <View style={{ gap: 4 }}>
            <Text style={{ color: props.colors.onPrimary, opacity: 0.9, lineHeight: 20 }}>
              {daysLeft != null && daysLeft >= 0
                ? `${daysLeft} dia${daysLeft === 1 ? "" : "s"} restantes neste período.`
                : "Seu período de 30 dias está ativo."}
            </Text>
            {billing.nextDueDate && (
              <Text style={{ color: props.colors.onPrimary, opacity: 0.72, fontSize: 13 }}>
                Válido até {billing.nextDueDate.split("-").reverse().join("/")}
              </Text>
            )}
          </View>
        )}

        {(billing.status === "pending" || billing.status === "past_due" || blocked) && !trialLike && (
          <Text style={{ color: props.colors.onPrimary, opacity: 0.92, lineHeight: 20 }}>
            {blocked
              ? "Os 30 dias acabaram. Pague um novo Pix para liberar mais 30 dias."
              : "Conclua o Pix para liberar 30 dias de acesso."}
          </Text>
        )}
      </View>

      <SoftCard colors={props.colors} style={{ gap: 0, paddingVertical: 4 }}>
        {[
          { label: "Conta administradora", value: formatBRL(billing.basePriceCents) },
          {
            label: billing.seatCount > 0
              ? `${billing.seatCount} ${props.seatHint} × ${formatBRL(billing.seatPriceCents)}`
              : "Atendentes extras",
            value: billing.seatCount > 0 ? formatBRL(seatsCents) : "R$ 0,00",
          },
        ].map((row, index) => (
          <View
            key={row.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 4,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: props.colors.line,
            }}
          >
            <Text style={{ color: props.colors.muted, flex: 1 }}>{row.label}</Text>
            <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{row.value}</Text>
          </View>
        ))}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingVertical: 14,
            paddingHorizontal: 4,
            borderTopWidth: 1,
            borderTopColor: props.colors.line,
          }}
        >
          <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Total (30 dias)</Text>
          <Text style={{ color: statusTone, fontWeight: "700", fontSize: 18 }}>{formatBRL(billing.planCents)}</Text>
        </View>
      </SoftCard>

      {!active && (
        <SoftCard colors={props.colors} style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>
              {blocked ? "Assinar para continuar" : "Assinar plano"}
            </Text>
            <Text style={{ color: props.colors.muted, lineHeight: 20 }}>
              Informe o CPF ou CNPJ e pague o Pix. Libera 30 dias de acesso.
            </Text>
          </View>
          {!billing.configured && (
            <Text style={{ color: props.colors.danger, lineHeight: 20 }}>
              Asaas ainda não está configurada no servidor. Ajuste a ASAAS_API_KEY e reinicie o PM2.
            </Text>
          )}
          <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>CPF OU CNPJ</Text>
          <TextInput
            style={[props.input, { borderRadius: 14 }]}
            value={cpfCnpj}
            onChangeText={(value) => setCpfCnpj(formatDocInput(value))}
            placeholder="000.000.000-00"
            placeholderTextColor={props.colors.muted}
            keyboardType="number-pad"
          />
          <SoftPress
            style={[props.button, { borderRadius: 16, paddingVertical: 16, opacity: busy ? 0.7 : 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}
            onPress={() => void startCheckout()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={props.colors.onPrimary} />
            ) : (
              <Ionicons name="qr-code-outline" size={18} color={props.colors.onPrimary} />
            )}
            <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700", fontSize: 16 }}>
              {busy ? "Abrindo Pix..." : "Pagar com Pix"}
            </Text>
          </SoftPress>
          {billing.checkoutUrl && billing.status === "pending" && (
            <SoftPress onPress={() => void openExternal(billing.checkoutUrl!)} style={{ paddingVertical: 6 }}>
              <Text style={{ color: props.colors.primary, textAlign: "center", fontWeight: "700" }}>Abrir página novamente</Text>
            </SoftPress>
          )}
          {billing.demo && (
            <SoftPress
              onPress={() => void simulatePayment()}
              disabled={busy}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: props.colors.line,
                backgroundColor: props.colors.bg,
                paddingVertical: 14,
                opacity: busy ? 0.7 : 1,
              }}
            >
              <Text style={{ color: props.colors.ink, textAlign: "center", fontWeight: "700" }}>
                {busy ? "Confirmando..." : "Simular pagamento concluído"}
              </Text>
            </SoftPress>
          )}
        </SoftCard>
      )}

      <SoftCard colors={props.colors} style={{ gap: 14 }}>
        <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Incluso no plano</Text>
        {perks.map((perk) => (
          <View key={perk.title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: props.colors.bg,
                borderWidth: 1,
                borderColor: props.colors.line,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={perk.icon} size={18} color={props.colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{perk.title}</Text>
              <Text style={{ color: props.colors.muted, lineHeight: 19 }}>{perk.hint}</Text>
            </View>
          </View>
        ))}
      </SoftCard>

      {active && (
        <SoftCard colors={props.colors} style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: props.colors.bg,
                borderWidth: 1,
                borderColor: props.colors.line,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark-circle" size={20} color={props.colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Tudo certo</Text>
              <Text style={{ color: props.colors.muted, lineHeight: 19 }}>
                Ao acabar os 30 dias, a agenda pausa até um novo Pix.
              </Text>
            </View>
          </View>
          {billing.lastPaidAt && (
            <Text style={{ color: props.colors.muted, fontSize: 13 }}>
              Último pagamento em {new Date(billing.lastPaidAt).toLocaleDateString("pt-BR")}
            </Text>
          )}
          <SoftPress
            onPress={() => {
              Alert.alert(
                "Como funciona",
                "Cada Pix libera 30 dias. Se a equipe mudar, o novo valor vale no próximo Pix que você gerar.",
              )
            }}
            style={{ paddingVertical: 4 }}
          >
            <Text style={{ color: props.colors.primary, fontWeight: "700" }}>Como o valor muda?</Text>
          </SoftPress>
        </SoftCard>
      )}

      {!!message && (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: props.colors.line, backgroundColor: props.colors.surface, padding: 14 }}>
          <Text style={{ color: props.colors.ink, lineHeight: 20 }}>{message}</Text>
        </View>
      )}
      {!!error && (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: props.colors.danger, backgroundColor: props.colors.surface, padding: 14 }}>
          <Text style={{ color: props.colors.danger, lineHeight: 20 }}>{error}</Text>
        </View>
      )}
    </>
  )
}

function ReportPanel(props: { colors: Paint; professionalLabel: string; professionalsLabel: string }) {
  const [anchor, setAnchor] = useState(todayKey())
  const [scope, setScope] = useState<"week" | "month">("week")
  const [report, setReport] = useState<FinanceReport | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setError("")
    setReport(await api<FinanceReport>(`/api/finance?anchor=${anchor}`))
  }, [anchor])

  useEffect(() => {
    void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar o relatório."))
  }, [load])

  const weekFrom = weekStart(anchor)
  const monthFrom = monthStart(anchor)
  const summary = scope === "week" ? report?.week : report?.month
  const payments = scope === "week" ? report?.weekPayments : report?.monthPayments
  const storeShare = summary ? summary.realizedCents - summary.payableCents : 0
  const team = [...(report?.professionals ?? [])]
    .filter((person) => {
      const slice = scope === "week" ? person.week : person.month
      return slice.realizedCents > 0 || slice.appointmentCount > 0
    })
    .sort((a, b) => {
      const left = scope === "week" ? a.week.realizedCents : a.month.realizedCents
      const right = scope === "week" ? b.week.realizedCents : b.month.realizedCents
      return right - left
    })
  const topServices = (() => {
    if (scope !== "week") return [] as ServiceBreakdown[]
    const map = new Map<string, ServiceBreakdown>()
    for (const person of report?.professionals ?? []) {
      for (const service of person.weekServices ?? []) {
        const current = map.get(service.name) ?? { name: service.name, count: 0, totalCents: 0, payableCents: 0 }
        current.count += service.count
        current.totalCents += service.totalCents
        current.payableCents += service.payableCents
        map.set(service.name, current)
      }
    }
    return [...map.values()].sort((a, b) => b.totalCents - a.totalCents).slice(0, 5)
  })()

  function shiftPeriod(delta: number) {
    if (scope === "week") {
      setAnchor(addDays(weekStart(anchor), delta * 7))
      return
    }
    if (delta > 0) {
      setAnchor(nextMonth(anchor))
      return
    }
    setAnchor(monthStart(addDays(monthStart(anchor), -1)))
  }

  const periodLabel =
    scope === "week"
      ? `${formatDay(weekFrom)} a ${formatDay(addDays(weekFrom, 6))}`
      : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
          .format(new Date(`${monthFrom}T12:00:00`))
          .replace(/^./, (c) => c.toUpperCase())

  const payRows = (() => {
    if (!payments) return [] as { label: string; value: number }[]
    const rows = [
      { label: "Pix", value: payments.pixCents },
      { label: "Cartão", value: payments.cardCents },
      { label: "Dinheiro", value: payments.cashCents },
    ]
    if (payments.unsetCents > 0) rows.push({ label: "Sem forma", value: payments.unsetCents })
    return rows.filter((row) => row.value > 0)
  })()
  const payTotal = payRows.reduce((sum, row) => sum + row.value, 0)

  return (
    <>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {([
          { id: "week" as const, label: "Semana" },
          { id: "month" as const, label: "Mês" },
        ]).map((item) => {
          const active = scope === item.id
          return (
            <SoftPress
              key={item.id}
              onPress={() => setScope(item.id)}
              style={{
                flex: 1,
                borderRadius: 14,
                paddingVertical: 11,
                alignItems: "center",
                borderWidth: 1,
                borderColor: active ? props.colors.primary : props.colors.line,
                backgroundColor: active ? props.colors.primary : props.colors.surface,
              }}
            >
              <Text style={{ color: active ? props.colors.onPrimary : props.colors.ink, fontWeight: "700" }}>{item.label}</Text>
            </SoftPress>
          )
        })}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <SoftPress onPress={() => shiftPeriod(-1)} style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: props.colors.line, alignItems: "center", justifyContent: "center", backgroundColor: props.colors.surface }}>
          <Ionicons name="chevron-back" size={20} color={props.colors.ink} />
        </SoftPress>
        <Text style={{ flex: 1, textAlign: "center", color: props.colors.ink, fontWeight: "700" }}>{periodLabel}</Text>
        <SoftPress onPress={() => shiftPeriod(1)} style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: props.colors.line, alignItems: "center", justifyContent: "center", backgroundColor: props.colors.surface }}>
          <Ionicons name="chevron-forward" size={20} color={props.colors.ink} />
        </SoftPress>
      </View>

      {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}

      {summary && (
        <>
          <SoftCard colors={props.colors} style={{ gap: 14 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: props.colors.muted }}>{scope === "week" ? "Vendeu na semana" : "Vendeu no mês"}</Text>
              <Text style={{ color: props.colors.ink, fontSize: 36, fontWeight: "700", letterSpacing: -0.6 }}>{formatBRL(summary.realizedCents)}</Text>
              {summary.forecastCents > 0 && (
                <Text style={{ color: props.colors.muted }}>Ainda marcado: {formatBRL(summary.forecastCents)}</Text>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: props.colors.bg, borderRadius: 14, borderWidth: 1, borderColor: props.colors.line, padding: 12, gap: 4 }}>
                <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>LOJA</Text>
                <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 18 }}>{formatBRL(storeShare)}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: props.colors.bg, borderRadius: 14, borderWidth: 1, borderColor: props.colors.line, padding: 12, gap: 4 }}>
                <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>{props.professionalsLabel.toUpperCase()}</Text>
                <Text style={{ color: props.colors.primary, fontWeight: "700", fontSize: 18 }}>{formatBRL(summary.payableCents)}</Text>
              </View>
            </View>
          </SoftCard>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { label: "Horários", value: String(summary.appointmentCount) },
              { label: "Feitos", value: String(summary.completedCount) },
              { label: "Faltas", value: String(summary.noShowCount) },
              { label: "Ocupação", value: formatPercent(Math.min(summary.occupancy, 1)) },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  width: "48%",
                  flexGrow: 1,
                  minWidth: "46%",
                  backgroundColor: props.colors.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: props.colors.line,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  gap: 2,
                }}
              >
                <Text style={{ color: props.colors.muted, fontSize: 12 }}>{stat.label}</Text>
                <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 18 }}>{stat.value}</Text>
              </View>
            ))}
          </View>

          <SoftCard colors={props.colors} style={{ gap: 12 }}>
            <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Como entrou</Text>
            {payRows.length === 0 ? (
              <Text style={{ color: props.colors.muted }}>Ainda sem pagamento marcado neste período.</Text>
            ) : (
              payRows.map((row) => {
                const ratio = payTotal > 0 ? row.value / payTotal : 0
                return (
                  <View key={row.label} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{row.label}</Text>
                      <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{formatBRL(row.value)}</Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 999, backgroundColor: props.colors.bg, overflow: "hidden" }}>
                      <View style={{ width: `${Math.max(6, Math.round(ratio * 100))}%`, height: "100%", backgroundColor: props.colors.primary, borderRadius: 999 }} />
                    </View>
                  </View>
                )
              })
            )}
          </SoftCard>

          <View style={{ gap: 8 }}>
            <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Por pessoa</Text>
            {team.length === 0 && (
              <SoftCard colors={props.colors}>
                <Text style={{ color: props.colors.muted }}>Ninguém vendeu neste período.</Text>
              </SoftCard>
            )}
            {team.map((person, index) => {
              const slice = scope === "week" ? person.week : person.month
              return (
                <View
                  key={person.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: props.colors.line,
                  }}
                >
                  <Avatar name={person.name} colors={props.colors} size={40} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ color: props.colors.ink, fontWeight: "700" }} numberOfLines={1}>{person.name}</Text>
                    <Text style={{ color: props.colors.muted, fontSize: 12 }}>
                      {slice.appointmentCount} horário{slice.appointmentCount === 1 ? "" : "s"}
                      {person.role === "professional" ? ` · a pagar ${formatBRL(slice.payableCents)}` : ""}
                    </Text>
                  </View>
                  <Text style={{ color: props.colors.primary, fontWeight: "700" }}>{formatBRL(slice.realizedCents)}</Text>
                </View>
              )
            })}
          </View>

          {scope === "week" && topServices.length > 0 && (
            <SoftCard colors={props.colors} style={{ gap: 10 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Serviços mais feitos</Text>
              {topServices.map((service, index) => (
                <View
                  key={service.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingTop: index === 0 ? 0 : 8,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: props.colors.line,
                  }}
                >
                  <Text style={{ color: props.colors.muted, width: 22, fontWeight: "700" }}>{index + 1}.</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: props.colors.ink, fontWeight: "700" }} numberOfLines={1}>{service.name}</Text>
                    <Text style={{ color: props.colors.muted, fontSize: 12 }}>{service.count}×</Text>
                  </View>
                  <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{formatBRL(service.totalCents)}</Text>
                </View>
              ))}
            </SoftCard>
          )}
        </>
      )}
    </>
  )
}

function LookPanel(props: {
  colors: Paint
  button: ViewStyle
  storeName: string
  logoData: string | null
  chosenColor: string
  message: string
  setMessage: (value: string) => void
  reloadSession: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const mark = props.storeName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "A"

  async function pickColor(hex: string) {
    if (hex === props.chosenColor) return
    props.setMessage("")
    try {
      await api("/api/store", { method: "PATCH", body: JSON.stringify({ brandColor: hex }) })
      await props.reloadSession()
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível mudar a cor.")
    }
  }

  async function pickLogo() {
    props.setMessage("")
    setBusy(true)
    try {
      const ImagePicker = await import("expo-image-picker")
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        props.setMessage("Permita o acesso às fotos para escolher a logo.")
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.55,
        base64: true,
      })
      if (result.canceled || !result.assets[0]) return
      const asset = result.assets[0]
      const mime = asset.mimeType?.includes("png") ? "image/png" : asset.mimeType?.includes("webp") ? "image/webp" : "image/jpeg"
      const base64 = asset.base64
      if (!base64) {
        props.setMessage("Não deu para ler essa imagem. Tente outra.")
        return
      }
      const logoData = `data:${mime};base64,${base64}`
      await api("/api/store", { method: "PATCH", body: JSON.stringify({ logoData }) })
      await props.reloadSession()
      props.setMessage("Logo atualizada.")
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar a logo.")
    } finally {
      setBusy(false)
    }
  }

  async function removeLogo() {
    props.setMessage("")
    setBusy(true)
    try {
      await api("/api/store", { method: "PATCH", body: JSON.stringify({ logoData: null }) })
      await props.reloadSession()
      props.setMessage("Logo removida.")
    } catch (cause) {
      props.setMessage(cause instanceof Error ? cause.message : "Não foi possível remover a logo.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Text style={{ color: props.colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }}>LOGO</Text>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>Aparece no lugar das iniciais no topo do app.</Text>
      <View style={{ alignItems: "center", gap: 14, paddingVertical: 8 }}>
        <Avatar name={props.storeName} mark={mark} uri={props.logoData} colors={props.colors} size={88} solid />
        <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
          <SoftPress style={[props.button, { flex: 1, borderRadius: 14, paddingVertical: 13, opacity: busy ? 0.7 : 1 }]} onPress={() => void pickLogo()} disabled={busy}>
            <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>{props.logoData ? "Trocar logo" : "Inserir logo"}</Text>
          </SoftPress>
          {!!props.logoData && (
            <SoftPress onPress={() => void removeLogo()} disabled={busy} style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: props.colors.danger, paddingVertical: 13, alignItems: "center", opacity: busy ? 0.7 : 1 }}>
              <Text style={{ color: props.colors.danger, fontWeight: "700" }}>Remover</Text>
            </SoftPress>
          )}
        </View>
      </View>

      <Text style={{ color: props.colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginTop: 8 }}>COR DO APP</Text>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>Essa cor aparece para você e para a equipe.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {BRAND_COLORS.map((item) => {
          const active = props.chosenColor === item.hex
          return (
            <SoftPress key={item.hex} onPress={() => void pickColor(item.hex)} accessibilityLabel={item.name} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: item.hex, alignItems: "center", justifyContent: "center", borderWidth: active ? 3 : 0, borderColor: props.colors.ink }}>
              {active && <Ionicons name="checkmark" size={16} color={inkOn(item.hex)} />}
            </SoftPress>
          )
        })}
      </View>
      <Text style={{ color: props.colors.muted }}>{BRAND_COLORS.find((item) => item.hex === props.chosenColor)?.name ?? "Cor da casa"}</Text>
      {!!props.message && <Text style={{ color: props.colors.ink }}>{props.message}</Text>}
    </>
  )
}

function Chip(props: { colors: Paint; active: boolean; label: string; onPress: () => void }) {
  return (
    <SoftPress
      onPress={props.onPress}
      style={{
        borderWidth: 1,
        borderColor: props.active ? props.colors.primary : props.colors.line,
        backgroundColor: props.active ? props.colors.primary : props.colors.bg,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: props.active ? props.colors.onPrimary : props.colors.ink, fontWeight: "700" }}>{props.label}</Text>
    </SoftPress>
  )
}
