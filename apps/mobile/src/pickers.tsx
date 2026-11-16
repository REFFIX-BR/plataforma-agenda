import { addDays, monthStart, nextMonth, weekdayIndex } from "@rumo/core"
import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useState } from "react"
import { Modal, Pressable, ScrollView, Text, TextInput, View, type TextStyle } from "react-native"
import type { ClientRecord } from "@rumo/core"
import { useLayout } from "./layout"

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

const HEADS = ["D", "S", "T", "Q", "Q", "S", "S"]

function pickerDate(day: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(`${day}T12:00:00-03:00`))
}

function monthTitle(day: string) {
  const text = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    month: "long",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00-03:00`))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function monthDays(cursor: string) {
  const start = monthStart(cursor)
  const end = nextMonth(start)
  const days: string[] = []
  for (let day = start; day < end; day = addDays(day, 1)) days.push(day)
  return { lead: weekdayIndex(start), days }
}

function splitClock(value: string | null): [number, number] {
  const match = /(\d{1,2})\D(\d{1,2})/.exec(value ?? "")
  if (!match) return [9, 0]
  return [Math.min(23, Number(match[1])), Math.min(59, Number(match[2]))]
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function spot(index: number, count: number, center: number, rim: number) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  return {
    left: center + Math.cos(angle) * rim - 16,
    top: center + Math.sin(angle) * rim - 16,
  }
}

export function ClientPicker(props: {
  colors: Paint
  input: TextStyle
  clients: ClientRecord[]
  onClose: () => void
  onPick: (client: ClientRecord) => void
  onCreate: (name: string, phone: string) => Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const layout = useLayout()
  const needle = query.trim().toLowerCase()
  const visible = props.clients.filter((client) => {
    if (!needle) return true
    return client.name.toLowerCase().includes(needle) || client.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, ""))
  })

  async function create() {
    setError("")
    try {
      await props.onCreate(name, phone)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o cliente.")
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => (adding ? setAdding(false) : props.onClose())}>
      <View style={{ flex: 1, backgroundColor: props.colors.bg }}>
        <View style={{ backgroundColor: props.colors.primary, paddingTop: layout.top + 12, paddingBottom: 16, flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => (adding ? setAdding(false) : props.onClose())} hitSlop={8} style={{ width: 52, alignItems: "center" }}>
            <Ionicons name="chevron-back" size={26} color={props.colors.onPrimary} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", color: props.colors.onPrimary, fontSize: 18, fontWeight: "700" }}>{adding ? "Novo cliente" : "Clientes"}</Text>
          {adding ? <View style={{ width: 52 }} /> : (
            <Pressable onPress={() => setAdding(true)} hitSlop={8} style={{ width: 52, alignItems: "center" }}>
              <Ionicons name="person-add-outline" size={22} color={props.colors.onPrimary} />
            </Pressable>
          )}
        </View>
        {adding ? (
          <View style={{ padding: layout.pad, gap: 12, paddingBottom: layout.bottom + 16 }}>
            <TextInput style={props.input} placeholder="Nome" placeholderTextColor={props.colors.muted} value={name} onChangeText={setName} />
            <TextInput style={props.input} placeholder="WhatsApp com DDD" keyboardType="phone-pad" placeholderTextColor={props.colors.muted} value={phone} onChangeText={setPhone} />
            {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}
            <Pressable onPress={() => void create()} style={{ backgroundColor: props.colors.primary, borderRadius: 16, paddingVertical: 16 }}>
              <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700", fontSize: 16 }}>Salvar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ margin: layout.pad, backgroundColor: props.colors.surface, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={props.colors.muted} />
              <TextInput style={[props.input, { flex: 1, borderWidth: 0, backgroundColor: "transparent" }]} placeholder="Pesquisar" placeholderTextColor={props.colors.muted} value={query} onChangeText={setQuery} />
            </View>
            {visible.length === 0 ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 80, paddingHorizontal: layout.pad }}>
                <Ionicons name="people-outline" size={54} color={props.colors.muted} />
                <Text style={{ color: props.colors.muted, textAlign: "center" }}>{props.clients.length === 0 ? "Não existem clientes registrados." : "Nenhum cliente encontrado."}</Text>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: layout.bottom + 100 }}>
                {visible.map((client) => (
                  <Pressable key={client.id} onPress={() => props.onPick(client)} style={{ paddingHorizontal: layout.pad + 4, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: props.colors.line }}>
                    <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{client.name}</Text>
                    <Text style={{ color: props.colors.muted }}>{client.phone}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable onPress={() => setAdding(true)} style={{ position: "absolute", right: layout.pad, bottom: layout.bottom + 16, backgroundColor: props.colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: props.colors.onPrimary, fontSize: 18, fontWeight: "700" }}>+</Text>
              <Text style={{ color: props.colors.onPrimary, fontWeight: "700" }}>Novo cliente</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  )
}

export function DateDialog(props: { colors: Paint; day: string; onClose: () => void; onConfirm: (day: string) => void }) {
  const [draft, setDraft] = useState(props.day)
  const [cursor, setCursor] = useState(monthStart(props.day))
  const { lead, days } = monthDays(cursor)
  const cells: Array<string | null> = [...Array(lead).fill(null), ...days]
  const layout = useLayout()
  const daySize = Math.max(28, Math.min(36, layout.daySize))

  return (
    <Modal transparent animationType="fade" visible onRequestClose={props.onClose}>
      <Pressable onPress={props.onClose} style={{ flex: 1, backgroundColor: "rgba(42, 33, 28, 0.45)", justifyContent: "center", padding: layout.pad }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: props.colors.surface, borderRadius: 28, overflow: "hidden", width: "100%", maxWidth: 420, alignSelf: "center" }}>
          <View style={{ backgroundColor: props.colors.primary, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, gap: 8 }}>
            <Text style={{ color: props.colors.onPrimary, fontSize: 12, letterSpacing: 1, fontWeight: "700" }}>SELECIONE A DATA</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text numberOfLines={1} style={{ color: props.colors.onPrimary, fontSize: layout.compact ? 24 : 30, fontWeight: "500", flex: 1 }}>{pickerDate(draft)}</Text>
              <Ionicons name="pencil" size={20} color={props.colors.onPrimary} />
            </View>
          </View>
          <View style={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, marginBottom: 8 }}>
              <Text style={{ flex: 1, color: props.colors.ink, fontSize: 15 }}>{monthTitle(cursor)}</Text>
              <Pressable onPress={() => setCursor(monthStart(addDays(monthStart(cursor), -1)))} hitSlop={8} style={{ padding: 8 }}>
                <Ionicons name="chevron-back" size={20} color={props.colors.ink} />
              </Pressable>
              <Pressable onPress={() => setCursor(nextMonth(cursor))} hitSlop={8} style={{ padding: 8 }}>
                <Ionicons name="chevron-forward" size={20} color={props.colors.ink} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row" }}>
              {HEADS.map((head, index) => (
                <Text key={`${head}-${index}`} style={{ flex: 1, textAlign: "center", color: props.colors.muted, fontSize: 12 }}>{head}</Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((day, index) => {
                const selected = day === draft
                return (
                  <View key={day ?? `empty-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
                    {day && (
                      <Pressable onPress={() => setDraft(day)} style={{ width: daySize, height: daySize, borderRadius: daySize / 2, alignItems: "center", justifyContent: "center", backgroundColor: selected ? props.colors.primary : "transparent" }}>
                        <Text style={{ color: selected ? props.colors.onPrimary : props.colors.ink }}>{Number(day.slice(8))}</Text>
                      </Pressable>
                    )}
                  </View>
                )
              })}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, paddingVertical: 8, paddingRight: 8 }}>
              <Pressable onPress={props.onClose} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ color: props.colors.primary, fontWeight: "700" }}>CANCELAR</Text>
              </Pressable>
              <Pressable onPress={() => props.onConfirm(draft)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ color: props.colors.primary, fontWeight: "700" }}>OK</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export function TimeDialog(props: { colors: Paint; time: string | null; onClose: () => void; onConfirm: (time: string) => void }) {
  const initial = splitClock(props.time)
  const [hour, setHour] = useState(initial[0])
  const [minute, setMinute] = useState(initial[1])
  const [face, setFace] = useState<"hour" | "minute">("hour")
  const [keyboard, setKeyboard] = useState(false)
  const layout = useLayout()
  const clock = layout.clock
  const center = clock / 2
  const rim = clock * 0.39
  const steps = face === "hour" ? 24 : 60
  const value = face === "hour" ? hour : minute
  const labels = face === "hour"
    ? Array.from({ length: 12 }, (_, index) => index * 2)
    : Array.from({ length: 12 }, (_, index) => index * 5)
  const digit = layout.compact ? 36 : 46

  function pick(x: number, y: number) {
    const dx = x - center
    const dy = y - center
    let angle = Math.atan2(dx, -dy)
    if (angle < 0) angle += Math.PI * 2
    const next = Math.round((angle / (Math.PI * 2)) * steps) % steps
    if (face === "hour") setHour(next)
    else setMinute(next)
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={props.onClose}>
      <Pressable onPress={props.onClose} style={{ flex: 1, backgroundColor: "rgba(42, 33, 28, 0.45)", justifyContent: "center", padding: layout.pad }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: props.colors.surface, borderRadius: 28, overflow: "hidden", paddingBottom: 8, width: "100%", maxWidth: 420, alignSelf: "center" }}>
          <Text style={{ color: props.colors.muted, fontSize: 12, letterSpacing: 1, fontWeight: "700", paddingHorizontal: 20, paddingTop: 18 }}>SELECIONE O HORÁRIO</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 }}>
            <Pressable onPress={() => { setFace("hour"); setKeyboard(false) }} style={{ minWidth: layout.compact ? 72 : 92, paddingVertical: 10, borderRadius: 12, backgroundColor: face === "hour" ? "rgba(141, 74, 85, 0.14)" : props.colors.bg, alignItems: "center" }}>
              <Text style={{ color: face === "hour" ? props.colors.primary : props.colors.ink, fontSize: digit, fontWeight: "500" }}>{pad(hour)}</Text>
            </Pressable>
            <Text style={{ color: props.colors.ink, fontSize: digit - 4 }}>:</Text>
            <Pressable onPress={() => { setFace("minute"); setKeyboard(false) }} style={{ minWidth: layout.compact ? 72 : 92, paddingVertical: 10, borderRadius: 12, backgroundColor: face === "minute" ? "rgba(141, 74, 85, 0.14)" : props.colors.bg, alignItems: "center" }}>
              <Text style={{ color: face === "minute" ? props.colors.primary : props.colors.ink, fontSize: digit, fontWeight: "500" }}>{pad(minute)}</Text>
            </Pressable>
          </View>
          {keyboard ? (
            <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
              <TextInput keyboardType="number-pad" value={pad(hour)} onChangeText={(text) => setHour(Math.min(23, Number(text.replace(/\D/g, "")) || 0))} style={{ flex: 1, borderWidth: 1, borderColor: props.colors.line, borderRadius: 12, textAlign: "center", fontSize: 28, color: props.colors.ink, paddingVertical: 10 }} />
              <TextInput keyboardType="number-pad" value={pad(minute)} onChangeText={(text) => setMinute(Math.min(59, Number(text.replace(/\D/g, "")) || 0))} style={{ flex: 1, borderWidth: 1, borderColor: props.colors.line, borderRadius: 12, textAlign: "center", fontSize: 28, color: props.colors.ink, paddingVertical: 10 }} />
            </View>
          ) : (
            <View
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(event) => pick(event.nativeEvent.locationX, event.nativeEvent.locationY)}
              onResponderMove={(event) => pick(event.nativeEvent.locationX, event.nativeEvent.locationY)}
              style={{ width: clock, height: clock, alignSelf: "center", borderRadius: clock / 2, backgroundColor: props.colors.bg }}
            >
              <View pointerEvents="none" style={{ position: "absolute", width: clock, height: clock, transform: [{ rotate: `${(value / steps) * 360}deg` }] }}>
                <View style={{ position: "absolute", left: center - 1, top: center - rim, width: 2, height: rim, backgroundColor: props.colors.primary }} />
                <View style={{ position: "absolute", left: center - 18, top: center - rim - 18, width: 36, height: 36, borderRadius: 18, backgroundColor: props.colors.primary }} />
              </View>
              <View pointerEvents="none" style={{ position: "absolute", left: center - 4, top: center - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: props.colors.primary }} />
              {labels.map((label) => {
                const place = spot(label, steps, center, rim)
                const selected = label === value
                return (
                  <Pressable key={label} onPress={() => (face === "hour" ? setHour(label) : setMinute(label))} style={{ position: "absolute", width: 32, height: 32, alignItems: "center", justifyContent: "center", left: place.left, top: place.top }}>
                    <Text style={{ color: selected ? props.colors.onPrimary : props.colors.ink, fontWeight: "600" }}>{pad(label)}</Text>
                  </Pressable>
                )
              })}
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8 }}>
            <Pressable onPress={() => setKeyboard((current) => !current)} hitSlop={8} style={{ padding: 12 }}>
              <Ionicons name={keyboard ? "time-outline" : "keypad-outline"} size={22} color={props.colors.muted} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={props.onClose} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: props.colors.primary, fontWeight: "700" }}>CANCELAR</Text>
            </Pressable>
            <Pressable onPress={() => props.onConfirm(`${pad(hour)}:${pad(minute)}`)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: props.colors.primary, fontWeight: "700" }}>OK</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
