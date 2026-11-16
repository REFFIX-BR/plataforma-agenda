import { rangesOverlap, zonedDateTime } from "./time"

export type BusyRange = { startsAt: string; endsAt: string }

export function buildSlots(input: {
  day: string
  open: string
  close: string
  durationMin: number
  stepMin?: number
  busy: BusyRange[]
  now?: number
}) {
  const step = (input.stepMin ?? 15) * 60_000
  const duration = input.durationMin * 60_000
  const start = zonedDateTime(input.day, input.open).getTime()
  const end = zonedDateTime(input.day, input.close).getTime()
  const now = input.now ?? Date.now()
  const slots: string[] = []
  if (!Number.isFinite(start) || !Number.isFinite(end) || duration <= 0 || end <= start) return slots

  for (let cursor = start; cursor + duration <= end; cursor += step) {
    if (cursor <= now) continue
    const startsAt = new Date(cursor).toISOString()
    const endsAt = new Date(cursor + duration).toISOString()
    const taken = input.busy.some((item) => rangesOverlap(startsAt, endsAt, item.startsAt, item.endsAt))
    if (!taken) slots.push(startsAt)
  }
  return slots
}
