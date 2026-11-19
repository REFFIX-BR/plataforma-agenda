import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { formatTime, type AppointmentView } from "@rumo/core"

const CHANNEL = "horarios"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function leadLabel(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? "1 hora" : `${hours} horas`
  }
  return `${minutes} minutos`
}

async function ensurePermission() {
  const permission = await Notifications.getPermissionsAsync()
  const granted = permission.granted
    ? permission
    : await Notifications.requestPermissionsAsync()
  return granted.granted
}

async function ensureChannel() {
  if (Platform.OS !== "android") return
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Horários",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  })
}

export async function syncAppointmentReminders(profileId: string, minutes: number[], items: AppointmentView[]) {
  const ok = await ensurePermission()
  if (!ok) return false
  await ensureChannel()

  await Notifications.cancelAllScheduledNotificationsAsync()
  const now = Date.now()
  const mine = items.filter((item) => item.professionalId === profileId && item.status !== "cancelled")
  for (const item of mine) {
    const start = new Date(item.startsAt).getTime()
    if (!Number.isFinite(start) || start <= now) continue
    const service = item.services.map((entry) => entry.name).join(", ") || "Atendimento"
    for (const before of minutes) {
      const fireAt = start - before * 60_000
      if (fireAt <= now + 15_000) continue
      await Notifications.scheduleNotificationAsync({
        identifier: `ag-${item.id}-${before}`,
        content: {
          title: `+Agenda · Falta ${leadLabel(before)}`,
          body: `${item.clientName} · ${service} · ${formatTime(item.startsAt)}`,
          sound: "default",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(fireAt),
          channelId: CHANNEL,
        },
      })
    }
  }
  return true
}
