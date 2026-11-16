import { formatBRL, type Profession, type Service, type SessionState } from "@rumo/core"
import { verticalById } from "@rumo/theme"
import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import {
  KeyboardAvoidingView,
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
import { api } from "./api"
import { CancelledPanel } from "./CancelledPanel"
import { useLayout } from "./layout"
import { SoftPress } from "./motion"
import { RemindersPanel } from "./RemindersPanel"
import { Atmosphere, PageTitle, SoftCard } from "./ui"

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

type Panel = "cancelled" | "reminders" | "account" | "services" | "help"

const MENU: { id: Panel; title: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "cancelled", title: "Cancelados", hint: "Reverter se cancelou sem querer", icon: "close-circle-outline" },
  { id: "reminders", title: "Lembretes", hint: "Avisos antes do horário", icon: "notifications-outline" },
  { id: "account", title: "Meus dados", hint: "Nome, e-mail e senha", icon: "person-outline" },
  { id: "services", title: "Meus serviços", hint: "O que você atende", icon: "pricetags-outline" },
  { id: "help", title: "Ajuda rápida", hint: "Cancelar, remarcar e reverter", icon: "help-circle-outline" },
]

function formatSpan(total: number) {
  if (total <= 0) return "—"
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return hours === 1 ? "1 hora" : `${hours} horas`
  return `${hours} h ${rest} min`
}

export function StaffMenu(props: {
  session: SessionState
  colors: Paint
  input: TextStyle
  button: ViewStyle
  onLogout: () => Promise<void>
  reloadSession: () => Promise<void>
  onRestored: () => void
  onRemindersSaved: () => void
}) {
  const theme = verticalById(props.session.store!.vertical)
  const [panel, setPanel] = useState<Panel | null>(null)
  const layout = useLayout()

  return (
    <View style={{ flex: 1 }}>
      <Atmosphere colors={props.colors} />
      <ScrollView contentContainerStyle={{ padding: layout.pad, gap: 10, paddingBottom: 48 }}>
        <PageTitle kicker="CONTA" title="Menu" subtitle={`${props.session.store!.name} · ${theme.label}`} colors={props.colors} size={layout.title} />
        <Text style={{ color: props.colors.muted, lineHeight: 20 }}>
          Sua área: cancelados, avisos, conta e serviços.
        </Text>

        <SoftCard colors={props.colors} style={{ paddingVertical: 6, paddingHorizontal: 4, gap: 2 }}>
          {MENU.map((item) => (
            <SoftPress
              key={item.id}
              onPress={() => setPanel(item.id)}
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

        <SoftPress onPress={() => void props.onLogout()} style={{ padding: 14 }}>
          <Text style={{ color: props.colors.danger, textAlign: "center", fontWeight: "700" }}>Sair</Text>
        </SoftPress>
      </ScrollView>

      <PanelSheet visible={panel === "cancelled"} title="Cancelados" colors={props.colors} onClose={() => setPanel(null)}>
        <CancelledPanel
          colors={props.colors}
          owner={false}
          onRestored={() => {
            props.onRestored()
            setPanel(null)
          }}
        />
      </PanelSheet>

      <PanelSheet visible={panel === "reminders"} title="Lembretes" colors={props.colors} onClose={() => setPanel(null)}>
        <RemindersPanel
          colors={props.colors}
          input={props.input}
          button={props.button}
          onSaved={() => {
            props.onRemindersSaved()
            setPanel(null)
          }}
        />
      </PanelSheet>

      <PanelSheet visible={panel === "account"} title="Meus dados" colors={props.colors} onClose={() => setPanel(null)}>
        <AccountPanel
          colors={props.colors}
          input={props.input}
          button={props.button}
          session={props.session}
          reloadSession={props.reloadSession}
        />
      </PanelSheet>

      <PanelSheet visible={panel === "services"} title="Meus serviços" colors={props.colors} onClose={() => setPanel(null)}>
        <ServicesPanel colors={props.colors} professionId={props.session.profile?.professionId ?? null} />
      </PanelSheet>

      <PanelSheet visible={panel === "help"} title="Ajuda rápida" colors={props.colors} onClose={() => setPanel(null)}>
        <HelpPanel colors={props.colors} />
      </PanelSheet>
    </View>
  )
}

function AccountPanel(props: {
  colors: Paint
  input: TextStyle
  button: ViewStyle
  session: SessionState
  reloadSession: () => Promise<void>
}) {
  const [name, setName] = useState(props.session.profile?.fullName ?? props.session.user.name)
  const [email, setEmail] = useState(props.session.user.email)
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: name.trim(),
          email: email.trim(),
          ...(password.trim() ? { password: password.trim() } : {}),
        }),
      })
      setPassword("")
      await props.reloadSession()
      setMessage(password.trim() ? "Dados salvos. Senha atualizada." : "Dados salvos.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>Atualize como você aparece e como entra na conta.</Text>
      <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>NOME</Text>
      <TextInput style={props.input} value={name} onChangeText={setName} placeholder="Seu nome" placeholderTextColor={props.colors.muted} autoCapitalize="words" />
      <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>E-MAIL</Text>
      <TextInput style={props.input} value={email} onChangeText={setEmail} placeholder="E-mail" placeholderTextColor={props.colors.muted} autoCapitalize="none" keyboardType="email-address" />
      <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>NOVA SENHA</Text>
      <TextInput style={props.input} value={password} onChangeText={setPassword} placeholder="Deixe em branco para manter" placeholderTextColor={props.colors.muted} secureTextEntry />
      {!!message && <Text style={{ color: props.colors.primary }}>{message}</Text>}
      {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}
      <SoftPress style={[props.button, { borderRadius: 18, paddingVertical: 16, opacity: saving ? 0.7 : 1 }]} onPress={() => void save()} disabled={saving}>
        <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700", fontSize: 16 }}>{saving ? "Salvando..." : "Salvar"}</Text>
      </SoftPress>
    </>
  )
}

