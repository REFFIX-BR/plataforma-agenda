import Ionicons from "@expo/vector-icons/build/Ionicons"
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native"
import { SoftPress } from "./motion"
import { useLayout } from "./layout"

export function OfflineScreen(props: {
  onRetry: () => void
  busy?: boolean
}) {
  const layout = useLayout()

  return (
    <View style={[styles.screen, { paddingTop: layout.top + 24, paddingBottom: layout.bottom + 36, paddingHorizontal: layout.pad }]}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <View style={styles.stage}>
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-offline-outline" size={42} color="#f6efe8" />
        </View>
        <Text style={styles.brand}>+Agenda</Text>
        <View style={styles.rule} />
        <Text style={styles.title}>Sem internet</Text>
        <Text style={styles.copy}>
          Não dá para abrir a agenda sem conexão. Conecte o Wi‑Fi ou os dados móveis e tente de novo.
        </Text>
      </View>

      <SoftPress
        onPress={props.onRetry}
        disabled={props.busy}
        style={[styles.button, { opacity: props.busy ? 0.7 : 1 }]}
      >
        {props.busy ? (
          <ActivityIndicator color="#804350" />
        ) : (
          <Ionicons name="refresh" size={18} color="#804350" />
        )}
        <Text style={styles.buttonText}>{props.busy ? "Tentando..." : "Tentar de novo"}</Text>
      </SoftPress>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#804350",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  glowTop: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(246, 239, 232, 0.14)",
  },
  glowBottom: {
    position: "absolute",
    right: -100,
    bottom: -140,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(40, 18, 24, 0.28)",
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(246, 239, 232, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(246, 239, 232, 0.22)",
    marginBottom: 8,
  },
  brand: {
    color: "#f6efe8",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.6,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    textAlign: "center",
  },
  rule: {
    width: 42,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(246, 239, 232, 0.45)",
  },
  title: {
    color: "#f6efe8",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
    marginTop: 4,
  },
  copy: {
    color: "rgba(246, 239, 232, 0.78)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 320,
  },
  button: {
    alignSelf: "stretch",
    backgroundColor: "#f6efe8",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    color: "#804350",
    fontWeight: "700",
    fontSize: 16,
  },
})
