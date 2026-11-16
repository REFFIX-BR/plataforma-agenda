import type { ReactNode } from "react"
import { Image, Platform, Text, View, type TextStyle, type ViewStyle } from "react-native"
import { cardShadow } from "./motion"

export type Paint = {
  bg: string
  surface: string
  ink: string
  muted: string
  line: string
  primary: string
  onPrimary: string
  accent: string
  danger: string
  ok?: string
}

export function Atmosphere(props: { colors: Paint }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" }}>
      <View style={{ position: "absolute", top: -70, right: -50, width: "48%", aspectRatio: 1, borderRadius: 999, backgroundColor: props.colors.accent, opacity: 0.55 }} />
      <View style={{ position: "absolute", top: "22%", left: -70, width: "42%", aspectRatio: 1, borderRadius: 999, backgroundColor: props.colors.primary, opacity: 0.05 }} />
      <View style={{ position: "absolute", bottom: 30, right: -30, width: "36%", aspectRatio: 1, borderRadius: 999, backgroundColor: props.colors.accent, opacity: 0.35 }} />
    </View>
  )
}

export function PageTitle(props: { kicker?: string; title: string; subtitle?: string; colors: Paint; size?: number }) {
  const size = props.size ?? 30
  return (
    <View style={{ gap: 6 }}>
      {!!props.kicker && (
        <Text style={{ color: props.colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" }}>{props.kicker}</Text>
      )}
      <Text style={{
        color: props.colors.ink,
        fontSize: size,
        fontWeight: "700",
        letterSpacing: -0.4,
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
      }}>{props.title}</Text>
      {!!props.subtitle && <Text style={{ color: props.colors.muted, fontSize: size < 28 ? 13 : 15, lineHeight: size < 28 ? 18 : 21 }}>{props.subtitle}</Text>}
    </View>
  )
}

export function SoftCard(props: { colors: Paint; children: ReactNode; style?: ViewStyle; flush?: boolean }) {
  return (
    <View style={[
      {
        backgroundColor: props.colors.surface,
        borderRadius: 22,
        padding: props.flush ? 0 : 16,
        borderWidth: 1,
        borderColor: props.colors.line,
        overflow: "hidden",
      },
      cardShadow,
      props.style,
    ]}>
      {props.children}
    </View>
  )
}

export function SectionLabel(props: { children: string; colors: Paint; style?: TextStyle }) {
  return (
    <Text style={[{ color: props.colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1.1 }, props.style]}>
      {props.children}
    </Text>
  )
}

export function Avatar(props: { name: string; colors: Paint; size?: number; solid?: boolean; mark?: string; uri?: string | null }) {
  const size = props.size ?? 44
  const radius = size * 0.36
  if (props.uri) {
    return (
      <Image
        source={{ uri: props.uri }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: props.colors.line,
          backgroundColor: props.colors.surface,
        }}
      />
    )
  }
  const label = (props.mark ?? props.name.trim().slice(0, 1)).toUpperCase() || "A"
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: radius,
      backgroundColor: props.solid ? props.colors.primary : props.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: props.solid ? 0 : 1,
      borderColor: props.colors.line,
    }}>
      <Text style={{
        color: props.solid ? props.colors.onPrimary : props.colors.primary,
        fontWeight: "700",
        fontSize: size * (label.length > 1 ? 0.3 : 0.36),
      }}>{label}</Text>
    </View>
  )
}