function ServicesPanel(props: { colors: Paint; professionId: string | null }) {
  const [services, setServices] = useState<Service[]>([])
  const [professions, setProfessions] = useState<Profession[]>([])
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const [nextServices, nextProfessions] = await Promise.all([
      api<Service[]>("/api/services"),
      api<Profession[]>("/api/professions").catch(() => [] as Profession[]),
    ])
    setServices(nextServices.filter((item) => item.active))
    setProfessions(nextProfessions)
  }, [])

  useEffect(() => {
    void load().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os serviços.")
    })
  }, [load])

  const profession = professions.find((item) => item.id === props.professionId)

  return (
    <>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>
        {profession
          ? `Serviços da sua profissão (${profession.name}). Só a administração altera preço e duração.`
          : "Serviços ligados à sua conta. Só a administração altera preço e duração."}
      </Text>
      {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}
      {services.length === 0 && !error && (
        <SoftCard colors={props.colors}>
          <Text style={{ color: props.colors.muted }}>Nenhum serviço liberado ainda. Peça para a administração vincular sua profissão.</Text>
        </SoftCard>
      )}
      {services.map((service) => (
        <SoftCard key={service.id} colors={props.colors} style={{ gap: 4 }}>
          <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{service.name}</Text>
          <Text style={{ color: props.colors.muted }}>{formatSpan(service.durationMin)} · {formatBRL(service.priceCents)}</Text>
        </SoftCard>
      ))}
    </>
  )
}

function HelpPanel(props: { colors: Paint }) {
  const tips = [
    { title: "Cancelar", text: "Abra o horário na agenda e toque em Cancelar. Dá para cancelar só aquele dia ou a sequência toda (cliente fixo)." },
    { title: "Reverter", text: "Em Menu → Cancelados, traga de volta se cancelou sem querer. Só este mantém o resto cancelado; este e os próximos reabre a sequência." },
    { title: "Remarcar", text: "Abra o horário, mude o dia ou a hora e salve. Se encostar em outro cliente, o app pede confirmação." },
    { title: "Cliente fixo", text: "Use Repetir neste cliente para deixar o mesmo horário toda semana (ou no ritmo que ele volta)." },
  ]
  return (
    <>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>Três atalhos do dia a dia.</Text>
      {tips.map((tip) => (
        <SoftCard key={tip.title} colors={props.colors} style={{ gap: 6 }}>
          <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{tip.title}</Text>
          <Text style={{ color: props.colors.muted, lineHeight: 20 }}>{tip.text}</Text>
        </SoftCard>
      ))}
    </>
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: props.colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: layout.top + 10, paddingHorizontal: layout.pad, paddingBottom: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: props.colors.line, backgroundColor: props.colors.surface }}>
        <Pressable onPress={props.onClose} hitSlop={10} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={26} color={props.colors.ink} />
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", color: props.colors.ink, fontSize: 18, fontWeight: "700" }}>{props.title}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: layout.pad, gap: 12, paddingBottom: layout.bottom + 36 }}>
        {props.children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
