import { formatBRL, type SessionState } from "@rumo/core"
import { BASE_PRICE_CENTS, SEAT_PRICE_CENTS } from "@rumo/theme"
import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useState } from "react"
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { api } from "./api"
import { useLayout } from "./layout"

const agendaLogo = require("../assets/agenda-logo.png")

const palette = {
  bg: "#f6efe8",
  surface: "#fffaf6",
  ink: "#2a211c",
  muted: "#8a7368",
  line: "#eadfd4",
  primary: "#8d4a55",
  onPrimary: "#fff8f6",
  accent: "#e7cfc3",
  danger: "#9d2c2c",
}

export function LoginScreen(props: {
  onDone: (token: string, session: SessionState) => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const layout = useLayout()

  async function submit() {
    const cleanEmail = email.trim()
    const cleanName = name.trim()
    if (creating && cleanName.length < 2) {
      setError("Escreva o seu nome.")
      return
    }
    if (!cleanEmail.includes("@") || password.length < 6) {
      setError("Use um e-mail válido e uma senha com pelo menos 6 caracteres.")
      return
    }
    setPending(true)
    setError("")
    try {
      const result = await api<{ token: string; session: SessionState }>(
        creating ? "/api/auth/signup" : "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            name: creating ? cleanName : undefined,
            email: cleanEmail,
            password,
          }),
        },
      )
      await props.onDone(result.token, result.session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não consegui entrar.")
    } finally {
      setPending(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View pointerEvents="none" style={styles.blob} />
      <View pointerEvents="none" style={styles.blobSmall} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: layout.top + 24, paddingBottom: layout.bottom + 28, paddingHorizontal: layout.pad }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={styles.column}>
          <Image source={agendaLogo} style={styles.logo} resizeMode="contain" accessibilityLabel="Agenda" />
          {creating && (
            <Text style={[styles.title, { fontSize: layout.compact ? 32 : 40, lineHeight: layout.compact ? 38 : 46 }]}>Criar conta</Text>
          )}
          <Text style={[styles.subtitle, !creating && { marginTop: 6 }]}>
            {creating
              ? "Quem cria a conta administra a loja. A equipe é cadastrada depois, por você."
              : "Entre com o e-mail e a senha da sua conta."}
          </Text>

          {creating && (
            <View style={styles.planCard}>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>7 DIAS GRÁTIS</Text>
              </View>
              <Text style={styles.planTitle}>Teste a Agenda sem pagar</Text>
              <Text style={styles.planCopy}>
                Ao criar a loja, você ganha 7 dias para conhecer tudo. Depois o plano fica em {formatBRL(BASE_PRICE_CENTS)}/mês.
                Cada conta de atendente adiciona {formatBRL(SEAT_PRICE_CENTS)} na próxima mensalidade.
              </Text>
              <View style={styles.planRows}>
                <View style={styles.planRow}>
                  <Ionicons name="gift-outline" size={16} color={palette.primary} />
                  <Text style={styles.planRowText}>Sem cartão na criação da conta</Text>
                </View>
                <View style={styles.planRow}>
                  <Ionicons name="calendar-outline" size={16} color={palette.primary} />
                  <Text style={styles.planRowText}>Agenda, clientes e equipe liberados no teste</Text>
                </View>
                <View style={styles.planRow}>
                  <Ionicons name="people-outline" size={16} color={palette.primary} />
                  <Text style={styles.planRowText}>+ {formatBRL(SEAT_PRICE_CENTS)} por conta ativa na próxima mensalidade</Text>
                </View>
                <View style={styles.planRow}>
                  <Ionicons name="card-outline" size={16} color={palette.primary} />
                  <Text style={styles.planRowText}>Assine só se quiser continuar depois</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.card}>
            {creating && (
              <Field label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" autoCapitalize="words" />
            )}
            <Field
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo de 6 caracteres"
              secureTextEntry
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.button, pending && styles.buttonOff]} onPress={() => void submit()} disabled={pending}>
              <Text style={styles.buttonText}>{pending ? "Aguarde..." : creating ? "Criar conta e começar o teste" : "Entrar"}</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.switch}
            onPress={() => {
              setCreating((current) => !current)
              setError("")
            }}
          >
            <Text style={styles.switchMuted}>{creating ? "Já tem conta?" : "Ainda não tem conta?"}</Text>
            <Text style={styles.switchAction}>{creating ? "Entrar" : "Criar conta"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Field(props: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  autoCapitalize?: "none" | "words"
  keyboardType?: "default" | "email-address"
  secureTextEntry?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#b4a59c"
        autoCapitalize={props.autoCapitalize ?? "none"}
        keyboardType={props.keyboardType ?? "default"}
        secureTextEntry={props.secureTextEntry}
        autoCorrect={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { flexGrow: 1, justifyContent: "center" },
  column: { width: "100%", maxWidth: 420, alignSelf: "center", alignItems: "center" },
  blob: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: palette.accent,
    opacity: 0.7,
  },
  blobSmall: {
    position: "absolute",
    bottom: -40,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#f3d7cc",
    opacity: 0.85,
  },
  logo: {
    width: 220,
    height: 64,
    marginBottom: 18,
  },
  title: {
    marginTop: 4,
    color: palette.ink,
    fontSize: 40,
    lineHeight: 46,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  subtitle: { marginTop: 10, color: palette.muted, fontSize: 16, lineHeight: 23, textAlign: "center" },
  planCard: {
    marginTop: 18,
    width: "100%",
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    gap: 10,
  },
  planBadge: {
    alignSelf: "flex-start",
    backgroundColor: palette.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planBadgeText: {
    color: palette.onPrimary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  planTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  planCopy: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  planRows: { gap: 8, marginTop: 2 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planRowText: { flex: 1, color: palette.ink, fontSize: 13, lineHeight: 18 },
  card: {
    marginTop: 16,
    width: "100%",
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },
  field: { gap: 6 },
  label: { color: palette.ink, fontSize: 13, fontWeight: "700" },
  input: {
    backgroundColor: "#fbf6f2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.ink,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  error: { color: palette.danger, fontSize: 14, lineHeight: 20 },
  button: {
    marginTop: 4,
    backgroundColor: palette.primary,
    borderRadius: 18,
    paddingVertical: 16,
  },
  buttonOff: { opacity: 0.7 },
  buttonText: { color: palette.onPrimary, textAlign: "center", fontSize: 16, fontWeight: "700" },
  switch: { marginTop: 22, alignItems: "center", gap: 4, padding: 8 },
  switchMuted: { color: palette.muted, fontSize: 15 },
  switchAction: { color: palette.primary, fontSize: 17, fontWeight: "700" },
})
