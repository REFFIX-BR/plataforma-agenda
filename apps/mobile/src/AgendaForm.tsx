import {
  PAYMENT_LABEL,
  dayKey,
  formatBRL,
  formatLongDay,
  formatTime,
  repeatDays,
  weekdayIndex,
  zonedDateTime,
  type AppointmentView,
  type ClientRecord,
  type PaymentMethod,
  type Profession,
  type RepeatUnit,
  type Service,
  type TeamMember,
} from "@rumo/core"
import { titledLabel, verticalById } from "@rumo/theme"
import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useEffect, useRef, useState } from "react"
import {
  Alert,
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
import type { ReactNode } from "react"
import { api } from "./api"
import { useLayout } from "./layout"
import { ClientPicker, DateDialog, TimeDialog } from "./pickers"

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

const PAYMENTS: PaymentMethod[] = ["pix", "cash", "card"]
const WEEKDAY_NAME = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"]
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const REPEAT_UNITS: { id: RepeatUnit; label: string }[] = [
  { id: "days", label: "dias" },
  { id: "weeks", label: "semanas" },
  { id: "months", label: "meses" },
]

function formatSpan(total: number) {
  if (total <= 0) return "—"
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return hours === 1 ? "1 hora" : `${hours} horas`
  return `${hours} h ${rest} min`
}

function titledDay(day: string) {
  const text = formatLongDay(day)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function AgendaForm(props: {
  colors: Paint
  input: TextStyle
  button: ViewStyle
  owner?: boolean
  vertical?: string
  day: string
  time: string | null
  client: ClientRecord | null
  existing: AppointmentView | null
  lockId: string | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const existing = props.existing
  const layout = useLayout()
  const pro = titledLabel(verticalById(props.vertical ?? "estetica").labels.professional)
  const [day, setDay] = useState(existing ? dayKey(existing.startsAt) : props.day)
  const [clock, setClock] = useState<string | null>(existing ? formatTime(existing.startsAt) : props.time)
  const [picked, setPicked] = useState<ClientRecord | null>(
    props.client ??
      (existing
        ? { id: existing.clientId, professionalId: existing.professionalId, professionalName: existing.professionalName, name: existing.clientName, phone: existing.clientPhone, notes: "", visits: 0, spentCents: 0, lastVisit: null }
        : null),
  )
  const [serviceIds, setServiceIds] = useState<string[]>(existing ? existing.services.map((service) => service.serviceId).filter((id): id is string => Boolean(id)) : [])
  const [payment, setPayment] = useState<PaymentMethod | null>(existing?.paymentMethod ?? null)
  const [notes, setNotes] = useState(existing?.notes ?? "")
  const [professionalId, setProfessionalId] = useState(existing?.professionalId ?? props.lockId ?? "")
  const [people, setPeople] = useState<TeamMember[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [professions, setProfessions] = useState<Profession[]>([])
  const [serviceFilter, setServiceFilter] = useState("all")
  const [serviceQuery, setServiceQuery] = useState("")
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [dateOpen, setDateOpen] = useState(false)
  const [timesOpen, setTimesOpen] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [every, setEvery] = useState(7)
  const [unit, setUnit] = useState<RepeatUnit>("days")
  const [months, setMonths] = useState(5)
  const [weekday, setWeekday] = useState(weekdayIndex(existing ? dayKey(existing.startsAt) : props.day))
  const [durationMin, setDurationMin] = useState<number | null>(() => {
    if (!existing) return null
    const span = Math.round((new Date(existing.endsAt).getTime() - new Date(existing.startsAt).getTime()) / 60_000)
    return span >= 5 ? span : null
  })

  useEffect(() => {
    void Promise.all([
      api<TeamMember[]>("/api/team"),
      api<Service[]>("/api/services"),
      props.owner ? api<Profession[]>("/api/professions").catch(() => [] as Profession[]) : Promise.resolve([] as Profession[]),
    ]).then(([nextPeople, nextServices, nextProfessions]) => {
      const attending = nextPeople.filter((person) => person.attends && person.active)
      setPeople(attending)
      setServices(nextServices.filter((service) => service.active))
      setProfessions(nextProfessions.filter((item) => item.active))
      setProfessionalId((current) => current || props.lockId || (attending.length === 1 ? attending[0].id : ""))
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível abrir a agenda."))
  }, [props.lockId, props.owner])

  useEffect(() => {
    if (!professionalId) {
      setClients([])
      return
    }
    void api<ClientRecord[]>(`/api/clients?professionalId=${professionalId}`)
      .then((next) => {
        setClients(next)
        setPicked((current) => current && next.some((item) => item.id === current.id) ? current : current?.id ? current : null)
      })
      .catch(() => undefined)
  }, [professionalId])

  const person = people.find((item) => item.id === professionalId)
  // Admin vê todos os serviços da loja (com filtro). Atendente só os da própria profissão.
  const offered = props.owner
    ? services
    : services.filter((service) => {
        if (!professionalId) return true
        if (service.professionalIds.includes(professionalId)) return true
        if (person?.professionId && service.professionIds.includes(person.professionId)) return true
        return false
      })
  useEffect(() => {
    if (!servicesOpen) return
    setServiceQuery("")
    const preferred = person?.professionId
    setServiceFilter(preferred && offered.some((service) => service.professionIds.includes(preferred)) ? preferred : "all")
  }, [servicesOpen, professionalId])
  const visibleServices = offered.filter((service) => {
    if (serviceFilter !== "all" && !service.professionIds.includes(serviceFilter)) return false
    const needle = serviceQuery.trim().toLowerCase()
    if (!needle) return true
    return service.name.toLowerCase().includes(needle)
  })
  const chosen = offered.filter((service) => serviceIds.includes(service.id))
  const catalogMinutes = chosen.reduce((sum, service) => sum + service.durationMin, 0)
  const minutes = durationMin ?? catalogMinutes
  const priceCents = chosen.reduce((sum, service) => sum + service.priceCents, 0)
  const servicesKey = serviceIds.join(",")
  const firstServices = useRef(servicesKey)
  useEffect(() => {
    if (firstServices.current === servicesKey) return
    firstServices.current = servicesKey
    setDurationMin(null)
  }, [servicesKey])
  const serviceLabel = chosen.map((service) => service.name).join(", ")
  const cancelled = existing?.status === "cancelled"
  const filterProfessions = professions.filter((item) => offered.some((service) => service.professionIds.includes(item.id)))

  function toggleService(id: string) {
    setServiceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    setError("")
  }

  async function createClient(name: string, phone: string) {
    if (!professionalId) throw new Error(`Selecione o ${pro.toLowerCase()}.`)
    const result = await api<{ client: ClientRecord; created: boolean }>("/api/clients", {
      method: "POST",
      body: JSON.stringify({ name, phone, professionalId }),
    })
    setClients((current) => [result.client, ...current.filter((item) => item.id !== result.client.id)])
    setPicked(result.client)
    setClientOpen(false)
  }

  function endClock(start: string, minutes: number) {
    const [hour, minute] = start.split(":").map(Number)
    const total = hour * 60 + minute + minutes
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
  }

  async function save(allowOverlap = false) {
    if (cancelled) return
    if (!picked) {
      setError("Selecione o cliente.")
      return
    }
    if (serviceIds.length === 0) {
      setError("Adicione ao menos um serviço.")
      return
    }
    if (!clock) {
      setError("Selecione o horário.")
      return
    }
    if (!professionalId) {
      setError(`Selecione o ${pro.toLowerCase()}.`)
      return
    }
    setError("")
    setSaving(true)
    try {
      const startsAt = zonedDateTime(day, clock).toISOString()
      if (existing) {
        await api(`/api/appointments/${existing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            serviceIds,
            startsAt,
            clientName: picked.name,
            clientPhone: picked.phone,
            notes,
            ...(payment ? { paymentMethod: payment } : {}),
            ...(allowOverlap ? { allowOverlap: true } : {}),
            ...(minutes >= 5 ? { durationMin: minutes } : {}),
          }),
        })
      } else {
        await api("/api/appointments", {
          method: "POST",
          body: JSON.stringify({
            professionalId,
            serviceIds,
            startsAt,
            clientName: picked.name,
            clientPhone: picked.phone,
            notes,
            ...(payment ? { paymentMethod: payment } : {}),
            ...(allowOverlap ? { allowOverlap: true } : {}),
            ...(minutes >= 5 ? { durationMin: minutes } : {}),
          }),
        })
      }
      await props.onSaved()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível salvar."
      if (!allowOverlap && message.includes("Confirme para marcar")) {
        const until = clock ? endClock(clock, minutes) : ""
        Alert.alert(
          "Marcar mesmo assim?",
          `Esse horário dura ${minutes} minutos${until ? ` e termina às ${until}` : ""}. Ele entra no horário seguinte.`,
          [
            { text: "Voltar", style: "cancel" },
            { text: "Marcar", onPress: () => void save(true) },
          ],
        )
        return
      }
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const futureDays = repeatDays(day, every, unit, months, weekday)
  const clientFirst = (picked?.name ?? "O cliente").split(" ")[0]
  const repeatPreview = futureDays.length === 0
    ? "Nenhum horário entra nesse período."
    : `${clientFirst} fica na agenda toda ${WEEKDAY_NAME[weekday]}, até ${formatLongDay(futureDays[futureDays.length - 1])}. ${futureDays.length} horário${futureDays.length === 1 ? "" : "s"}.`

  async function repeatBooking() {
    if (!existing || futureDays.length === 0) return
    setError("")
    setSaving(true)
    try {
      const startsAt = zonedDateTime(day, clock ?? formatTime(existing.startsAt)).toISOString()
      await api(`/api/appointments/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          serviceIds,
          startsAt,
          clientName: picked?.name ?? existing.clientName,
          clientPhone: picked?.phone ?? existing.clientPhone,
          notes,
          ...(payment ? { paymentMethod: payment } : {}),
          ...(minutes >= 5 ? { durationMin: minutes } : {}),
        }),
      })
      const result = await api<{ created: number; skipped: number; reason: string }>(`/api/appointments/${existing.id}/repeat`, {
        method: "POST",
        body: JSON.stringify({ every, unit, months, weekday }),
      })
      if (result.created === 0) {
        setError(result.reason || "Nenhum horário novo. Esses dias já estavam ocupados ou a agenda fechada.")
        return
      }
      if (result.skipped > 0) {
        setError(`${result.created} horários entraram na agenda. ${result.skipped} não couberam.`)
        return
      }
      setRepeatOpen(false)
      await props.onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível repetir.")
    } finally {
      setSaving(false)
    }
  }

  const ahead = existing?.seriesAhead ?? 1

  function askCancel(scope: "one" | "following") {
    const all = scope === "following"
    Alert.alert(
      all ? "Cancelar todos os horários?" : "Cancelar este horário?",
      all
        ? `${ahead} horários de ${clientFirst} saem da agenda. Os dias que já passaram ficam.`
        : `${clientFirst} sai só deste dia. Os outros horários continuam.`,
      [
        { text: "Voltar", style: "cancel" },
        { text: all ? "Cancelar todos" : "Cancelar este", style: "destructive", onPress: () => void runCancel(scope) },
      ],
    )
  }

  async function runCancel(scope: "one" | "following") {
    if (!existing) return
    setError("")
    setSaving(true)
    try {
      await api(`/api/appointments/${existing.id}/cancel`, { method: "POST", body: JSON.stringify({ scope }) })
      setCancelOpen(false)
      await props.onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cancelar.")
      setSaving(false)
    }
  }

  async function restoreCancelled(scope: "one" | "following", allowOverlap = false) {
    if (!existing) return
    setError("")
    setSaving(true)
    try {
      await api(`/api/appointments/${existing.id}/restore`, {
        method: "POST",
        body: JSON.stringify({ scope, ...(allowOverlap ? { allowOverlap: true } : {}) }),
      })
      await props.onSaved()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível reverter."
      if (!allowOverlap && message.includes("Confirme para marcar")) {
        Alert.alert(
          "Reabrir mesmo assim?",
          "Esse horário encosta em outro na agenda. Confirme para trazer de volta.",
          [
            { text: "Voltar", style: "cancel" },
            { text: "Reabrir", onPress: () => void restoreCancelled(scope, true) },
          ],
        )
        return
      }
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function askRestoreCancelled() {
    if (!existing) return
    const following = existing.cancelledFollowing ?? 0
    if (following <= 0) {
      Alert.alert(
        "Reverter cancelamento?",
        "Este horário volta para a agenda.",
        [
          { text: "Voltar", style: "cancel" },
          { text: "Reverter", onPress: () => void restoreCancelled("one") },
        ],
      )
      return
    }
    Alert.alert(
      "Reverter cancelamento",
      `Há mais ${following} horário${following === 1 ? "" : "s"} cancelado${following === 1 ? "" : "s"} depois deste na sequência.\n\nSó este: os outros continuam cancelados.\nEste e os próximos: traz a sequência de volta.`,
      [
        { text: "Voltar", style: "cancel" },
        { text: "Só este", onPress: () => void restoreCancelled("one") },
        { text: "Este e os próximos", onPress: () => void restoreCancelled("following") },
      ],
    )
  }

  const sheet = (title: string, open: boolean, close: () => void, body: ReactNode) => (
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: props.colors.bg }}>
        <View style={{ backgroundColor: props.colors.primary, paddingTop: layout.top + 12, paddingBottom: 16, flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={close} hitSlop={8} style={{ width: 52, alignItems: "center" }}>
            <Ionicons name="chevron-back" size={26} color={props.colors.onPrimary} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", color: props.colors.onPrimary, fontSize: 18, fontWeight: "700" }}>{title}</Text>
          <View style={{ width: 52 }} />
        </View>
        {body}
      </View>
    </Modal>
  )

  return (
    <>
      <Modal visible animationType="slide" onRequestClose={props.onClose}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: props.colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ backgroundColor: props.colors.primary, paddingTop: layout.top + 12, paddingBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <Pressable onPress={props.onClose} hitSlop={8} style={{ width: 52, alignItems: "center" }}>
              <Ionicons name="chevron-back" size={26} color={props.colors.onPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", color: props.colors.onPrimary, fontSize: 18, fontWeight: "700" }}>Nova agenda</Text>
            <View style={{ width: 52 }} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: layout.pad, gap: layout.gap, paddingBottom: 24 }}>
            <View style={card(props.colors)}>
              <Field icon="calendar-outline" label="Data" value={titledDay(day)} colors={props.colors} onPress={() => setDateOpen(true)} />
              <View style={{ height: 1, backgroundColor: props.colors.line, marginLeft: 62 }} />
              <Field icon="time-outline" label="Hora" value={clock ?? "Selecionar"} emphasize={Boolean(clock)} colors={props.colors} onPress={() => setTimesOpen(true)} />
              <View style={{ height: 1, backgroundColor: props.colors.line, marginLeft: 62 }} />
              <Field icon="person-outline" label="Cliente" value={picked?.name ?? "Selecionar"} colors={props.colors} onPress={() => setClientOpen(true)} />
              <View style={{ height: 1, backgroundColor: props.colors.line, marginLeft: 62 }} />
              <Field icon="pricetag-outline" label="Serviços" value={serviceLabel || "Adicionar"} colors={props.colors} onPress={() => setServicesOpen(true)} />
              <View style={{ height: 1, backgroundColor: props.colors.line, marginLeft: 62 }} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12 }}>
                <View style={iconWell(props.colors)}>
                  <Ionicons name="timer-outline" size={18} color={props.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: props.colors.ink, fontSize: 16 }}>Duração</Text>
                  {catalogMinutes > 0 && minutes !== catalogMinutes && (
                    <Text style={{ color: props.colors.muted, fontSize: 12 }}>No serviço: {catalogMinutes} min</Text>
                  )}
                </View>
                <Pressable onPress={() => setDurationMin(Math.max(5, minutes - 5))} disabled={minutes <= 5} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: props.colors.bg, opacity: minutes <= 5 ? 0.4 : 1 }}>
                  <Ionicons name="remove" size={18} color={props.colors.ink} />
                </Pressable>
                <Text style={{ minWidth: 58, textAlign: "center", color: props.colors.primary, fontWeight: "700" }}>{minutes > 0 ? `${minutes} min` : "—"}</Text>
                <Pressable onPress={() => setDurationMin(Math.min(480, Math.max(5, minutes) + 5))} disabled={minutes >= 480 || minutes === 0} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: props.colors.bg, opacity: minutes >= 480 || minutes === 0 ? 0.4 : 1 }}>
                  <Ionicons name="add" size={18} color={props.colors.ink} />
                </Pressable>
              </View>
              <View style={{ height: 1, backgroundColor: props.colors.line, marginLeft: 62 }} />
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 12, paddingVertical: 12 }}>
                <View style={iconWell(props.colors)}>
                  <Ionicons name="document-text-outline" size={18} color={props.colors.primary} />
                </View>
                <TextInput
                  style={[props.input, { flex: 1, borderWidth: 0, backgroundColor: "transparent", minHeight: 72, textAlignVertical: "top", paddingHorizontal: 0 }]}
                  placeholder="Observação"
                  placeholderTextColor={props.colors.muted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </View>
              <View style={{ height: 1, backgroundColor: props.colors.line, marginLeft: 62 }} />
              <Field icon="card-outline" label="Forma de pagamento" value={payment ? PAYMENT_LABEL[payment] : "Adicionar"} colors={props.colors} onPress={() => setPayOpen(true)} />
              {!existing && people.length > 1 && (
                <>
                  <View style={{ height: 1, backgroundColor: props.colors.line, marginLeft: 62 }} />
                  <Field icon="person-outline" label={pro} value={person?.fullName.split(" ")[0] ?? "Selecionar"} colors={props.colors} onPress={props.lockId ? undefined : () => setPeopleOpen(true)} />
                </>
              )}
            </View>

            <View style={[card(props.colors), { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 18 }]}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 17 }}>Total</Text>
                <Text style={{ color: props.colors.primary, fontWeight: "700", fontSize: 18 }}>{formatSpan(minutes)}</Text>
                {!!clock && minutes > 0 && <Text style={{ color: props.colors.muted }}>Termina às {endClock(clock, minutes)}</Text>}
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>VALOR</Text>
                <Text style={{ color: props.colors.primary, fontWeight: "700", fontSize: 18 }}>{formatBRL(priceCents)}</Text>
              </View>
            </View>

            {existing && !cancelled && (
              <Pressable onPress={() => { setWeekday(weekdayIndex(day)); setRepeatOpen(true); setError("") }} style={[card(props.colors), { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }]}>
                <View style={iconWell(props.colors)}>
                  <Ionicons name="repeat" size={18} color={props.colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Repetir este cliente</Text>
                  <Text style={{ color: props.colors.muted }}>Ele volta no mesmo horário, pelo período que você escolher.</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={props.colors.muted} />
              </Pressable>
            )}

            {existing && !cancelled && (
              <Pressable onPress={() => { setError(""); setCancelOpen(true) }} disabled={saving} style={{ alignItems: "center", paddingVertical: 8 }}>
                <Text style={{ color: props.colors.danger, fontWeight: "700" }}>Cancelar horário</Text>
              </Pressable>
            )}
            {cancelled && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: props.colors.danger, textAlign: "center", fontWeight: "700" }}>Este horário está cancelado.</Text>
                <Text style={{ color: props.colors.muted, textAlign: "center" }}>Se cancelou sem querer, dá para trazer de volta.</Text>
              </View>
            )}
            {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}
          </ScrollView>
          <View style={{ padding: layout.pad, paddingBottom: layout.bottom + 16, backgroundColor: props.colors.bg }}>
            {cancelled ? (
              <Pressable onPress={askRestoreCancelled} disabled={saving} style={[props.button, { borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }]}>
                <Ionicons name="arrow-undo" size={20} color={props.colors.onPrimary} />
                <Text style={{ color: props.colors.onPrimary, fontWeight: "700", fontSize: 17 }}>{saving ? "Revertendo..." : "Reverter agendamento"}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => void save()} disabled={saving} style={[props.button, { borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }]}>
                <Ionicons name="checkmark" size={20} color={props.colors.onPrimary} />
                <Text style={{ color: props.colors.onPrimary, fontWeight: "700", fontSize: 17 }}>{saving ? "Salvando..." : "Salvar"}</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={cancelOpen} animationType="slide" onRequestClose={() => setCancelOpen(false)}>
        <View style={{ flex: 1, backgroundColor: props.colors.bg }}>
          <View style={{ backgroundColor: props.colors.primary, paddingTop: layout.top + 12, paddingBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <Pressable onPress={() => setCancelOpen(false)} hitSlop={8} style={{ width: 52, alignItems: "center" }}>
              <Ionicons name="close" size={26} color={props.colors.onPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", color: props.colors.onPrimary, fontSize: 18, fontWeight: "700" }}>Cancelar</Text>
            <View style={{ width: 52 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: layout.pad, gap: 12, paddingBottom: layout.bottom + 16 }}>
            <Text style={{ color: props.colors.muted }}>Nada sai da agenda até você confirmar. O X fecha sem cancelar.</Text>
            <Pressable onPress={() => askCancel("one")} disabled={saving} style={[card(props.colors), { padding: 16, gap: 4 }]}>
              <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>Só este horário</Text>
              <Text style={{ color: props.colors.muted }}>{titledDay(day)}. Os outros dias de {clientFirst} continuam.</Text>
            </Pressable>
            {ahead > 1 && (
              <Pressable onPress={() => askCancel("following")} disabled={saving} style={[card(props.colors), { padding: 16, gap: 4 }]}>
                <Text style={{ color: props.colors.danger, fontWeight: "700", fontSize: 16 }}>Todos os horários</Text>
                <Text style={{ color: props.colors.muted }}>{ahead} horários ainda na agenda. Os dias que já passaram ficam.</Text>
              </Pressable>
            )}
            {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={repeatOpen} animationType="slide" onRequestClose={() => setRepeatOpen(false)}>
        <View style={{ flex: 1, backgroundColor: props.colors.bg }}>
          <View style={{ backgroundColor: props.colors.primary, paddingTop: layout.top + 12, paddingBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <Pressable onPress={() => setRepeatOpen(false)} hitSlop={8} style={{ width: 52, alignItems: "center" }}>
              <Ionicons name="chevron-back" size={26} color={props.colors.onPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", color: props.colors.onPrimary, fontSize: 18, fontWeight: "700" }}>Repetir</Text>
            <View style={{ width: 52 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: layout.pad, gap: layout.gap, paddingBottom: 24 }}>
            <Text style={{ color: props.colors.muted }}>{clientFirst} continua neste horário e volta sozinho nos próximos.</Text>
            <View style={[card(props.colors), { padding: 16, gap: 14 }]}>
              <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>A CADA</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Stepper colors={props.colors} value={every} min={1} max={30} onChange={setEvery} />
                <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                  {REPEAT_UNITS.map((item) => {
                    const active = unit === item.id
                    return (
                      <Pressable key={item.id} onPress={() => setUnit(item.id)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: active ? props.colors.primary : props.colors.bg }}>
                        <Text style={{ color: active ? props.colors.onPrimary : props.colors.ink, fontWeight: "700", fontSize: 13 }}>{item.label}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </View>
            <View style={[card(props.colors), { padding: 16, gap: 14 }]}>
              <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>PELO PERÍODO DE</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Stepper colors={props.colors} value={months} min={1} max={12} onChange={setMonths} />
                <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>meses</Text>
              </View>
            </View>
            <View style={[card(props.colors), { padding: 16, gap: 12 }]}>
              <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>CAINDO SEMPRE</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {WEEKDAY_SHORT.map((label, index) => {
                  const active = weekday === index
                  return (
                    <Pressable key={label} onPress={() => setWeekday(index)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: active ? props.colors.primary : props.colors.bg }}>
                      <Text style={{ color: active ? props.colors.onPrimary : props.colors.ink, fontWeight: "700", fontSize: 12 }}>{label}</Text>
                    </Pressable>
                  )
                })}
              </View>
              {weekday === 0 && <Text style={{ color: props.colors.muted }}>Domingo a agenda costuma estar fechada. Esses horários não entram.</Text>}
            </View>
            <View style={{ backgroundColor: props.colors.accent, borderRadius: 16, padding: 16 }}>
              <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16, lineHeight: 22 }}>{repeatPreview}</Text>
            </View>
            {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}
          </ScrollView>
          <View style={{ padding: layout.pad, paddingBottom: layout.bottom + 16, backgroundColor: props.colors.bg }}>
            <Pressable onPress={() => void repeatBooking()} disabled={saving || futureDays.length === 0} style={[props.button, { borderRadius: 16, paddingVertical: 16, alignItems: "center", opacity: saving || futureDays.length === 0 ? 0.6 : 1 }]}>
              <Text style={{ color: props.colors.onPrimary, fontWeight: "700", fontSize: 17 }}>{saving ? "Gravando..." : "Gravar repetição"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {dateOpen && <DateDialog colors={props.colors} day={day} onClose={() => setDateOpen(false)} onConfirm={(next) => { setDay(next); setDateOpen(false) }} />}
      {timesOpen && <TimeDialog colors={props.colors} time={clock} onClose={() => setTimesOpen(false)} onConfirm={(next) => { setClock(next); setTimesOpen(false) }} />}
      {clientOpen && (
        <ClientPicker
          colors={props.colors}
          input={props.input}
          clients={clients}
          onClose={() => setClientOpen(false)}
          onPick={(client) => { setPicked(client); setClientOpen(false) }}
          onCreate={createClient}
        />
      )}
      {sheet("Serviços", servicesOpen, () => setServicesOpen(false), (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: props.colors.muted, lineHeight: 20 }}>
              {props.owner && person
                ? `Serviços de ${person.fullName.split(" ")[0]}. Marque um ou mais — o horário soma a duração.`
                : "Marque um ou mais. O horário soma a duração."}
            </Text>
            {props.owner && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: props.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: props.colors.line, paddingHorizontal: 12 }}>
                  <Ionicons name="search" size={18} color={props.colors.muted} />
                  <TextInput
                    style={{ flex: 1, color: props.colors.ink, paddingVertical: 12, fontSize: 16 }}
                    placeholder="Buscar serviço"
                    placeholderTextColor={props.colors.muted}
                    value={serviceQuery}
                    onChangeText={setServiceQuery}
                  />
                </View>
                {filterProfessions.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    <Pressable
                      onPress={() => setServiceFilter("all")}
                      style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: serviceFilter === "all" ? props.colors.primary : props.colors.line, backgroundColor: serviceFilter === "all" ? props.colors.primary : props.colors.surface }}
                    >
                      <Text style={{ color: serviceFilter === "all" ? props.colors.onPrimary : props.colors.ink, fontWeight: "700" }}>Todos · {offered.length}</Text>
                    </Pressable>
                    {filterProfessions.map((item) => {
                      const count = offered.filter((service) => service.professionIds.includes(item.id)).length
                      const active = serviceFilter === item.id
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setServiceFilter(item.id)}
                          style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: active ? props.colors.primary : props.colors.line, backgroundColor: active ? props.colors.primary : props.colors.surface }}
                        >
                          <Text style={{ color: active ? props.colors.onPrimary : props.colors.ink, fontWeight: "700" }}>{item.name} · {count}</Text>
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                )}
              </>
            )}
            {visibleServices.length === 0 && (
              <View style={{ paddingVertical: 28, alignItems: "center", gap: 8 }}>
                <Ionicons name="pricetags-outline" size={26} color={props.colors.muted} />
                <Text style={{ color: props.colors.muted, textAlign: "center", lineHeight: 20 }}>
                  {offered.length === 0
                    ? "Essa pessoa ainda não tem serviços na profissão. Ligue os serviços à profissão no Menu."
                    : "Nenhum serviço nesse filtro."}
                </Text>
              </View>
            )}
            {visibleServices.map((service) => {
              const active = serviceIds.includes(service.id)
              const labels = professions.filter((item) => service.professionIds.includes(item.id)).map((item) => item.name)
              return (
                <Pressable key={service.id} onPress={() => toggleService(service.id)} style={{ backgroundColor: props.colors.surface, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: active ? props.colors.primary : props.colors.line }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{service.name}</Text>
                    <Text style={{ color: props.colors.muted }}>
                      {service.durationMin} min
                      {props.owner && labels.length > 0 ? ` · ${labels.join(" · ")}` : ""}
                    </Text>
                  </View>
                  <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{formatBRL(service.priceCents)}</Text>
                  {active && <Ionicons name="checkmark-circle" size={20} color={props.colors.primary} />}
                </Pressable>
              )
            })}
          </ScrollView>
          <View style={{ padding: 16, paddingBottom: layout.bottom + 16 }}>
            <Pressable onPress={() => setServicesOpen(false)} style={[props.button, { borderRadius: 16, paddingVertical: 16 }]}>
              <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>Usar {chosen.length} serviço{chosen.length === 1 ? "" : "s"}</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {sheet("Forma de pagamento", payOpen, () => setPayOpen(false), (
        <View style={{ padding: 16, gap: 8 }}>
          {PAYMENTS.map((method) => {
            const active = payment === method
            return (
              <Pressable key={method} onPress={() => { setPayment(method); setPayOpen(false) }} style={{ backgroundColor: props.colors.surface, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: active ? props.colors.primary : props.colors.line }}>
                <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{PAYMENT_LABEL[method]}</Text>
                {active && <Ionicons name="checkmark" size={18} color={props.colors.primary} />}
              </Pressable>
            )
          })}
        </View>
      ))}
      {sheet(pro, peopleOpen, () => setPeopleOpen(false), (
        <View style={{ padding: 16, gap: 8 }}>
          {people.map((item) => {
            const active = item.id === professionalId
            return (
              <Pressable key={item.id} onPress={() => { setProfessionalId(item.id); setServiceIds([]); setPicked(null); setPeopleOpen(false) }} style={{ backgroundColor: props.colors.surface, borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{item.fullName}</Text>
                {active && <Ionicons name="checkmark" size={18} color={props.colors.primary} />}
              </Pressable>
            )
          })}
        </View>
      ))}
    </>
  )
}

function card(colors: Paint): ViewStyle {
  return {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: "hidden",
  }
}

function iconWell(colors: Paint): ViewStyle {
  return {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  }
}

function Stepper(props: { colors: Paint; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: props.colors.bg, borderRadius: 14 }}>
      <Pressable onPress={() => props.onChange(Math.max(props.min, props.value - 1))} hitSlop={6} style={{ width: 42, height: 46, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="remove" size={18} color={props.colors.ink} />
      </Pressable>
      <Text style={{ minWidth: 24, textAlign: "center", color: props.colors.ink, fontWeight: "700", fontSize: 18 }}>{props.value}</Text>
      <Pressable onPress={() => props.onChange(Math.min(props.max, props.value + 1))} hitSlop={6} style={{ width: 42, height: 46, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="add" size={18} color={props.colors.ink} />
      </Pressable>
    </View>
  )
}

function Field(props: {
  icon: "calendar-outline" | "time-outline" | "person-outline" | "pricetag-outline" | "card-outline" | "list-outline"
  label: string
  value: string
  colors: Paint
  emphasize?: boolean
  onPress?: () => void
}) {
  const quiet = props.value === "Selecionar" || props.value === "Adicionar" || props.value === "Nomes dos serviços"
  return (
    <Pressable onPress={props.onPress} disabled={!props.onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12 }}>
      <View style={iconWell(props.colors)}>
        <Ionicons name={props.icon} size={18} color={props.colors.primary} />
      </View>
      <Text style={{ color: props.colors.ink, fontSize: 16 }}>{props.label}</Text>
      <Text numberOfLines={1} style={{ flex: 1, textAlign: "right", color: props.emphasize ? props.colors.primary : quiet ? props.colors.muted : props.colors.ink, fontWeight: props.emphasize ? "700" : "500" }}>{props.value}</Text>
      {props.onPress && <Ionicons name="chevron-forward" size={16} color={props.colors.muted} />}
    </Pressable>
  )
}
