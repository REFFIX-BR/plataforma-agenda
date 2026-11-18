import {
  PAYMENT_LABEL,
  addDays,
  dayKey,
  formatBRL,
  formatDay,
  formatLongDay,
  formatPercent,
  formatTime,
  hmToMinutes,
  monthStart,
  nextMonth,
  todayKey,
  weekStart,
  weekdayIndex,
  type AppointmentView,
  type BillingSnapshot,
  type BusinessHour,
  type ClientRecord,
  type FinanceReport,
  type PaymentBreakdown,
  type PaymentMethod,
  type Service,
  type SessionState,
  type TeamMember,
} from "@rumo/core"
import { brandColors, storePaint, titledLabel, verticalById, verticalList, type VerticalId } from "@rumo/theme"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native"
import Ionicons from "@expo/vector-icons/build/Ionicons"
import { api, apiUrl, clearSessionToken, saveSessionToken, TOKEN_KEY } from "./api"
import { AgendaForm } from "./AgendaForm"
import { MonthCalendar } from "./Calendar"
import { ClientsScreen } from "./ClientsScreen"
import { PersonMenu } from "./PersonMenu"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { ScreenEnter, SoftPress, Stagger, cardShadow } from "./motion"
import { useLayout } from "./layout"
import { Atmosphere, Avatar, PageTitle, SoftCard } from "./ui"
import { LoginScreen } from "./LoginScreen"
import { ShopMenu } from "./ShopMenu"
import { SplashBoot } from "./SplashBoot"
import { StaffMenu } from "./StaffMenu"
import { RemindersPanel } from "./RemindersPanel"
import { syncAppointmentReminders } from "./reminders"
import { getItem, setItem } from "./storage"

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
  ok: string
}

type Phase = "boot" | "auth" | "start" | "app"
type Tab = "agenda" | "clients" | "money" | "more"
type AgendaSheet = {
  day: string
  time: string | null
  client: ClientRecord | null
  existing: AppointmentView | null
  lockId: string | null
}

export function Root() {
  const [phase, setPhase] = useState<Phase>("boot")
  const [session, setSession] = useState<SessionState | null>(null)
  const [tab, setTab] = useState<Tab>("agenda")
  const [bootOverlay, setBootOverlay] = useState(true)
  const bootOverlayRef = useRef(true)
  const splashOpacity = useRef(new Animated.Value(1)).current
  const splashScale = useRef(new Animated.Value(1)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentRise = useRef(new Animated.Value(22)).current
  const revealing = useRef(false)

  const vertical = session?.store?.vertical
  const painted = vertical ? storePaint(vertical, session?.store?.brandColor) : null
  const source = painted?.colors
  const colors: Paint = {
    bg: source?.bg ?? brandColors.bg,
    surface: source?.surface ?? brandColors.surface,
    ink: source?.ink ?? brandColors.ink,
    muted: source?.muted ?? brandColors.muted,
    line: source?.line ?? brandColors.line,
    primary: source?.primary ?? brandColors.primary,
    onPrimary: source?.onPrimary ?? brandColors.onPrimary,
    accent: source?.accent ?? brandColors.accent,
    danger: source?.danger ?? brandColors.danger,
    ok: source?.ok ?? brandColors.ok,
  }
  const radius = painted?.radius ?? brandColors.radius
  const screen: ViewStyle = { flex: 1, backgroundColor: colors.bg }
  const ink: TextStyle = { color: colors.ink }
  const muted: TextStyle = { color: colors.muted }
  const input: TextStyle = {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    borderRadius: Math.max(8, radius - 8),
    paddingHorizontal: 12,
    paddingVertical: 12,
  }
  const button: ViewStyle = { backgroundColor: colors.primary, borderRadius: Math.max(8, radius - 8), padding: 14 }
  const ghost: ViewStyle = { borderWidth: 1, borderColor: colors.line, borderRadius: Math.max(8, radius - 8), padding: 12 }

  const revealFromBoot = useCallback((nextPhase: Phase, nextSession: SessionState | null = null) => {
    if (revealing.current || !bootOverlayRef.current) return
    revealing.current = true
    setSession(nextSession)
    setPhase(nextPhase)
    contentOpacity.setValue(0)
    contentRise.setValue(22)
    splashOpacity.setValue(1)
    splashScale.setValue(1)
    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(splashScale, {
        toValue: 1.08,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 520,
        delay: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentRise, {
        toValue: 0,
        duration: 520,
        delay: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return
      bootOverlayRef.current = false
      setBootOverlay(false)
    })
  }, [contentOpacity, contentRise, splashOpacity, splashScale])

  const enter = useCallback(async (next: SessionState | null) => {
    const nextPhase: Phase = next?.store ? "app" : next ? "start" : "auth"
    if (bootOverlayRef.current) {
      revealFromBoot(nextPhase, next)
      return
    }
    setSession(next)
    setPhase(nextPhase)
  }, [revealFromBoot])

  const refreshSession = useCallback(async () => {
    try {
      const next = await api<SessionState | null>("/api/me")
      if (!next?.store) return
      setSession((current) => {
        if (!current?.store) return next
        const sameBrand =
          current.store.brandColor === next.store?.brandColor &&
          current.store.logoData === next.store?.logoData
        const sameBilling =
          current.billing?.access === next.billing?.access &&
          current.billing?.status === next.billing?.status &&
          current.billing?.daysLeft === next.billing?.daysLeft &&
          current.billing?.nextDueDate === next.billing?.nextDueDate &&
          current.billing?.planCents === next.billing?.planCents
        return sameBrand && sameBilling ? current : next
      })
    } catch {
      /* sessão segue com o último estado válido */
    }
  }, [])

  useEffect(() => {
    if (phase !== "app") return
    void refreshSession()
    const timer = setInterval(() => {
      void refreshSession()
    }, 8000)
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshSession()
    })
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [phase, refreshSession])

  useEffect(() => {
    let cancelled = false
    const started = Date.now()
    const minSplashMs = 3000
    const giveUp = setTimeout(() => {
      if (!cancelled) revealFromBoot("auth", null)
    }, 8000)
    void (async () => {
      try {
        const token = await getItem(TOKEN_KEY)
        if (!token) {
          const wait = Math.max(0, minSplashMs - (Date.now() - started))
          if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
          if (!cancelled) revealFromBoot("auth", null)
          return
        }
        const next = await api<SessionState | null>("/api/me")
        const wait = Math.max(0, minSplashMs - (Date.now() - started))
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
        if (!cancelled) await enter(next)
      } catch {
        const wait = Math.max(0, minSplashMs - (Date.now() - started))
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
        if (!cancelled) revealFromBoot("auth", null)
      } finally {
        clearTimeout(giveUp)
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(giveUp)
    }
  }, [enter, revealFromBoot])

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }) } catch { /* a sessão local sai mesmo assim */ }
    await clearSessionToken()
    setSession(null)
    setPhase("auth")
  }

  return (
    <View style={screen}>
      {phase !== "boot" && (
        <Animated.View
          style={{
            flex: 1,
            opacity: contentOpacity,
            transform: [{ translateY: contentRise }],
          }}
        >
          {phase === "auth" && (
            <LoginScreen onDone={async (token, next) => { await saveSessionToken(token); await enter(next) }} />
          )}
          {phase === "start" && session && (
            <Start
              colors={colors}
              input={input}
              button={button}
              ink={ink}
              muted={muted}
              onDone={enter}
            />
          )}
          {phase === "app" && session?.store && session.profile && (
            <Main
              session={session}
              tab={tab}
              setTab={setTab}
              colors={colors}
              radius={radius}
              input={input}
              button={button}
              ghost={ghost}
              ink={ink}
              muted={muted}
              onLogout={logout}
              reloadSession={async () => enter(await api<SessionState | null>("/api/me"))}
            />
          )}
        </Animated.View>
      )}

      {bootOverlay && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              zIndex: 30,
              opacity: splashOpacity,
              transform: [{ scale: splashScale }],
            },
          ]}
        >
          <SplashBoot />
        </Animated.View>
      )}
    </View>
  )
}

