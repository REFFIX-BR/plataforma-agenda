import { brandColors, storePaint, verticalById } from "@rumo/theme"
import type { CSSProperties, ReactNode } from "react"

export function ThemeScope({
  vertical,
  brandColor,
  unified = false,
  className,
  children,
}: {
  vertical?: string | null
  brandColor?: string | null
  unified?: boolean
  className?: string
  children: ReactNode
}) {
  const theme = vertical ? verticalById(vertical) : null
  const painted = unified ? storePaint(vertical ?? "estetica", brandColor) : null
  const colors = painted?.colors ?? theme?.colors ?? brandColors
  const radius = painted?.radius ?? theme?.radius ?? brandColors.radius
  const style = {
    "--bg": colors.bg,
    "--surface": colors.surface,
    "--ink": colors.ink,
    "--muted": colors.muted,
    "--line": colors.line,
    "--primary": colors.primary,
    "--on-primary": colors.onPrimary,
    "--accent": colors.accent,
    "--danger": colors.danger,
    "--ok": colors.ok,
    "--radius": `${radius}px`,
    background: colors.bg,
    color: colors.ink,
  } as CSSProperties
  const tone = painted
    ? "tone-light tone-serif"
    : theme
      ? `${theme.tone === "dark" ? "tone-dark" : "tone-light"} ${theme.titleFont === "sans" ? "tone-sans" : "tone-serif"}`
      : "tone-light tone-serif"
  return (
    <div style={style} className={`${tone} ${className ?? ""}`}>
      {children}
    </div>
  )
}
