import {
  addDays,
  dayKey,
  formatBRL,
  formatClock,
  formatDay,
  todayKey,
  type AppointmentView,
} from "@rumo/core"
import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Text, View } from "react-native"
import { api } from "./api"
import { SoftPress } from "./motion"
import { SoftCard } from "./ui"

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

type CancelledGroup = {
  key: string
  head: AppointmentView
  following: number
  total: number
}

function seriesKey(item: AppointmentView) {
  if (item.seriesId) return `series:${item.seriesId}`
  return `client:${item.clientId}|${item.professionalId}|${formatClock(item.startsAt)}`
}

function nearness(iso: string, nowIso: string) {
  return Math.abs(new Date(iso).getTime() - new Date(nowIso).getTime())
}

function buildGroups(items: AppointmentView[]): CancelledGroup[] {
  const nowIso = new Date().toISOString()
  const buckets = new Map<string, AppointmentView[]>()
  for (const item of items) {
    const key = seriesKey(item)
    const list = buckets.get(key) ?? []
    list.push(item)
    buckets.set(key, list)
  }

  const groups: CancelledGroup[] = []
  for (const [key, list] of buckets) {
    const sorted = [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const upcoming = sorted.find((item) => item.startsAt >= nowIso)
    const head = upcoming ?? sorted.reduce((best, item) => (nearness(item.startsAt, nowIso) < nearness(best.startsAt, nowIso) ? item : best))
    const following = Math.max(
      head.cancelledFollowing ?? 0,
      sorted.filter((item) => item.startsAt > head.startsAt).length,
    )
    groups.push({ key, head, following, total: sorted.length })
  }

  return groups.sort((a, b) => nearness(a.head.startsAt, nowIso) - nearness(b.head.startsAt, nowIso))
}

export function CancelledPanel(props: {
  colors: Paint
  owner: boolean
  onRestored: () => void
}) {
  const [items, setItems] = useState<AppointmentView[]>([])
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Só o horizonte próximo: semana passada até ~1,5 mês à frente (evita spam de repetição longe).
    const from = addDays(todayKey(), -7)
    const to = addDays(todayKey(), 45)
    const next = await api<AppointmentView[]>(`/api/appointments?from=${from}&to=${to}&status=cancelled`)
    setItems(next)
  }, [])

  useEffect(() => {
    void load().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os cancelados.")
    })
  }, [load])

  const groups = useMemo(() => buildGroups(items), [items])

  async function restore(item: AppointmentView, scope: "one" | "following", allowOverlap = false) {
    setError("")
    setBusyId(item.id)
    try {
      await api<{ restored: number }>(`/api/appointments/${item.id}/restore`, {
        method: "POST",
        body: JSON.stringify({ scope, ...(allowOverlap ? { allowOverlap: true } : {}) }),
      })
      await load()
      props.onRestored()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível reverter."
      if (!allowOverlap && message.includes("Confirme para marcar")) {
        Alert.alert(
          "Reabrir mesmo assim?",
          "Esse horário encosta em outro na agenda. Confirme para trazer de volta.",
          [
            { text: "Voltar", style: "cancel" },
            { text: "Reabrir", onPress: () => void restore(item, scope, true) },
          ],
        )
        return
      }
      setError(message)
    } finally {
      setBusyId(null)
    }
  }

  function askRestore(group: CancelledGroup) {
    const item = group.head
    const when = `${formatDay(dayKey(item.startsAt))} · ${formatClock(item.startsAt)}`
    if (group.following <= 0) {
      Alert.alert(
        "Reverter cancelamento?",
        `${item.clientName} volta para ${when}.`,
        [
          { text: "Voltar", style: "cancel" },
          { text: "Reverter", onPress: () => void restore(item, "one") },
        ],
      )
      return
    }

    Alert.alert(
      "Reverter cancelamento",
      `${item.clientName} em ${when}.\n\nHá mais ${group.following} horário${group.following === 1 ? "" : "s"} cancelado${group.following === 1 ? "" : "s"} depois deste na mesma sequência.\n\nSó este: os outros continuam cancelados (não voltam a repetir).\nEste e os próximos: traz a sequência de volta.`,
      [
        { text: "Voltar", style: "cancel" },
        { text: "Só este", onPress: () => void restore(item, "one") },
        { text: "Este e os próximos", onPress: () => void restore(item, "following") },
      ],
    )
  }

  return (
    <>
      <Text style={{ color: props.colors.muted, lineHeight: 20 }}>
        {props.owner
          ? "Cancelados próximos (desta semana até ~1 mês e meio). Sequências repetidas aparecem juntas."
          : "Seus cancelados próximos. Se cancelou uma sequência, ela aparece agrupada."}
      </Text>

      {!!error && <Text style={{ color: props.colors.danger }}>{error}</Text>}

      {groups.length === 0 && !error && (
        <SoftCard colors={props.colors}>
          <Text style={{ color: props.colors.muted }}>Nenhum cancelado próximo neste período.</Text>
        </SoftCard>
      )}

      {groups.map((group) => {
        const item = group.head
        return (
          <SoftCard key={group.key} colors={props.colors} style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: props.colors.bg, borderWidth: 1, borderColor: props.colors.line, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close-circle-outline" size={20} color={props.colors.danger} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16 }}>{item.clientName}</Text>
                <Text style={{ color: props.colors.muted }}>
                  {formatDay(dayKey(item.startsAt))} · {formatClock(item.startsAt)}–{formatClock(item.endsAt)}
                </Text>
                {props.owner && (
                  <Text style={{ color: props.colors.muted, fontSize: 12 }}>{item.professionalName}</Text>
                )}
                <Text style={{ color: props.colors.muted }} numberOfLines={2}>
                  {item.services.map((service) => service.name).join(", ") || "Sem serviço"} · {formatBRL(item.totalCents)}
                </Text>
                {group.following > 0 && (
                  <Text style={{ color: props.colors.primary, fontWeight: "700", marginTop: 2 }}>
                    +{group.following} cancelado{group.following === 1 ? "" : "s"} depois na sequência
                  </Text>
                )}
              </View>
            </View>
            <SoftPress
              onPress={() => askRestore(group)}
              disabled={busyId === item.id}
              style={{
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                backgroundColor: props.colors.primary,
                opacity: busyId === item.id ? 0.7 : 1,
              }}
            >
              <Text style={{ color: props.colors.onPrimary, fontWeight: "700" }}>
                {busyId === item.id ? "Revertendo..." : "Reverter"}
              </Text>
            </SoftPress>
          </SoftCard>
        )
      })}
    </>
  )
}
