import { Platform, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export function useLayout() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const compact = width < 360
  const short = height < 700
  const pad = compact ? 12 : width >= 430 ? 22 : 16
  const gap = compact ? 10 : 14
  const title = compact ? 26 : 30
  const top = Math.max(insets.top, Platform.OS === "android" ? 8 : 0)
  const bottom = Math.max(insets.bottom, Platform.OS === "android" ? 10 : 8)
  const contentW = Math.min(width, 560)
  const daySize = Math.max(28, Math.min(40, Math.floor((width - pad * 2 - 24) / 7) - 4))
  const clock = Math.min(268, Math.max(200, width - pad * 2 - 56))
  return {
    width,
    height,
    compact,
    short,
    pad,
    gap,
    title,
    top,
    bottom,
    contentW,
    daySize,
    clock,
    insets,
  }
}
