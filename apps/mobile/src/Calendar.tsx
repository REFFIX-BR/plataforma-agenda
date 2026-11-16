import { addDays, monthStart, nextMonth, todayKey, weekStart, weekdayIndex } from "@rumo/core"
import Ionicons from "@expo/vector-icons/build/Ionicons"
import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Pressable, Text, View } from "react-native"
import { useLayout } from "./layout"
import { Pop, cardShadow } from "./motion"

const HEADS = ["S", "T", "Q", "Q", "S", "S", "D"]

function shiftMonth(day: string, amount: number) {
  let cursor = monthStart(day)
  const step = amount < 0 ? -1 : 1
  for (let index = 0; index < Math.abs(amount); index += 1) {
    cursor = step < 0 ? monthStart(addDays(cursor, -1)) : nextMonth(cursor)
  }
  return cursor
}

export function MonthCalendar(props: {
  selected: string
  onSelect: (day: string) => void
  onMonth?: (month: string) => void
  marks?: string[]
  highlightWeek?: boolean
  colors: {
    surface: string
    ink: string
    muted: string
    line: string
    primary: string
    onPrimary: string
    accent: string
  }
}) {
  const [cursor, setCursor] = useState(monthStart(props.selected))
  const fade = useRef(new Animated.Value(1)).current
  const slide = useRef(new Animated.Value(0)).current
  const layout = useLayout()
  const daySize = layout.daySize

  useEffect(() => {
    setCursor(monthStart(props.selected))
  }, [props.selected])

  useEffect(() => {
    props.onMonth?.(cursor)
  }, [cursor])

  const title = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${cursor}T12:00:00-03:00`))
  const weekFrom = props.highlightWeek ? weekStart(props.selected) : ""
  const weekTo = weekFrom ? addDays(weekFrom, 6) : ""
  const lead = (weekdayIndex(cursor) + 6) % 7
  const cells: Array<string | null> = Array.from({ length: lead }, () => null)
  let day = cursor
  while (day.slice(0, 7) === cursor.slice(0, 7)) {
    cells.push(day)
    day = addDays(day, 1)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const today = todayKey()

  function move(amount: number) {
    Animated.timing(fade, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      setCursor(shiftMonth(cursor, amount))
      slide.setValue(amount > 0 ? 18 : -18)
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      ]).start()
    })
  }

  return (
    <View style={[{ backgroundColor: props.colors.surface, borderRadius: 22, padding: 12, borderWidth: 1, borderColor: props.colors.line, gap: 8 }, cardShadow]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => move(-1)} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: props.colors.accent }}>
          <Ionicons name="chevron-back" size={18} color={props.colors.ink} />
        </Pressable>
        <Text style={{ color: props.colors.ink, fontWeight: "700", fontSize: 16, textTransform: "capitalize" }}>{title}</Text>
        <Pressable onPress={() => move(1)} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: props.colors.accent }}>
          <Ionicons name="chevron-forward" size={18} color={props.colors.ink} />
        </Pressable>
      </View>
      <Animated.View style={{ opacity: fade, transform: [{ translateX: slide }], gap: 8 }}>
      <View style={{ flexDirection: "row" }}>
        {HEADS.map((label, index) => (
          <Text key={`${label}-${index}`} style={{ flex: 1, textAlign: "center", color: props.colors.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((value, index) => {
          const chosen = value === props.selected
          const inWeek = Boolean(value && weekFrom && value >= weekFrom && value <= weekTo)
          const marked = Boolean(value && props.marks?.includes(value))
          return (
            <Pressable
              key={value ?? `empty-${index}`}
              disabled={!value}
              onPress={() => value && props.onSelect(value)}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Pop active={chosen} style={{
                width: daySize,
                height: daySize,
                borderRadius: daySize / 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: chosen ? props.colors.primary : inWeek ? props.colors.accent : "transparent",
                borderWidth: value === today && !chosen ? 1.5 : 0,
                borderColor: props.colors.primary,
              }}>
                <Text style={{ color: chosen ? props.colors.onPrimary : props.colors.ink, fontWeight: chosen || value === today ? "700" : "500", fontSize: daySize < 32 ? 13 : 15 }}>
                  {value ? Number(value.slice(8)) : ""}
                </Text>
                {marked && <View style={{ position: "absolute", bottom: Math.max(3, daySize * 0.12), width: 4, height: 4, borderRadius: 2, backgroundColor: chosen ? props.colors.onPrimary : props.colors.primary }} />}
              </Pop>
            </Pressable>
          )
        })}
      </View>
      </Animated.View>
    </View>
  )
}
