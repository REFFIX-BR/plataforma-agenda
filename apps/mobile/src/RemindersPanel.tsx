import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useEffect, useState } from "react"
import { Pressable, Text, TextInput, View, type TextStyle, type ViewStyle } from "react-native"
import { api } from "./api"
import { SoftPress } from "./motion"
import { leadLabel } from "./reminders"

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

export function RemindersPanel(props: {
  colors: Paint
  input: TextStyle
  button: ViewStyle
  onSaved: () => void
}) {
  const [minutes, setMinutes] = useState<number[]>([])
  const [custom, setCustom] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api<{ minutes: number[] }>("/api/reminders").then((result) => setMinutes(result.minutes)).catch(() => undefined)
  }, [])

  function remove(value: number) {
    setError("")
    setMinutes((current) => current.filter((item) => item !== value))
  }

  function addCustom() {
    const value = Number(custom.replace(",", "."))
    if (!Number.isInteger(value) || value < 5 || value > 24 * 60) {
      setError("Use um número inteiro entre 5 minutos e 24 horas.")
      return
    }
    setMinutes((current) => {
      if (current.includes(value)) {
        setError("Esse aviso já está na lista.")
        return current
      }
      if (current.length >= 5) {
        setError("Dá para marcar no máximo 5 avisos por horário.")
        return current
      }
      setError("")
      return [...current, value].sort((a, b) => b - a)
    })
    setCustom("")
  }

  async function save() {
    setSaving(true)
    setError("")
    try {
      await api("/api/reminders", { method: "PUT", body: JSON.stringify({ minutes }) })
      props.onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar os avisos.")
    } finally {
      setSaving(false)
    }
  }

  const summary = minutes.length === 0
    ? "Nenhum aviso. O celular fica em silêncio."
    : `${minutes.length} aviso${minutes.length === 1 ? "" : "s"}: ${minutes.map(leadLabel).join(", ")} antes.`

  return (
    <>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>
        Escolha quantos minutos antes do horário o celular deve avisar. Pode marcar até 5 avisos.
      </Text>

      <View style={{ gap: 8 }}>
        <Text style={{ color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>MINUTOS ANTES</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TextInput
            style={[props.input, { flex: 1 }]}
            keyboardType="number-pad"
            placeholder="Ex.: 45"
            placeholderTextColor={props.colors.muted}
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={addCustom}
            returnKeyType="done"
          />
          <SoftPress onPress={addCustom} style={[props.button, { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 }]}>
            <Text style={{ color: props.colors.onPrimary, fontWeight: "700" }}>Adicionar</Text>
          </SoftPress>
        </View>
      </View>

      <View style={{ backgroundColor: props.colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: props.colors.line, gap: 8 }}>
        <Text style={{ color: props.colors.ink, fontWeight: "700" }}>{summary}</Text>
        {minutes.length === 0 && (
          <Text style={{ color: props.colors.muted, lineHeight: 20 }}>Digite os minutos e toque em Adicionar.</Text>
        )}
        {minutes.map((value) => (
          <View key={value} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: props.colors.line }}>
            <Text style={{ color: props.colors.ink }}>Faltando {leadLabel(value)}</Text>
            <Pressable
              onPress={() => remove(value)}
              hitSlop={8}
              accessibilityLabel={`Tirar aviso de ${leadLabel(value)}`}
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: props.colors.bg }}
            >
              <Ionicons name="close" size={16} color={props.colors.danger} />
            </Pressable>
          </View>
        ))}
      </View>

      {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}
      <SoftPress style={[props.button, { borderRadius: 18, paddingVertical: 16, opacity: saving ? 0.7 : 1 }]} onPress={() => void save()} disabled={saving}>
        <Text style={{ color: props.colors.onPrimary, textAlign: "center", fontWeight: "700", fontSize: 16 }}>{saving ? "Salvando..." : "Salvar avisos"}</Text>
      </SoftPress>
    </>
  )
}
