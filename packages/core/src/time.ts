export const TZ = "America/Sao_Paulo"
const OFFSET = "-03:00"

export function dayKey(value: string | number | Date = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

export function todayKey(now = Date.now()) {
  return dayKey(now)
}

export function addDays(day: string, amount: number) {
  const next = new Date(`${day}T12:00:00${OFFSET}`).getTime() + amount * 86_400_000
  return dayKey(next)
}

export function weekdayIndex(day: string) {
  return new Date(`${day}T12:00:00${OFFSET}`).getUTCDay()
}

export function weekStart(day: string) {
  const weekday = weekdayIndex(day)
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  return addDays(day, mondayOffset)
}

export function monthStart(day: string) {
  return `${day.slice(0, 8)}01`
}

export function nextMonth(day: string) {
  const [year, month] = monthStart(day).split("-").map(Number)
  if (month === 12) return `${year + 1}-01-01`
  return `${year}-${String(month + 1).padStart(2, "0")}-01`
}

export function addMonths(day: string, amount: number) {
  const [year, month, date] = day.split("-").map(Number)
  const monthIndex = month - 1 + amount
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const lastDate = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const safeDate = Math.min(date, lastDate)
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(safeDate).padStart(2, "0")}`
}

export type RepeatUnit = "days" | "weeks" | "months"

function placeOnWeekday(day: string, weekday: number, start: string, end: string) {
  const snapped = addDays(day, weekday - weekdayIndex(day))
  return [snapped, addDays(snapped, -7), addDays(snapped, 7)].find((option) => option > start && option <= end) ?? null
}

export function repeatDays(startDay: string, every: number, unit: RepeatUnit, months: number, weekday: number) {
  const stepCount = Math.min(30, Math.max(1, Math.trunc(every)))
  const span = Math.min(12, Math.max(1, Math.trunc(months)))
  const dayName = Math.min(6, Math.max(0, Math.trunc(weekday)))
  const end = addMonths(startDay, span)
  const found = new Set<string>()
  const push = (day: string) => {
    const placed = placeOnWeekday(day, dayName, startDay, end)
    if (placed) found.add(placed)
  }
  if (unit === "months") {
    for (let index = stepCount; index <= span && found.size < 60; index += stepCount) {
      push(addMonths(startDay, index))
    }
  } else {
    const step = unit === "weeks" ? stepCount * 7 : stepCount
    let cursor = addDays(startDay, step)
    while (found.size < 60 && cursor <= addDays(end, 6)) {
      push(cursor)
      if (cursor > end) break
      cursor = addDays(cursor, step)
    }
  }
  return [...found].sort()
}

export function formatClock(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00"
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00"
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
}

export function zonedDateTime(day: string, time: string) {
  return new Date(`${day}T${time}:00${OFFSET}`)
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function formatDay(day: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(`${day}T12:00:00${OFFSET}`))
}

export function formatLongDay(day: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${day}T12:00:00${OFFSET}`))
}

export function minutesBetween(startIso: string, endIso: string) {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000
}

export function hmToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number)
  return hour * 60 + minute
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd)
}
