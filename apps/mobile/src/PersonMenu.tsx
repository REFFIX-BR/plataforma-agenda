import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { SoftPress, Unfold, cardShadow } from "./motion"

type Paint = {
  surface: string
  ink: string
  muted: string
  line: string
  primary: string
  accent?: string
}

export type MenuPerson = {
  id: string
  name: string
  hint?: string
  trailing?: string
}

export function PersonMenu(props: {
  colors: Paint
  caption: string
  selectedId: string
  allLabel: string
  people: MenuPerson[]
  onSelect: (id: string) => void
  onAdd?: () => void
}) {
  const [open, setOpen] = useState(false)
  const selected = props.people.find((person) => person.id === props.selectedId)
  const label = selected?.name ?? props.allLabel

  function choose(id: string) {
    props.onSelect(id)
    setOpen(false)
  }

  return (
    <View style={{ zIndex: 40 }}>
      <SoftPress
        onPress={() => setOpen((current) => !current)}
        style={{
          backgroundColor: props.colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: open ? props.colors.primary : props.colors.line,
          paddingHorizontal: 14,
          height: 52,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          ...cardShadow,
        }}
      >
        <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: props.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff8f6", fontWeight: "700", fontSize: 12 }}>{label.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text numberOfLines={1} style={{ flex: 1, color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{label}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={props.colors.muted} />
      </SoftPress>
      {open && (
        <Unfold>
          <View style={[{ marginTop: 8, backgroundColor: props.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: props.colors.line, overflow: "hidden" }, cardShadow]}>
            <Text style={{ color: props.colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textAlign: "center", paddingTop: 14, paddingBottom: 6, textTransform: "uppercase" }}>{props.caption}</Text>
            <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled" bounces={false}>
              <Row active={props.selectedId === "all"} colors={props.colors} onPress={() => choose("all")} title={props.allLabel} />
              {props.people.map((person) => (
                <Row
                  key={person.id}
                  active={person.id === props.selectedId}
                  colors={props.colors}
                  onPress={() => choose(person.id)}
                  title={person.name}
                  hint={person.hint}
                  trailing={person.trailing}
                />
              ))}
              {props.onAdd && (
                <Pressable onPress={() => { setOpen(false); props.onAdd?.() }} style={{ paddingHorizontal: 16, paddingVertical: 15, borderTopWidth: 1, borderTopColor: props.colors.line }}>
                  <Text style={{ color: props.colors.primary, fontSize: 15, fontWeight: "700", marginLeft: 28 }}>Adicionar...</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </Unfold>
      )}
    </View>
  )
}

function Row(props: {
  active: boolean
  colors: Paint
  onPress: () => void
  title: string
  hint?: string
  trailing?: string
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor: props.active ? `${props.colors.primary}12` : "transparent",
      }}
    >
      {props.active ? <Ionicons name="checkmark" size={18} color={props.colors.primary} /> : <View style={{ width: 18 }} />}
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: props.colors.ink, fontSize: 16, fontWeight: props.active ? "700" : "500" }}>{props.title}</Text>
        {!!props.hint && <Text numberOfLines={1} style={{ color: props.colors.muted, fontSize: 12 }}>{props.hint}</Text>}
      </View>
      {!!props.trailing && <Text style={{ color: props.colors.primary, fontWeight: "700", fontSize: 13 }}>{props.trailing}</Text>}
    </Pressable>
  )
}
