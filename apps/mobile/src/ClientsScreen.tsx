import { dayKey, formatBRL, formatLongDay, type ClientRecord, type TeamMember } from "@rumo/core"
import { titledLabel, verticalById } from "@rumo/theme"
import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useCallback, useEffect, useState } from "react"
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native"
import { api } from "./api"
import { useLayout } from "./layout"
import { SoftPress, Stagger } from "./motion"
import { PersonMenu } from "./PersonMenu"
import { Atmosphere, Avatar, PageTitle, SoftCard } from "./ui"

type Colors = {
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

function whatsappUrl(phone: string) {
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`
  if (digits.length < 12) return null
  return `https://wa.me/${digits}`
}

export function ClientsScreen(props: {
  colors: Colors
  input: TextStyle
  button: ViewStyle
  ink: TextStyle
  muted: TextStyle
  owner: boolean
  vertical: string
  filter: string
  setFilter: (id: string) => void
  onAdd?: () => void
  onSchedule: (client: ClientRecord) => void
}) {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [people, setPeople] = useState<TeamMember[]>([])
  const [viewFilter, setViewFilter] = useState(props.owner ? "all" : props.filter)
  const [assignTo, setAssignTo] = useState(props.owner ? "all" : props.filter)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const labels = verticalById(props.vertical).labels
  const pro = titledLabel(labels.professional)

  const load = useCallback(async () => {
    const [nextClients, nextPeople] = await Promise.all([
      api<ClientRecord[]>("/api/clients"),
      props.owner ? api<TeamMember[]>("/api/team") : Promise.resolve([] as TeamMember[]),
    ])
    setClients(nextClients)
    setPeople(nextPeople.filter((person) => person.active && (person.role === "owner" || person.attends)).sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner") || a.fullName.localeCompare(b.fullName, "pt-BR")))
  }, [props.owner])

  useEffect(() => {
    void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar os clientes."))
  }, [load])

  useEffect(() => {
    if (!props.owner) {
      setViewFilter(props.filter)
      setAssignTo(props.filter)
    }
  }, [props.owner, props.filter])

  function selectView(id: string) {
    setViewFilter(id)
    if (props.owner) {
      if (id !== "all") setAssignTo(id)
      props.setFilter(id === "all" ? props.filter : id)
    } else {
      props.setFilter(id)
    }
  }

  async function save() {
    setError("")
    setMessage("")
    if (!name.trim() || !phone.trim()) {
      setError("Preencha nome e WhatsApp.")
      return
    }
    try {
      if (props.owner && !assignTo) {
        setError("Escolha para quem fica este cliente.")
        return
      }
      const body = props.owner
        ? assignTo === "all"
          ? { name, phone, forAll: true }
          : { name, phone, professionalId: assignTo }
        : { name, phone }
      const result = await api<{
        client: ClientRecord
        clients?: ClientRecord[]
        created: boolean
        createdCount?: number
        updatedCount?: number
      }>("/api/clients", {
        method: "POST",
        body: JSON.stringify(body),
      })
      setName("")
      setPhone("")
      setFormOpen(false)
      if (props.owner && assignTo === "all") {
        const created = result.createdCount ?? 0
        const updated = result.updatedCount ?? 0
        setMessage(
          created > 0
            ? `${result.client.name} entrou na lista de ${created} pessoa${created === 1 ? "" : "s"}.`
            : updated > 0
              ? `${result.client.name} já estava nas listas — atualizei o nome.`
              : "Cliente salvo.",
        )
      } else {
        setMessage(
          result.created
            ? `${result.client.name} entrou na lista${props.owner ? ` de ${result.client.professionalName.split(" ")[0]}` : ""}.`
            : "Esse WhatsApp já estava nesta lista. Atualizei o nome.",
        )
      }
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    }
  }

  async function openWhatsApp(client: ClientRecord) {
    const url = whatsappUrl(client.phone)
    if (!url) {
      setError("Esse número não abre no WhatsApp. Inclua o DDD.")
      return
    }
    setError("")
    await Linking.openURL(url)
  }

  const layout = useLayout()
  const needle = query.trim().toLowerCase()
  const countOf = (id: string) => clients.filter((client) => client.professionalId === id).length
  const visible = clients.filter((client) => {
    if (props.owner && viewFilter !== "all" && client.professionalId !== viewFilter) return false
    if (!props.owner && client.professionalId !== props.filter) return false
    if (!needle) return true
    return client.name.toLowerCase().includes(needle) || client.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, ""))
  })
  const viewLabel =
    viewFilter === "all"
      ? "Todos"
      : people.find((person) => person.id === viewFilter)?.fullName.split(" ")[0] ?? "Lista"

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Atmosphere colors={props.colors} />
      <View style={{ paddingHorizontal: layout.pad, paddingTop: 14, paddingBottom: 8, gap: layout.gap, zIndex: 30, backgroundColor: props.colors.bg }}>
        <PageTitle kicker="LISTA" title="Clientes" colors={props.colors} size={layout.title} />
        {props.owner && (
          <PersonMenu
            colors={props.colors}
            caption="clientes de"
            selectedId={viewFilter}
            allLabel={`Todos · ${clients.length}`}
            people={people.map((person) => ({
              id: person.id,
              name: person.fullName,
              hint: person.role === "owner" ? "administração" : pro.toLowerCase(),
              trailing: String(countOf(person.id)),
            }))}
            onSelect={selectView}
            onAdd={props.onAdd}
          />
        )}
      </View>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: layout.pad, gap: layout.gap, paddingBottom: 48 }}>
        <Text style={{ color: props.colors.muted, fontSize: 14, lineHeight: 20 }}>
          {props.owner
            ? viewFilter === "all"
              ? "Lista completa da loja. Escolha Carol, Junior etc. para ver só os clientes daquela pessoa."
              : `Mostrando só os clientes de ${viewLabel}.`
            : `Só os seus clientes. Outro ${labels.professional} da loja não vê esta lista.`}
        </Text>

        {props.owner && people.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <SoftPress
              onPress={() => selectView("all")}
              style={{
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: viewFilter === "all" ? props.colors.primary : props.colors.line,
                backgroundColor: viewFilter === "all" ? props.colors.primary : props.colors.surface,
              }}
            >
              <Text style={{ color: viewFilter === "all" ? props.colors.onPrimary : props.colors.ink, fontWeight: "700" }}>Todos · {clients.length}</Text>
            </SoftPress>
            {people.map((person) => {
              const active = viewFilter === person.id
              const count = countOf(person.id)
              return (
                <SoftPress
                  key={person.id}
                  onPress={() => selectView(person.id)}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: active ? props.colors.primary : props.colors.line,
                    backgroundColor: active ? props.colors.primary : props.colors.surface,
                  }}
                >
                  <Text style={{ color: active ? props.colors.onPrimary : props.colors.ink, fontWeight: "700" }}>
                    {person.fullName.split(" ")[0]} · {count}
                  </Text>
                </SoftPress>
              )
            })}
          </ScrollView>
        )}

        <SoftPress style={[props.button, { borderRadius: 16, paddingVertical: 14 }]} onPress={() => setFormOpen((open) => !open)}>
          <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>
            {formOpen ? "Fechar" : "Novo cliente"}
          </Text>
        </SoftPress>

        {formOpen && (
          <SoftCard colors={props.colors} style={{ gap: 12 }}>
            <TextInput style={props.input} placeholder="Nome" placeholderTextColor={props.colors.muted} value={name} onChangeText={setName} />
            <TextInput style={props.input} placeholder="WhatsApp com DDD" keyboardType="phone-pad" placeholderTextColor={props.colors.muted} value={phone} onChangeText={setPhone} />
            {props.owner && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: props.colors.ink, fontWeight: "700" }}>Salvar para</Text>
                <Text style={{ color: props.colors.muted, fontSize: 13, lineHeight: 18 }}>
                  Todos coloca o cliente na lista de cada {labels.professional}. Ou escolha só uma pessoa.
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <SoftPress
                    onPress={() => setAssignTo("all")}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: assignTo === "all" ? props.colors.primary : props.colors.line,
                      backgroundColor: assignTo === "all" ? props.colors.primary : props.colors.bg,
                    }}
                  >
                    <Text style={{ color: assignTo === "all" ? props.colors.onPrimary : props.colors.ink, fontWeight: "700" }}>Todos</Text>
                  </SoftPress>
                  {people.map((person) => {
                    const active = assignTo === person.id
                    return (
                      <SoftPress
                        key={person.id}
                        onPress={() => setAssignTo(person.id)}
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderWidth: 1,
                          borderColor: active ? props.colors.primary : props.colors.line,
                          backgroundColor: active ? props.colors.primary : props.colors.bg,
                        }}
                      >
                        <Text style={{ color: active ? props.colors.onPrimary : props.colors.ink, fontWeight: "700" }}>
                          {person.fullName.split(" ")[0]}
                        </Text>
                      </SoftPress>
                    )
                  })}
                </View>
              </View>
            )}
            <SoftPress onPress={() => void save()} style={[props.button, { borderRadius: 16, paddingVertical: 14 }]}>
              <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700" }}>
                {props.owner
                  ? assignTo === "all"
                    ? "Salvar para todos"
                    : `Salvar para ${people.find((person) => person.id === assignTo)?.fullName.split(" ")[0] ?? pro}`
                  : "Salvar na minha lista"}
              </Text>
            </SoftPress>
          </SoftCard>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: props.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: props.colors.line, paddingHorizontal: 14 }}>
          <Ionicons name="search" size={18} color={props.colors.muted} />
          <TextInput style={{ flex: 1, color: props.colors.ink, paddingVertical: 14, fontSize: 16 }} placeholder="Buscar por nome ou número" placeholderTextColor={props.colors.muted} value={query} onChangeText={setQuery} />
        </View>

        {!!message && <Text style={{ color: props.colors.ink }}>{message}</Text>}
        {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}

        <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>
          {viewFilter === "all" ? "TODOS" : viewLabel.toUpperCase()} · {visible.length}
        </Text>

        {visible.map((client, index) => (
          <Stagger key={client.id} index={index}>
            <SoftCard colors={props.colors} style={{ gap: 12 }}>
              <SoftPress onPress={() => props.onSchedule(client)} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Avatar name={client.name} colors={props.colors} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: props.colors.ink, fontSize: 17, fontWeight: "700" }}>{client.name}</Text>
                  {props.owner && viewFilter === "all" && !!client.professionalName && (
                    <Text style={{ color: props.colors.primary, fontWeight: "700", fontSize: 12 }}>{client.professionalName.split(" ")[0]}</Text>
                  )}
                  <Text style={{ color: props.colors.muted, fontSize: 13 }}>{client.phone}</Text>
                  <Text style={{ color: props.colors.muted, fontSize: 12 }}>
                    {client.visits} visita{client.visits === 1 ? "" : "s"} · {formatBRL(client.spentCents)}
                    {client.lastVisit ? ` · ${formatLongDay(dayKey(client.lastVisit))}` : ""}
                  </Text>
                </View>
                <Ionicons name="calendar-outline" size={18} color={props.colors.primary} />
              </SoftPress>
              <SoftPress onPress={() => void openWhatsApp(client)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#128C7E", borderRadius: 14, paddingVertical: 12 }}>
                <Ionicons name="logo-whatsapp" size={18} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontWeight: "700" }}>WhatsApp</Text>
              </SoftPress>
            </SoftCard>
          </Stagger>
        ))}
        {visible.length === 0 && (
          <SoftCard colors={props.colors} style={{ alignItems: "center", gap: 8, paddingVertical: 28 }}>
            <Ionicons name="people-outline" size={28} color={props.colors.muted} />
            <Text style={{ color: props.colors.muted, textAlign: "center" }}>
              {clients.length === 0 ? "Nenhum cliente nesta lista ainda." : "Nenhum cliente neste filtro."}
            </Text>
          </SoftCard>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