function Start(props: {
  colors: Paint
  input: TextStyle
  button: ViewStyle
  ink: TextStyle
  muted: TextStyle
  onDone: (session: SessionState | null) => Promise<void>
}) {
  const [vertical, setVertical] = useState<VerticalId>("estetica")
  const [listOpen, setListOpen] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const chosen = verticalById(vertical)
  const layout = useLayout()

  async function create() {
    setError("")
    try {
      await props.onDone(await api<SessionState>("/api/stores", { method: "POST", body: JSON.stringify({ name, vertical, phone }) }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar.")
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Atmosphere colors={props.colors} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: layout.pad, gap: layout.gap + 4, paddingTop: layout.top + 24, paddingBottom: layout.bottom + 28, width: "100%", maxWidth: layout.contentW, alignSelf: "center" }}
      >
        <PageTitle kicker="SUA LOJA" title="Abrir a loja" subtitle="Você administra. O ramo muda os nomes e os serviços. A cor da agenda você escolhe depois." colors={props.colors} size={layout.title} />
        <SoftCard colors={props.colors} style={{ gap: 12 }}>
          <Text style={{ color: props.colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 }}>NOME DA LOJA</Text>
          <TextInput style={props.input} placeholder="Como a loja se chama" placeholderTextColor={props.colors.muted} value={name} onChangeText={setName} />
          <Text style={{ color: props.colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 }}>TELEFONE</Text>
          <TextInput style={props.input} placeholder="WhatsApp com DDD" keyboardType="phone-pad" placeholderTextColor={props.colors.muted} value={phone} onChangeText={setPhone} />
          <Text style={{ color: props.colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 }}>RAMO</Text>
          <SoftPress onPress={() => setListOpen(true)} style={[props.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
            <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{chosen.label}</Text>
            <Ionicons name="chevron-down" size={18} color={props.colors.muted} />
          </SoftPress>
        </SoftCard>
        {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}
        <SoftPress style={[props.button, { borderRadius: 18, paddingVertical: 16 }]} onPress={() => void create()}>
          <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700", fontSize: 16 }}>Abrir a agenda</Text>
        </SoftPress>
      </ScrollView>
      <Modal visible={listOpen} animationType="slide" onRequestClose={() => setListOpen(false)}>
        <View style={{ flex: 1, backgroundColor: props.colors.bg, paddingTop: layout.top + 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 12 }}>
            <Pressable onPress={() => setListOpen(false)} hitSlop={8} style={{ width: 48, alignItems: "center" }}>
              <Ionicons name="chevron-back" size={26} color={props.colors.ink} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", color: props.colors.ink, fontSize: 18, fontWeight: "700" }}>Ramo</Text>
            <View style={{ width: 48 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            {verticalList.map((item) => {
              const active = item.id === vertical
              return (
                <Pressable key={item.id} onPress={() => { setVertical(item.id); setListOpen(false) }} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: props.colors.line, backgroundColor: active ? props.colors.surface : "transparent" }}>
                  <Text style={{ flex: 1, color: props.colors.ink, fontSize: 17, fontWeight: active ? "700" : "500" }}>{item.label}</Text>
                  {active && <Ionicons name="checkmark" size={20} color={props.colors.primary} />}
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

function Main(props: {
  session: SessionState
  tab: Tab
  setTab: (tab: Tab) => void
  colors: Paint
  radius: number
  input: TextStyle
  button: ViewStyle
  ghost: ViewStyle
  ink: TextStyle
  muted: TextStyle
  onLogout: () => Promise<void>
  reloadSession: () => Promise<void>
}) {
  const theme = verticalById(props.session.store!.vertical)
  const owner = props.session.profile!.role === "owner"
  const profileId = props.session.profile!.id
  const [focusId, setFocusId] = useState(profileId)
  const [sheet, setSheet] = useState<AgendaSheet | null>(null)
  const [agendaRevision, setAgendaRevision] = useState(0)
  const [remindersOpen, setRemindersOpen] = useState(false)
  const [reminderRevision, setReminderRevision] = useState(0)
  const [openPlan, setOpenPlan] = useState(false)
  const [billingWarn, setBillingWarn] = useState<5 | 3 | 1 | null>(null)
  const [paidOk, setPaidOk] = useState(false)
  const [renewCpf, setRenewCpf] = useState("")
  const [renewCep, setRenewCep] = useState("")
  const [renewNumber, setRenewNumber] = useState("")
  const [renewBusy, setRenewBusy] = useState(false)
  const [renewError, setRenewError] = useState("")
  const [renewDemo, setRenewDemo] = useState(false)
  const wasBlocked = useRef(false)
  const billing = props.session.billing
  const blocked = billing?.access === "blocked"
  const onTrial = owner && !blocked && (billing?.status === "trialing" || billing?.status === "none")
  const trialDays = billing?.daysLeft
  const trialUrgent = onTrial && trialDays != null && trialDays <= 3
  const trialLabel = !onTrial
    ? null
    : trialDays == null
      ? "Teste grátis ativo"
      : trialDays < 0
        ? "Teste grátis encerrado"
        : trialDays === 0
          ? "Último dia do teste grátis"
          : trialDays === 1
            ? "Teste grátis · falta 1 dia"
            : `Teste grátis · faltam ${trialDays} dias`
  const tabs = [
    { id: "agenda" as const, label: "Agenda", icon: "calendar" as const, idle: "calendar-outline" as const },
    { id: "clients" as const, label: "Clientes", icon: "chatbubbles" as const, idle: "chatbubbles-outline" as const },
    { id: "money" as const, label: "Caixa", icon: "wallet" as const, idle: "wallet-outline" as const },
    { id: "more" as const, label: "Menu", icon: "menu" as const, idle: "menu-outline" as const },
  ]
  const storeName = props.session.store!.name
  const storeMark = storeName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "A"
  const layout = useLayout()
  const iconButton = { width: layout.compact ? 38 : 42, height: layout.compact ? 38 : 42, borderRadius: 15, backgroundColor: props.colors.bg, borderWidth: 1, borderColor: props.colors.line, alignItems: "center" as const, justifyContent: "center" as const }

  useEffect(() => {
    if (!blocked) return
    setRenewError("")
    void api<BillingSnapshot>("/api/billing")
      .then((next) => {
        if (next.cpfCnpj) setRenewCpf(formatDocInput(next.cpfCnpj))
        setRenewDemo(Boolean(next.demo))
      })
      .catch(() => undefined)
  }, [blocked])

  useEffect(() => {
    if (!blocked) return
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return
      void props.reloadSession().catch(() => undefined)
    })
    return () => sub.remove()
  }, [blocked, props.reloadSession])

  useEffect(() => {
    if (wasBlocked.current && !blocked && owner && billing?.status === "active") {
      setPaidOk(true)
      setOpenPlan(false)
      setRenewBusy(false)
      setRenewError("")
    }
    wasBlocked.current = Boolean(blocked)
  }, [blocked, owner, billing?.status])

  async function renewNow() {
    setRenewBusy(true)
    setRenewError("")
    try {
      const next = await api<BillingSnapshot>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ cpfCnpj: renewCpf, postalCode: renewCep, addressNumber: renewNumber }),
      })
      setRenewDemo(Boolean(next.demo))
      if (next.cpfCnpj) setRenewCpf(formatDocInput(next.cpfCnpj))
      if (!next.checkoutUrl) throw new Error("Não recebi o link de pagamento.")
      const finalUrl = await resolveCheckoutUrl(next.checkoutUrl)
      const can = await Linking.canOpenURL(finalUrl)
      if (!can) throw new Error(`Abra no navegador: ${finalUrl}`)
      await Linking.openURL(finalUrl)
    } catch (cause) {
      setRenewError(cause instanceof Error ? cause.message : "Não foi possível abrir o pagamento.")
    } finally {
      setRenewBusy(false)
    }
  }

  async function renewDemoPay() {
    setRenewBusy(true)
    setRenewError("")
    try {
      await api<BillingSnapshot>("/api/billing/demo-confirm", { method: "POST", body: "{}" })
      await props.reloadSession()
    } catch (cause) {
      setRenewError(cause instanceof Error ? cause.message : "Não foi possível confirmar o pagamento.")
    } finally {
      setRenewBusy(false)
    }
  }

  useEffect(() => {
    if (!owner || !billing?.warnDays || blocked) {
      setBillingWarn(null)
      return
    }
    const key = `billing_warn_${props.session.store!.id}_${billing.warnDays}`
    void getItem(key).then((seen) => {
      if (seen) setBillingWarn(null)
      else setBillingWarn(billing.warnDays)
    })
  }, [owner, blocked, billing?.warnDays, props.session.store])

  async function dismissBillingWarn() {
    if (!billing?.warnDays) {
      setBillingWarn(null)
      return
    }
    await setItem(`billing_warn_${props.session.store!.id}_${billing.warnDays}`, "1")
    setBillingWarn(null)
  }

  return (
    <View style={{ flex: 1 }}>
      <Atmosphere colors={props.colors} />
      <View style={[{ paddingTop: layout.top + 10, paddingHorizontal: layout.pad, paddingBottom: 14, backgroundColor: props.colors.surface, borderBottomWidth: 1, borderBottomColor: props.colors.line, flexDirection: "row", alignItems: "center", gap: layout.compact ? 8 : 12 }, cardShadow]}>
        {owner ? (
          <Avatar name={storeName} mark={storeMark} uri={props.session.store?.logoData} colors={props.colors} size={layout.compact ? 44 : 50} solid />
        ) : (
          <Avatar name={props.session.profile!.fullName} colors={props.colors} size={layout.compact ? 44 : 50} solid />
        )}
        <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: props.colors.ink, fontSize: layout.compact ? 18 : 21, fontWeight: "700", letterSpacing: -0.3 }}>
            {owner ? storeName : props.session.profile!.fullName}
          </Text>
          {owner ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ backgroundColor: props.colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: props.colors.primary, fontSize: 11, fontWeight: "700" }}>{theme.label}</Text>
              </View>
              <Text numberOfLines={1} style={{ color: props.colors.muted, fontSize: 12, flex: 1 }}>Administra a loja</Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {!!props.session.profile!.professionName && (
                <View style={{ backgroundColor: props.colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: props.colors.primary, fontSize: 11, fontWeight: "700" }}>{props.session.profile!.professionName}</Text>
                </View>
              )}
              <Text numberOfLines={1} style={{ color: props.colors.muted, fontSize: 12, flex: 1 }}>
                {storeName}
              </Text>
            </View>
          )}
        </View>
        {owner && !blocked && (
          <SoftPress onPress={() => setRemindersOpen(true)} hitSlop={8} style={iconButton}>
            <Ionicons name="notifications-outline" size={18} color={props.colors.primary} />
          </SoftPress>
        )}
      </View>
      {onTrial && trialLabel && (
        <SoftPress
          onPress={() => {
            props.setTab("more")
            setOpenPlan(true)
          }}
          style={{
            marginHorizontal: layout.pad,
            marginTop: 10,
            marginBottom: 2,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: trialUrgent ? props.colors.danger : props.colors.line,
            backgroundColor: trialUrgent ? "rgba(157,44,44,0.08)" : props.colors.surface,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Ionicons
            name={trialUrgent ? "alert-circle-outline" : "gift-outline"}
            size={18}
            color={trialUrgent ? props.colors.danger : props.colors.primary}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ color: trialUrgent ? props.colors.danger : props.colors.ink, fontWeight: "700", fontSize: 13 }}>
              {trialLabel}
            </Text>
            <Text style={{ color: props.colors.muted, fontSize: 12 }}>
              {trialUrgent ? "Assine para não perder o acesso" : "Toque para ver o plano"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={props.colors.muted} />
        </SoftPress>
      )}
      <View style={{ flex: 1 }}>
        <ScreenEnter id={props.tab}>
        {!blocked && props.tab === "agenda" && <Agenda {...props} filter={owner ? focusId : props.session.profile!.id} setFilter={setFocusId} revision={agendaRevision} onSheet={setSheet} onAdd={() => props.setTab("more")} />}
        {!blocked && props.tab === "clients" && <ClientsScreen colors={props.colors} input={props.input} button={props.button} ink={props.ink} muted={props.muted} owner={owner} vertical={props.session.store!.vertical} filter={owner ? focusId : profileId} setFilter={setFocusId} onAdd={() => props.setTab("more")} onSchedule={(client) => setSheet({ day: todayKey(), time: null, client, existing: null, lockId: client.professionalId || profileId })} />}
        {!blocked && props.tab === "money" && <Money {...props} />}
        {owner && props.tab === "more" && (
          <ShopMenu
            {...props}
            openPlan={openPlan}
            onPlanOpened={() => setOpenPlan(false)}
            onOpenAgenda={(id) => { setFocusId(id); props.setTab("agenda") }}
            onRestored={() => {
              setAgendaRevision((current) => current + 1)
              setReminderRevision((current) => current + 1)
            }}
          />
        )}
        {!owner && !blocked && props.tab === "more" && (
          <StaffMenu
            session={props.session}
            colors={props.colors}
            input={props.input}
            button={props.button}
            onLogout={props.onLogout}
            reloadSession={props.reloadSession}
            onRestored={() => {
              setAgendaRevision((current) => current + 1)
              setReminderRevision((current) => current + 1)
            }}
            onRemindersSaved={() => setReminderRevision((current) => current + 1)}
          />
        )}
        </ScreenEnter>
        {sheet && (
          <AgendaForm
            colors={props.colors}
            input={props.input}
            button={props.button}
            owner={owner}
            vertical={props.session.store!.vertical}
            day={sheet.day}
            time={sheet.time}
            client={sheet.client}
            existing={sheet.existing}
            lockId={sheet.lockId}
            onClose={() => setSheet(null)}
            onSaved={async () => { setSheet(null); setAgendaRevision((current) => current + 1) }}
          />
        )}
        <ReminderEngine profileId={profileId} revision={reminderRevision} />
      </View>
      {remindersOpen && !blocked && (
        <ReminderSettings
          colors={props.colors}
          input={props.input}
          button={props.button}
          onClose={() => setRemindersOpen(false)}
          onSaved={() => { setReminderRevision((value) => value + 1); setRemindersOpen(false) }}
        />
      )}
      {!blocked && <Dock tabs={tabs} active={props.tab} colors={props.colors} onPress={props.setTab} />}
      {blocked && (
        <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
          <View style={{ flex: 1, backgroundColor: "rgba(16,14,12,0.55)", justifyContent: "center", padding: layout.pad }}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={{ backgroundColor: props.colors.surface, borderRadius: 24, borderWidth: 1, borderColor: props.colors.line, padding: 22, gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(157,44,44,0.12)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="lock-closed" size={22} color={props.colors.danger} />
                </View>
                <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>PLANO</Text>
                <Text style={{ color: props.colors.ink, fontSize: 26, fontWeight: "700", letterSpacing: -0.4 }}>
                  {owner ? "Seu plano expirou" : "Agenda indisponível"}
                </Text>
                <Text style={{ color: props.colors.muted, lineHeight: 22, fontSize: 15 }}>
                  {owner
                    ? `Os 30 dias acabaram. Pague um novo Pix de ${formatBRL(billing?.planCents ?? props.session.planCents)} para liberar mais 30 dias em ${storeName}.`
                    : `O acesso à agenda de ${storeName} está pausado. Fale com o administrador para renovar, ou saia da conta.`}
                </Text>
                {owner && (
                  <>
                    <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>CPF OU CNPJ</Text>
                    <TextInput
                      style={[props.input, { borderRadius: 14 }]}
                      value={renewCpf}
                      onChangeText={(value) => setRenewCpf(formatDocInput(value))}
                      placeholder="000.000.000-00"
                      placeholderTextColor={props.colors.muted}
                      keyboardType="number-pad"
                      editable={!renewBusy}
                    />
                    <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>CEP</Text>
                    <TextInput
                      style={[props.input, { borderRadius: 14 }]}
                      value={renewCep}
                      onChangeText={(value) => setRenewCep(formatCepInput(value))}
                      placeholder="00000-000"
                      placeholderTextColor={props.colors.muted}
                      keyboardType="number-pad"
                      editable={!renewBusy}
                    />
                    <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>NÚMERO</Text>
                    <TextInput
                      style={[props.input, { borderRadius: 14 }]}
                      value={renewNumber}
                      onChangeText={setRenewNumber}
                      placeholder="123"
                      placeholderTextColor={props.colors.muted}
                      editable={!renewBusy}
                    />
                    {!!renewError && <Text style={{ color: props.colors.danger }}>{renewError}</Text>}
                    <SoftPress
                      style={[props.button, { borderRadius: 16, paddingVertical: 15, opacity: renewBusy ? 0.7 : 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}
                      onPress={() => void renewNow()}
                      disabled={renewBusy}
                    >
                      {renewBusy ? <ActivityIndicator color={props.colors.onPrimary} /> : <Ionicons name="qr-code-outline" size={18} color={props.colors.onPrimary} />}
                      <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700", fontSize: 16 }}>
                        {renewBusy ? "Abrindo Pix..." : "Pagar Pix · 30 dias"}
                      </Text>
                    </SoftPress>
                    {renewDemo && (
                      <SoftPress onPress={() => void renewDemoPay()} disabled={renewBusy} style={{ paddingVertical: 6 }}>
                        <Text style={{ color: props.colors.primary, textAlign: "center", fontWeight: "700" }}>Simular pagamento (demo)</Text>
                      </SoftPress>
                    )}
                  </>
                )}
                <SoftPress style={{ paddingVertical: 10 }} onPress={() => void props.onLogout()} disabled={renewBusy}>
                  <Text style={{ color: props.colors.danger, textAlign: "center", fontWeight: "700" }}>Sair da conta</Text>
                </SoftPress>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}
      {owner && billingWarn != null && !blocked && (
        <Modal visible transparent animationType="fade" onRequestClose={() => void dismissBillingWarn()}>
          <View style={{ flex: 1, backgroundColor: "rgba(16,14,12,0.45)", justifyContent: "center", padding: layout.pad }}>
            <View style={{ backgroundColor: props.colors.surface, borderRadius: 22, borderWidth: 1, borderColor: props.colors.line, padding: 20, gap: 12 }}>
              <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>AVISO DO PLANO</Text>
              <Text style={{ color: props.colors.ink, fontSize: 24, fontWeight: "700" }}>
                {billingWarn === 1 ? "Falta 1 dia" : `Faltam ${billingWarn} dias`}
              </Text>
              <Text style={{ color: props.colors.muted, lineHeight: 21 }}>
                {billing?.status === "active"
                  ? `A mensalidade de ${storeName} vence em breve. Regularize para a loja não pausar.`
                  : `O teste gratuito de ${storeName} acaba em breve. Assine para continuar marcando horários.`}
              </Text>
              <SoftPress
                style={[props.button, { borderRadius: 14, paddingVertical: 14 }]}
                onPress={() => {
                  void dismissBillingWarn()
                  props.setTab("more")
                  setOpenPlan(true)
                }}
              >
                <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>Ver plano</Text>
              </SoftPress>
              <SoftPress onPress={() => void dismissBillingWarn()} style={{ paddingVertical: 8 }}>
                <Text style={{ color: props.colors.muted, textAlign: "center", fontWeight: "700" }}>Depois</Text>
              </SoftPress>
            </View>
          </View>
        </Modal>
      )}
      {owner && paidOk && billing?.status === "active" && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPaidOk(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(16,14,12,0.45)", justifyContent: "center", padding: layout.pad }}>
            <View style={{ backgroundColor: props.colors.surface, borderRadius: 22, borderWidth: 1, borderColor: props.colors.line, padding: 22, gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: props.colors.accent, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark-circle" size={26} color={props.colors.primary} />
              </View>
              <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>PAGAMENTO CONCLUÍDO</Text>
              <Text style={{ color: props.colors.ink, fontSize: 26, fontWeight: "700", letterSpacing: -0.4 }}>
                Plano ativo
              </Text>
              <Text style={{ color: props.colors.muted, lineHeight: 22, fontSize: 15 }}>
                O pagamento de {formatBRL(billing.planCents)} foi confirmado. A agenda de {storeName} já está liberada.
              </Text>
              {billing.nextDueDate && (
                <View style={{ borderRadius: 16, borderWidth: 1, borderColor: props.colors.line, backgroundColor: props.colors.bg, padding: 14, gap: 4 }}>
                  <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>PRÓXIMO VENCIMENTO</Text>
                  <Text style={{ color: props.colors.ink, fontSize: 20, fontWeight: "700" }}>
                    {/^\d{4}-\d{2}-\d{2}$/.test(billing.nextDueDate)
                      ? billing.nextDueDate.split("-").reverse().join("/")
                      : new Date(billing.nextDueDate).toLocaleDateString("pt-BR")}
                  </Text>
                  <Text style={{ color: props.colors.muted, fontSize: 13 }}>
                    Renovação automática de {formatBRL(billing.planCents)} / mês
                  </Text>
                </View>
              )}
              <SoftPress style={[props.button, { borderRadius: 14, paddingVertical: 14 }]} onPress={() => setPaidOk(false)}>
                <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>Continuar</Text>
              </SoftPress>
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

function Dock(props: {
  tabs: { id: Tab; label: string; icon: "calendar" | "chatbubbles" | "wallet" | "menu"; idle: "calendar-outline" | "chatbubbles-outline" | "wallet-outline" | "menu-outline" }[]
  active: Tab
  colors: Paint
  onPress: (tab: Tab) => void
}) {
  const index = Math.max(0, props.tabs.findIndex((item) => item.id === props.active))
  const [width, setWidth] = useState(0)
  const x = useRef(new Animated.Value(0)).current
  const slot = width / Math.max(props.tabs.length, 1)
  useEffect(() => {
    if (!width) return
    Animated.spring(x, { toValue: index * slot, friction: 8, tension: 90, useNativeDriver: true }).start()
  }, [index, slot, width, x])
  const layout = useLayout()
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[{ flexDirection: "row", backgroundColor: props.colors.surface, paddingTop: 8, paddingBottom: layout.bottom + 4, paddingHorizontal: 6, borderTopWidth: 1, borderColor: props.colors.line }, cardShadow]}>
      {width > 0 && (
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: 6, left: 10, width: Math.max(slot - 14, 0), height: 52, borderRadius: 18, backgroundColor: props.colors.accent, transform: [{ translateX: x }] }} />
      )}
      {props.tabs.map((item) => {
        const active = props.active === item.id
        return (
          <SoftPress key={item.id} onPress={() => props.onPress(item.id)} style={{ flex: 1, minWidth: 0 }}>
            <View style={{ alignItems: "center", gap: 3, paddingVertical: 8 }}>
              <Ionicons name={active ? item.icon : item.idle} size={layout.compact ? 20 : 22} color={active ? props.colors.primary : props.colors.muted} />
              <Text numberOfLines={1} style={{ textAlign: "center", fontSize: layout.compact ? 10 : 11, color: active ? props.colors.primary : props.colors.muted, fontWeight: "700" }}>{item.label}</Text>
            </View>
          </SoftPress>
        )
      })}
    </View>
  )
}

function ReminderEngine(props: { profileId: string; revision: number }) {
  const profileId = props.profileId
  const revision = props.revision
  useEffect(() => {
    let stop = false
    async function run() {
      try {
        const [settings, items] = await Promise.all([
          api<{ minutes: number[] }>("/api/reminders"),
          api<AppointmentView[]>(`/api/appointments?from=${todayKey()}&to=${addDays(todayKey(), 14)}`),
        ])
        if (!stop) await syncAppointmentReminders(profileId, settings.minutes, items)
      } catch {
        // A agenda segue mesmo se o aviso não puder ser marcado agora.
      }
    }
    void run()
    const timer = setInterval(() => { void run() }, 20000)
    return () => { stop = true; clearInterval(timer) }
  }, [profileId, revision])
  return null
}

function ReminderSettings(props: {
  colors: Paint
  input: TextStyle
  button: ViewStyle
  onClose: () => void
  onSaved: () => void
}) {
  const layout = useLayout()
  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: props.colors.bg, padding: layout.pad, paddingTop: layout.top + 16, paddingBottom: layout.bottom + 16, gap: layout.gap }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2, paddingRight: 12, minWidth: 0 }}>
            <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>SEUS HORÁRIOS</Text>
            <Text style={{ color: props.colors.ink, fontSize: layout.title, fontWeight: "700" }}>Avisos</Text>
          </View>
          <Pressable onPress={props.onClose} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: props.colors.surface, borderWidth: 1, borderColor: props.colors.line, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={18} color={props.colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
          <RemindersPanel colors={props.colors} input={props.input} button={props.button} onSaved={props.onSaved} />
        </ScrollView>
      </View>
    </Modal>
  )
}

function Agenda(props: {
  session: SessionState
  colors: Paint
  input: TextStyle
  button: ViewStyle
  ghost: ViewStyle
  ink: TextStyle
  muted: TextStyle
  filter: string
  setFilter: (id: string) => void
  revision: number
  onSheet: (sheet: AgendaSheet) => void
  onAdd?: () => void
}) {
  const owner = props.session.profile!.role === "owner"
  const [day, setDay] = useState(todayKey())
  const [month, setMonth] = useState(monthStart(todayKey()))
  const [items, setItems] = useState<AppointmentView[]>([])
  const [people, setPeople] = useState<TeamMember[]>([])
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [error, setError] = useState("")
  const [report, setReport] = useState<FinanceReport | null>(null)
  const onMonth = useCallback((next: string) => setMonth((current) => (current === next ? current : next)), [])

  const load = useCallback(async () => {
    const from = month
    const to = addDays(nextMonth(month), -1)
    const [nextItems, nextPeople, nextReport, nextHours] = await Promise.all([
      api<AppointmentView[]>(`/api/appointments?from=${from}&to=${to}`),
      api<TeamMember[]>("/api/team"),
      api<FinanceReport>(`/api/finance?anchor=${day}`).catch(() => null),
      api<BusinessHour[]>("/api/hours").catch(() => [] as BusinessHour[]),
    ])
    setItems(nextItems)
    setPeople(nextPeople)
    setReport(nextReport)
    setHours(nextHours)
  }, [day, month, props.revision])

  useEffect(() => { void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Falha ao carregar.")) }, [load])
  useEffect(() => {
    const timer = setInterval(() => { void load().catch(() => undefined) }, 8000)
    return () => clearInterval(timer)
  }, [load])

  const mine = props.session.profile!.id
  const focusId = owner ? (props.filter === "all" ? "" : props.filter) : mine
  const ofDay = items.filter((item) => dayKey(item.startsAt) === day)
  const visible = ofDay.filter((item) => focusId ? item.professionalId === focusId : owner || item.professionalId === mine)
  const marks = [...new Set(items.filter((item) => item.status !== "cancelled" && (focusId ? item.professionalId === focusId : owner || item.professionalId === mine)).map((item) => dayKey(item.startsAt)))]
  const window = dayWindow(hours, focusId || null, day)
  const focusMember = people.find((person) => person.id === focusId)
  const focusFinance = report?.professionals.find((person) => person.id === focusId)
  const roster = people
    .filter((person) => person.active && (person.role === "owner" || person.attends))
    .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner") || a.fullName.localeCompare(b.fullName, "pt-BR"))
  const weekDue = (id: string) => report?.professionals.find((person) => person.id === id)?.week.payableCents ?? 0
  const layout = useLayout()

  return (
    <View style={{ flex: 1 }}>
    {owner && (
      <View style={{ paddingHorizontal: layout.pad, paddingTop: 12, paddingBottom: 6, zIndex: 30, backgroundColor: props.colors.bg }}>
        <PersonMenu
          colors={props.colors}
          caption="agenda de"
          selectedId={props.filter}
          allLabel="Todas"
          people={roster.map((person) => ({
            id: person.id,
            name: person.fullName,
            hint: person.role === "owner" ? "administração" : person.commissionType === "percent" ? `${person.commissionValue}%` : "comissão",
            trailing: person.role === "owner" ? undefined : formatBRL(weekDue(person.id)),
          }))}
          onSelect={props.setFilter}
          onAdd={props.onAdd}
        />
      </View>
    )}
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: layout.pad, gap: layout.gap, paddingBottom: 48 }}>
      <MonthCalendar selected={day} onSelect={setDay} onMonth={onMonth} marks={marks} colors={props.colors} />
      <Text numberOfLines={2} style={{ color: props.colors.ink, fontWeight: "700", fontSize: layout.compact ? 15 : 17, textTransform: "capitalize", letterSpacing: -0.2 }}>{formatLongDay(day)}</Text>
      <DayTimeline
        open={window?.open ?? "06:00"}
        close={window?.close ?? "23:30"}
        closed={!window}
        items={visible}
        colors={props.colors}
        onFree={(time) => props.onSheet({ day, time, client: null, existing: null, lockId: focusId || null })}
        onOpen={(item) => props.onSheet({ day: dayKey(item.startsAt), time: formatTime(item.startsAt), client: null, existing: item, lockId: item.professionalId })}
      />
      {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}
      {owner && report && focusMember?.role === "owner" && focusFinance && (
        <SummaryCard
          kicker="Sua agenda"
          title={focusMember.fullName.split(" ")[0]}
          colors={props.colors}
          tone="plain"
          cells={[
            ["total dia", formatBRL(focusFinance.day.realizedCents)],
            ["acumulado mês", formatBRL(alreadyIn(focusFinance.month))],
            ["total semana", formatBRL(focusFinance.week.realizedCents)],
            ["total mês", formatBRL(focusFinance.month.realizedCents)],
          ]}
        />
      )}
      {owner && report && focusMember?.role !== "owner" && (
        <AdminSplit
          colors={props.colors}
          gross={focusFinance ?? report}
          cut={focusFinance ?? report}
          title={focusMember ? payTitle(focusMember) : `Para os ${verticalById(props.session.store!.vertical).labels.professionals}`}
          caption={focusMember ? `O de cima é o valor cheio. Embaixo está o que vai para ${verticalById(props.session.store!.vertical).labels.professional}.` : "O de cima é o valor cheio da loja. Embaixo está o que vai para a equipe."}
        />
      )}
      {!owner && focusMember && focusFinance && (
        <AttendantFoot
          name={focusMember.fullName}
          percent={focusMember.commissionType === "percent" ? focusMember.commissionValue : 0}
          dayPay={focusFinance.day.payableCents}
          weekPay={focusFinance.week.payableCents}
          monthPay={focusFinance.month.payableCents}
          monthAcc={alreadyPaid(focusFinance.month)}
          colors={props.colors}
        />
      )}
    </ScrollView>
    </View>
  )
}

function dayWindow(hours: BusinessHour[], professionalId: string | null, day: string) {
  if (hours.length === 0) return { open: "06:00", close: "23:30" }
  const weekday = weekdayIndex(day)
  const own = professionalId ? hours.filter((hour) => hour.professionalId === professionalId) : []
  const source = own.length > 0 ? own : hours.filter((hour) => hour.professionalId === null)
  const hour = source.find((item) => item.weekday === weekday)
  if (!hour?.enabled) return null
  return { open: hour.start, close: hour.end }
}

function clockOf(iso: string) {
  return hmToMinutes(formatTime(iso))
}

function clockLabel(total: number) {
  const hour = Math.floor(total / 60)
  const minute = total % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function DayTimeline(props: {
  open: string
  close: string
  closed: boolean
  items: AppointmentView[]
  colors: Paint
  onFree: (time: string) => void
  onOpen: (item: AppointmentView) => void
}) {
  if (props.closed) {
    return (
      <SoftCard colors={props.colors} style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
        <Ionicons name="moon-outline" size={26} color={props.colors.muted} />
        <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Agenda fechada neste dia</Text>
        <Text style={{ color: props.colors.muted, textAlign: "center" }}>Escolha outro dia ou abra o horário na equipe.</Text>
      </SoftCard>
    )
  }
  const openMin = hmToMinutes(props.open)
  const closeMin = hmToMinutes(props.close)
  const blocks = props.items
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({ item, start: clockOf(item.startsAt), end: clockOf(item.endsAt) }))
    .filter((item) => item.end > openMin && item.start < closeMin)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const rows: Array<{ kind: "gap"; time: number } | { kind: "book"; item: AppointmentView; start: number; end: number }> = []
  let cursor = openMin
  const fillGaps = (from: number, until: number) => {
    let tick = from
    if (tick % 30 !== 0) tick += 30 - (tick % 30)
    while (tick < until) {
      rows.push({ kind: "gap", time: tick })
      tick += 30
    }
  }
  for (const block of blocks) {
    if (block.end <= cursor) {
      rows.push({ kind: "book", item: block.item, start: block.start, end: block.end })
      continue
    }
    fillGaps(cursor, Math.min(block.start, closeMin))
    rows.push({ kind: "book", item: block.item, start: block.start, end: block.end })
    cursor = Math.max(cursor, block.end)
  }
  fillGaps(cursor, closeMin)
  if (cursor < closeMin && closeMin % 30 === 0 && !blocks.some((block) => block.start <= closeMin && closeMin < block.end)) {
    rows.push({ kind: "gap", time: closeMin })
  }

  return (
    <SoftCard colors={props.colors} flush>
      {rows.map((row) => {
        if (row.kind === "gap") {
          return (
            <SoftPress key={`gap-${row.time}`} onPress={() => props.onFree(clockLabel(row.time))} style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: props.colors.line }}>
              <Text style={{ textAlign: "center", color: props.colors.muted, fontWeight: "600", letterSpacing: 0.6, fontSize: 15 }}>{clockLabel(row.time)}</Text>
            </SoftPress>
          )
        }
        const marks: number[] = []
        for (let tick = row.start + 30; tick < row.end; tick += 30) marks.push(tick)
        const services = row.item.services.map((service) => service.name)
        return (
          <SoftPress key={row.item.id} onPress={() => props.onOpen(row.item)} style={{ minHeight: Math.max(112, ((row.end - row.start) / 30) * 58), backgroundColor: props.colors.accent, borderBottomWidth: 1, borderBottomColor: props.colors.line, flexDirection: "row" }}>
            <View style={{ width: 6, backgroundColor: props.colors.primary }} />
            <View style={{ flex: 1, paddingTop: 14, paddingBottom: 10, paddingRight: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ width: 68, paddingLeft: 10, gap: 2 }}>
                  <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{formatTime(row.item.startsAt)}</Text>
                  <Text style={{ color: props.colors.muted, fontSize: 11 }}>até {formatTime(row.item.endsAt)}</Text>
                </View>
                <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                  <Text style={{ color: props.colors.primary, fontWeight: "700", fontSize: 14 }}>{formatBRL(row.item.totalCents)}</Text>
                  {(services.length > 0 ? services : ["Horário"]).map((name, index) => (
                    <Text key={`${name}-${index}`} numberOfLines={2} style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{name}</Text>
                  ))}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <Ionicons name="person-outline" size={14} color={props.colors.muted} />
                    <Text numberOfLines={1} style={{ color: props.colors.ink, flex: 1 }}>{row.item.clientName}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={props.colors.muted} />
              </View>
              {marks.map((mark) => (
                <Text key={mark} style={{ color: props.colors.muted, textAlign: "center", marginTop: 14, fontWeight: "600", opacity: 0.7 }}>{clockLabel(mark)}</Text>
              ))}
            </View>
          </SoftPress>
        )
      })}
    </SoftCard>
  )
}

function payTitle(member: TeamMember) {
  const first = member.fullName.split(" ")[0]
  if (member.commissionType === "percent") return `${member.commissionValue}% ${first}`
  return first
}

function alreadyIn(summary: { realizedCents: number; forecastCents: number }) {
  return Math.max(0, summary.realizedCents - summary.forecastCents)
}

function alreadyPaid(summary: { realizedCents: number; forecastCents: number; payableCents: number }) {
  if (summary.realizedCents <= 0) return 0
  return Math.round((summary.payableCents * alreadyIn(summary)) / summary.realizedCents)
}

function AdminSplit(props: {
  colors: Paint
  gross: { day: { realizedCents: number; forecastCents: number }; week: { realizedCents: number }; month: { realizedCents: number; forecastCents: number } }
  cut: { day: { payableCents: number; realizedCents: number; forecastCents: number }; week: { payableCents: number }; month: { payableCents: number; realizedCents: number; forecastCents: number } }
  title: string
  caption: string
}) {
  return (
    <View style={{ gap: 12, paddingTop: 4 }}>
      <SummaryCard
        kicker="100%"
        title="Total da agenda"
        colors={props.colors}
        tone="plain"
        cells={[
          ["total dia", formatBRL(props.gross.day.realizedCents)],
          ["acumulado mês", formatBRL(alreadyIn(props.gross.month))],
          ["total semana", formatBRL(props.gross.week.realizedCents)],
          ["total mês", formatBRL(props.gross.month.realizedCents)],
        ]}
      />
      <SummaryCard
        kicker="A repassar"
        title={props.title}
        colors={props.colors}
        tone="pay"
        cells={[
          ["comissão dia", formatBRL(props.cut.day.payableCents)],
          ["acumulado mês", formatBRL(alreadyPaid(props.cut.month))],
          ["total semana", formatBRL(props.cut.week.payableCents)],
          ["total mês", formatBRL(props.cut.month.payableCents)],
        ]}
      />
      <Text style={{ color: props.colors.muted, textAlign: "center", fontSize: 13 }}>{props.caption}</Text>
    </View>
  )
}

function SummaryCard(props: {
  kicker: string
  title: string
  colors: Paint
  tone: "plain" | "pay"
  cells: [string, string][]
}) {
  const pay = props.tone === "pay"
  const ink = pay ? props.colors.onPrimary : props.colors.ink
  const muted = pay ? "rgba(255,248,246,0.78)" : props.colors.muted
  const line = pay ? "rgba(255,248,246,0.22)" : props.colors.line
  return (
    <View style={[{ backgroundColor: pay ? props.colors.primary : props.colors.surface, borderRadius: 22, padding: 16, gap: 14, borderWidth: pay ? 0 : 1, borderColor: props.colors.line }, pay ? { shadowColor: props.colors.primary, shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 } : cardShadow]}>
      <View style={{ gap: 2, alignItems: pay ? "center" : "flex-start" }}>
        <Text style={{ color: pay ? props.colors.onPrimary : props.colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textAlign: pay ? "center" : "left" }}>{props.kicker}</Text>
        <Text style={{ color: ink, fontSize: 20, fontWeight: "700", textAlign: pay ? "center" : "left" }}>{props.title}</Text>
      </View>
      <View style={{ flexDirection: "row" }}>
        <SummaryCell label={props.cells[0][0]} value={props.cells[0][1]} ink={ink} muted={muted} />
        <View style={{ width: 1, backgroundColor: line }} />
        <SummaryCell label={props.cells[1][0]} value={props.cells[1][1]} ink={ink} muted={muted} />
      </View>
      <View style={{ height: 1, backgroundColor: line }} />
      <View style={{ flexDirection: "row" }}>
        <SummaryCell label={props.cells[2][0]} value={props.cells[2][1]} ink={ink} muted={muted} />
        <View style={{ width: 1, backgroundColor: line }} />
        <SummaryCell label={props.cells[3][0]} value={props.cells[3][1]} ink={ink} muted={muted} />
      </View>
    </View>
  )
}

function SummaryCell(props: { label: string; value: string; ink: string; muted: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 2, minWidth: 0, paddingHorizontal: 4 }}>
      <Text numberOfLines={1} style={{ color: props.muted, fontSize: 12 }}>{props.label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: props.ink, fontWeight: "700", fontSize: 17 }}>{props.value}</Text>
    </View>
  )
}

function AttendantFoot(props: {
  name: string
  percent: number
  dayPay: number
  weekPay: number
  monthPay: number
  monthAcc: number
  colors: Paint
}) {
  const first = props.name.split(" ")[0]
  return (
    <View style={{ paddingTop: 8, gap: 10 }}>
      <Text style={{ color: props.colors.muted, textAlign: "center" }}>{props.percent}% {first}</Text>
      <ControlList
        colors={props.colors}
        rows={[
          ["comissão dia", formatBRL(props.dayPay)],
          ["comissão semana", formatBRL(props.weekPay)],
          ["acumulado mês", formatBRL(props.monthAcc)],
          ["total mês", formatBRL(props.monthPay)],
        ]}
      />
    </View>
  )
}

function ControlList(props: {
  colors: Paint
  rows: [string, string][]
  title?: string
  subtitle?: string
}) {
  return (
    <SoftCard colors={props.colors} style={{ gap: 0, paddingVertical: 6, paddingHorizontal: 4 }}>
      {(props.title || props.subtitle) && (
        <View style={{ gap: 2, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 }}>
          {!!props.title && <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{props.title}</Text>}
          {!!props.subtitle && <Text style={{ color: props.colors.muted, fontSize: 13 }}>{props.subtitle}</Text>}
        </View>
      )}
      {props.rows.map((row, index) => (
        <View
          key={`${row[0]}-${index}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingVertical: 13,
            paddingHorizontal: 12,
            borderTopWidth: index === 0 && !props.title && !props.subtitle ? 0 : 1,
            borderTopColor: props.colors.line,
          }}
        >
          <Text style={{ color: props.colors.muted, flex: 1 }}>{row[0]}</Text>
          <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 17 }}>{row[1]}</Text>
        </View>
      ))}
    </SoftCard>
  )
}

function Money(props: { session: SessionState; colors: Paint; ink: TextStyle; muted: TextStyle; ghost: ViewStyle }) {
  const [anchor, setAnchor] = useState(todayKey())
  const [report, setReport] = useState<FinanceReport | null>(null)
  const [personOpen, setPersonOpen] = useState<FinanceReport["professionals"][number] | null>(null)
  const owner = props.session.profile!.role === "owner"
  const layout = useLayout()
  const labels = verticalById(props.session.store!.vertical).labels
  const pro = titledLabel(labels.professional)
  const pros = labels.professionals

  const load = useCallback(async () => setReport(await api<FinanceReport>(`/api/finance?anchor=${anchor}`)), [anchor])
  useEffect(() => { void load().catch(() => undefined) }, [load])
  useEffect(() => {
    const timer = setInterval(() => { void load().catch(() => undefined) }, 8000)
    return () => clearInterval(timer)
  }, [load])
  useEffect(() => { setPersonOpen(null) }, [anchor])

  const weekFrom = weekStart(anchor)
  const periodLabel = `${formatDay(weekFrom)} a ${formatDay(addDays(weekFrom, 6))}`

  if (!owner) {
    const me = report?.professionals.find((person) => person.id === props.session.profile!.id)
    const percent = props.session.profile!.commissionType === "percent" ? props.session.profile!.commissionValue : 0
    const first = (me?.name ?? props.session.profile!.fullName).split(" ")[0]
    return (
      <View style={{ flex: 1 }}>
        <Atmosphere colors={props.colors} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: layout.pad, gap: layout.gap, paddingBottom: 40 }}>
          <PageTitle
            kicker="CAIXA"
            title="Sua comissão"
            subtitle={`Valores da semana ${periodLabel}. O horário entra quando é marcado.`}
            colors={props.colors}
            size={layout.title}
          />
          <MonthCalendar selected={anchor} onSelect={setAnchor} highlightWeek colors={props.colors} />
          {report && me && (
            <View style={{ gap: 14 }}>
              <View style={[{ backgroundColor: props.colors.primary, borderRadius: 22, padding: 18, gap: 6 }, cardShadow]}>
                <Text style={{ color: props.colors.onPrimary, opacity: 0.85 }}>
                  {percent > 0 ? `${percent}% ${first}` : first} · a receber na semana
                </Text>
                <Text style={{ color: props.colors.onPrimary, fontSize: 34, fontWeight: "700" }}>{formatBRL(me.week.payableCents)}</Text>
                <Text style={{ color: props.colors.onPrimary, opacity: 0.85 }}>
                  {formatLongDay(weekFrom)} a {formatLongDay(addDays(weekFrom, 6))}
                </Text>
              </View>

              <ControlList
                colors={props.colors}
                title="Controle da comissão"
                subtitle="Só o que entra para você."
                rows={[
                  ["comissão dia", formatBRL(me.day.payableCents)],
                  ["comissão semana", formatBRL(me.week.payableCents)],
                  ["acumulado mês", formatBRL(alreadyPaid(me.month))],
                  ["total mês", formatBRL(me.month.payableCents)],
                ]}
              />

              <ControlList
                colors={props.colors}
                title="Faturamento dos seus horários"
                subtitle="100% do valor marcado na sua agenda."
                rows={[
                  ["total dia", formatBRL(me.day.realizedCents)],
                  ["total semana", formatBRL(me.week.realizedCents)],
                  ["acumulado mês", formatBRL(alreadyIn(me.month))],
                  ["total mês", formatBRL(me.month.realizedCents)],
                ]}
              />

              <SoftCard colors={props.colors} style={{ gap: 12 }}>
                <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Como entrou na semana</Text>
                <PaymentLines payments={me.weekPayments} colors={props.colors} />
              </SoftCard>
            </View>
          )}
        </ScrollView>
      </View>
    )
  }

  const storeShare = (report?.week.realizedCents ?? 0) - (report?.week.payableCents ?? 0)
  const team = (report?.professionals ?? []).filter((person) => person.role === "professional")
  const personShare = personOpen ? personOpen.week.realizedCents - personOpen.week.payableCents : 0
  const personServices = personOpen?.weekServices ?? []

  return (
    <View style={{ flex: 1 }}>
      <Atmosphere colors={props.colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: layout.pad, gap: layout.gap, paddingBottom: 48 }}>
        <PageTitle kicker="CAIXA" title="Controle" subtitle={`Semana ${periodLabel}`} colors={props.colors} size={layout.title} />
        <MonthCalendar selected={anchor} onSelect={setAnchor} highlightWeek colors={props.colors} />
        {report && (
          <View style={{ gap: 14 }}>
            <ControlList
              colors={props.colors}
              title="Total da loja"
              subtitle="100% dos horários marcados."
              rows={[
                ["total dia", formatBRL(report.day.realizedCents)],
                ["total semana", formatBRL(report.week.realizedCents)],
                ["acumulado mês", formatBRL(alreadyIn(report.month))],
                ["total mês", formatBRL(report.month.realizedCents)],
              ]}
            />

            <SoftCard colors={props.colors} style={{ gap: 12 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Divisão da semana</Text>
              <MoneyLine label="Fica com a loja" value={formatBRL(storeShare)} colors={props.colors} strong />
              <MoneyLine label={`A pagar aos ${pros}`} value={formatBRL(report.week.payableCents)} colors={props.colors} strong />
              <MoneyLine label="Ainda marcado" value={formatBRL(report.week.forecastCents)} colors={props.colors} />
            </SoftCard>

            <SoftCard colors={props.colors} style={{ gap: 12 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Como entrou o dinheiro</Text>
              <PaymentLines payments={report.weekPayments} colors={props.colors} />
            </SoftCard>

            <View style={{ gap: 4 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 18 }}>Por {pro.toLowerCase()}</Text>
              <Text style={{ color: props.colors.muted, lineHeight: 20 }}>Comissão dia, semana e mês. Toque para detalhar.</Text>
            </View>

            {team.length === 0 && (
              <Text style={{ color: props.colors.muted }}>Nenhum {labels.professional} com horário nesta semana.</Text>
            )}

            {team.map((person, index) => {
              const first = person.name.split(" ")[0]
              const heading =
                person.commissionType === "percent"
                  ? `${person.commissionValue}% ${first}`
                  : first
              return (
                <Stagger key={person.id} index={index}>
                  <SoftPress onPress={() => setPersonOpen(person)}>
                    <ControlList
                      colors={props.colors}
                      title={heading}
                      subtitle={`${person.name} · toque para detalhar`}
                      rows={[
                        ["comissão dia", formatBRL(person.day.payableCents)],
                        ["comissão semana", formatBRL(person.week.payableCents)],
                        ["acumulado mês", formatBRL(alreadyPaid(person.month))],
                        ["total mês", formatBRL(person.month.payableCents)],
                      ]}
                    />
                  </SoftPress>
                </Stagger>
              )
            })}
          </View>
        )}
        <Text style={{ color: props.colors.muted, fontSize: 13, lineHeight: 19 }}>
          A porcentagem de cada {labels.professional} fica no Menu → Equipe. Cancelado não entra no total.
        </Text>
      </ScrollView>

      <FullScreenSheet
        visible={Boolean(personOpen)}
        title={personOpen?.name.split(" ")[0] ?? "Pessoa"}
        colors={props.colors}
        onClose={() => setPersonOpen(null)}
      >
        {personOpen && (
          <>
            <ControlList
              colors={props.colors}
              title="Comissão"
              rows={[
                ["comissão dia", formatBRL(personOpen.day.payableCents)],
                ["comissão semana", formatBRL(personOpen.week.payableCents)],
                ["acumulado mês", formatBRL(alreadyPaid(personOpen.month))],
                ["total mês", formatBRL(personOpen.month.payableCents)],
              ]}
            />
            <ControlList
              colors={props.colors}
              title="Horários (100%)"
              rows={[
                ["total dia", formatBRL(personOpen.day.realizedCents)],
                ["total semana", formatBRL(personOpen.week.realizedCents)],
                ["acumulado mês", formatBRL(alreadyIn(personOpen.month))],
                ["total mês", formatBRL(personOpen.month.realizedCents)],
              ]}
            />
            <SoftCard colors={props.colors} style={{ gap: 10 }}>
              <MoneyLine label="Fica com a loja na semana" value={formatBRL(personShare)} colors={props.colors} strong />
            </SoftCard>
            <SoftCard colors={props.colors} style={{ gap: 12 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Como vendeu</Text>
              <PaymentLines payments={personOpen.weekPayments} colors={props.colors} />
            </SoftCard>
            <SoftCard colors={props.colors} style={{ gap: 10 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Serviços da semana</Text>
              {personServices.length === 0 && (
                <Text style={{ color: props.colors.muted }}>Nenhum horário com valor nesta semana.</Text>
              )}
              {personServices.map((service) => (
                <View key={service.name} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: props.colors.line }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{service.name}</Text>
                    <Text style={{ color: props.colors.muted, fontSize: 12 }}>
                      {service.count}× · comissão {formatBRL(service.payableCents)}
                    </Text>
                  </View>
                  <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{formatBRL(service.totalCents)}</Text>
                </View>
              ))}
            </SoftCard>
          </>
        )}
      </FullScreenSheet>
    </View>
  )
}

function FullScreenSheet(props: {
  visible: boolean
  title: string
  colors: Paint
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={props.onClose}
    >
      <SafeAreaProvider>
        <FullScreenSheetBody title={props.title} colors={props.colors} onClose={props.onClose}>
          {props.children}
        </FullScreenSheetBody>
      </SafeAreaProvider>
    </Modal>
  )
}

function FullScreenSheetBody(props: {
  title: string
  colors: Paint
  onClose: () => void
  children: ReactNode
}) {
  const layout = useLayout()
  return (
    <View style={{ flex: 1, backgroundColor: props.colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: layout.top + 10,
          paddingHorizontal: layout.pad,
          paddingBottom: layout.bottom + 36,
          gap: 12,
          flexGrow: 1,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
          <Pressable onPress={props.onClose} hitSlop={10} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={26} color={props.colors.ink} />
          </Pressable>
          <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", color: props.colors.ink, fontSize: 18, fontWeight: "700" }}>
            {props.title}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        {props.children}
      </ScrollView>
    </View>
  )
}

function PaymentLines(props: { payments?: PaymentBreakdown; colors: Paint; compact?: boolean }) {
  const payments = props.payments
  if (!payments) return null
  const rows: { label: string; value: number }[] = [
    { label: "Pix", value: payments.pixCents },
    { label: "Cartão", value: payments.cardCents },
    { label: "Dinheiro", value: payments.cashCents },
  ]
  if (payments.unsetCents > 0) rows.push({ label: "Sem forma", value: payments.unsetCents })
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  if (total <= 0 && props.compact) return null
  return (
    <View style={{ gap: props.compact ? 6 : 10 }}>
      {!props.compact && total <= 0 && <Text style={{ color: props.colors.muted }}>Ainda sem valor nesta semana.</Text>}
      {rows.map((row) => (
        <MoneyLine key={row.label} label={row.label} value={formatBRL(row.value)} colors={props.colors} strong={row.value > 0 && !props.compact} />
      ))}
    </View>
  )
}

function MoneyLine(props: { label: string; value: string; colors: Paint; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <Text style={{ color: props.colors.muted, flex: 1 }}>{props.label}</Text>
      <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: props.strong ? 18 : 15 }}>{props.value}</Text>
    </View>
  )
}

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

function formatCepInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

async function resolveCheckoutUrl(url: string) {
  try {
    const target = new URL(url)
    if (target.hostname !== "localhost" && target.hostname !== "127.0.0.1") return url
    const base = new URL(await apiUrl())
    target.hostname = base.hostname
    if (base.port === "8081") target.port = "3010"
    else if (base.port) target.port = base.port
    return target.toString()
  } catch {
    return url
  }
}
