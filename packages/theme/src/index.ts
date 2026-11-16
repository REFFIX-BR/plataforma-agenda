export const BASE_PRICE_CENTS = 3990
export const SEAT_PRICE_CENTS = 1000

export const VERTICAL_IDS = [
  "estetica",
  "salao",
  "manicure",
] as const

export type VerticalId = (typeof VERTICAL_IDS)[number]

export type SuggestedService = {
  name: string
  durationMin: number
  priceCents: number
}

export type VerticalTheme = {
  id: VerticalId
  label: string
  pitch: string
  tone: "light" | "dark"
  titleFont: "serif" | "sans"
  radius: number
  labels: {
    professional: string
    professionals: string
    client: string
    clients: string
    service: string
    services: string
    store: string
  }
  colors: {
    bg: string
    surface: string
    ink: string
    muted: string
    line: string
    primary: string
    onPrimary: string
    accent: string
    danger: string
    ok: string
    chart: string[]
  }
  services: SuggestedService[]
}

export const brandColors = {
  bg: "#f3eee7",
  surface: "#fffdf9",
  ink: "#1e1a17",
  muted: "#74685f",
  line: "#e4dbd1",
  primary: "#8d3d3d",
  onPrimary: "#fff7f3",
  accent: "#d7b59a",
  danger: "#9d2c2c",
  ok: "#2d6a4f",
  radius: 18,
}

const chart = (colors: string[]) => colors

export const verticals: Record<VerticalId, VerticalTheme> = {
  estetica: {
    id: "estetica",
    label: "Salão de estética",
    pitch: "Pele, design e protocolos com hora marcada.",
    tone: "light",
    titleFont: "serif",
    radius: 22,
    labels: {
      professional: "esteticista",
      professionals: "esteticistas",
      client: "cliente",
      clients: "clientes",
      service: "protocolo",
      services: "protocolos",
      store: "salão",
    },
    colors: {
      bg: "#f6efe8",
      surface: "#fffaf6",
      ink: "#2a211c",
      muted: "#8a7368",
      line: "#eadfd4",
      primary: "#8d4a55",
      onPrimary: "#fff8f6",
      accent: "#d7a48a",
      danger: "#9d2c2c",
      ok: "#2f6b4f",
      chart: chart(["#8d4a55", "#d7a48a", "#5c6b58", "#c47b63", "#3f4a44", "#e0c2b0"]),
    },
    services: [
      { name: "Limpeza de pele", durationMin: 60, priceCents: 15000 },
      { name: "Design de sobrancelha", durationMin: 40, priceCents: 7000 },
      { name: "Massagem relaxante", durationMin: 50, priceCents: 12000 },
      { name: "Drenagem linfática", durationMin: 60, priceCents: 14000 },
      { name: "Hidratação facial", durationMin: 45, priceCents: 11000 },
    ],
  },
  salao: {
    id: "salao",
    label: "Salão de beleza",
    pitch: "Cabelo, cor e escova numa agenda só.",
    tone: "light",
    titleFont: "serif",
    radius: 16,
    labels: {
      professional: "cabeleireiro",
      professionals: "cabeleireiros",
      client: "cliente",
      clients: "clientes",
      service: "serviço",
      services: "serviços",
      store: "salão",
    },
    colors: {
      bg: "#f7f1f4",
      surface: "#fffafc",
      ink: "#2a1822",
      muted: "#86687a",
      line: "#eddde6",
      primary: "#6d3048",
      onPrimary: "#fff7fa",
      accent: "#c4a574",
      danger: "#9d2c2c",
      ok: "#2f6b4f",
      chart: chart(["#6d3048", "#c4a574", "#8d5a73", "#d7c2a1", "#3f4a44", "#e7d5df"]),
    },
    services: [
      { name: "Corte feminino", durationMin: 60, priceCents: 9000 },
      { name: "Coloração", durationMin: 120, priceCents: 22000 },
      { name: "Escova", durationMin: 45, priceCents: 7000 },
      { name: "Hidratação", durationMin: 50, priceCents: 13000 },
      { name: "Mechas", durationMin: 150, priceCents: 28000 },
    ],
  },
  manicure: {
    id: "manicure",
    label: "Manicure",
    pitch: "Mãos, pés e esmaltação sem encaixe no susto.",
    tone: "light",
    titleFont: "sans",
    radius: 28,
    labels: {
      professional: "manicure",
      professionals: "manicures",
      client: "cliente",
      clients: "clientes",
      service: "serviço",
      services: "serviços",
      store: "esmalteria",
    },
    colors: {
      bg: "#fff5f7",
      surface: "#ffffff",
      ink: "#1a1a1a",
      muted: "#8d7380",
      line: "#f0dbe3",
      primary: "#1a1a1a",
      onPrimary: "#fff5f7",
      accent: "#e7a0b0",
      danger: "#9d2c2c",
      ok: "#2f6b4f",
      chart: chart(["#1a1a1a", "#e7a0b0", "#c46b86", "#f3d5de", "#5c6b58", "#8d7380"]),
    },
    services: [
      { name: "Mãos", durationMin: 45, priceCents: 4500 },
      { name: "Pés", durationMin: 50, priceCents: 5000 },
      { name: "Spa dos pés", durationMin: 60, priceCents: 8000 },
      { name: "Esmaltação em gel", durationMin: 70, priceCents: 9000 },
      { name: "Manutenção de gel", durationMin: 50, priceCents: 7000 },
    ],
  },
}

export const identityColors = {
  bg: "#f6efe8",
  surface: "#fffaf6",
  ink: "#2a211c",
  muted: "#8a7368",
  line: "#eadfd4",
  danger: "#9d2c2c",
  ok: "#2f6b4f",
}

export const BRAND_COLORS = [
  { hex: "#8d4a55", name: "Rosa" },
  { hex: "#6d3048", name: "Vinho" },
  { hex: "#9d2c2c", name: "Vermelho" },
  { hex: "#b4532a", name: "Cobre" },
  { hex: "#c6a15b", name: "Dourado" },
  { hex: "#8a7355", name: "Areia" },
  { hex: "#1a1a1a", name: "Preto" },
  { hex: "#3f342c", name: "Marrom" },
  { hex: "#3e5c4b", name: "Verde" },
  { hex: "#0f6e73", name: "Verde-água" },
  { hex: "#2f4a6e", name: "Azul" },
  { hex: "#5c4d7a", name: "Roxo" },
] as const

export function normalizeBrandColor(value: unknown) {
  if (typeof value !== "string") return null
  const match = /^#([0-9a-fA-F]{6})$/.exec(value.trim())
  return match ? `#${match[1].toLowerCase()}` : null
}

function hexChannel(hex: string, index: number) {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
}

function mixHex(base: string, tint: string, tintAmount: number) {
  const parts = [0, 1, 2].map((index) => {
    const mixed = hexChannel(base, index) * (1 - tintAmount) + hexChannel(tint, index) * tintAmount
    return Math.round(mixed).toString(16).padStart(2, "0")
  })
  return `#${parts.join("")}`
}

export function inkOn(hex: string) {
  const channels = [0, 1, 2].map((index) => hexChannel(hex, index) / 255)
  const linear = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * linear(channels[0]) + 0.7152 * linear(channels[1]) + 0.0722 * linear(channels[2])
  return luminance > 0.4 ? "#1c1916" : "#fffaf6"
}

export function storePaint(vertical: string, brandColor?: string | null) {
  const theme = verticalById(vertical)
  const primary = normalizeBrandColor(brandColor) ?? theme.colors.primary
  const accent = mixHex(primary, identityColors.bg, 0.62)
  return {
    label: theme.label,
    labels: theme.labels,
    radius: 22,
    colors: {
      ...identityColors,
      primary,
      onPrimary: inkOn(primary),
      accent,
      chart: [primary, accent, "#5c6b58", "#c47b63", "#3f4a44", "#8a7368"],
    },
  }
}

export function isVerticalId(value: string): value is VerticalId {
  return (VERTICAL_IDS as readonly string[]).includes(value)
}

export function verticalById(value: string): VerticalTheme {
  if (!isVerticalId(value)) return verticals.estetica
  return verticals[value]
}

/** Capitaliza o primeiro caractere para uso em UI / nome de profissão. */
export function titledLabel(value: string) {
  const text = value.trim()
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Nome padrão da profissão principal do vertical (ex.: Esteticista, Manicure). */
export function defaultProfessionName(vertical: string) {
  return titledLabel(verticalById(vertical).labels.professional)
}

export function planCents(activeProfessionals: number) {
  return BASE_PRICE_CENTS + Math.max(0, activeProfessionals) * SEAT_PRICE_CENTS
}

export const verticalList = VERTICAL_IDS.map((id) => verticals[id])
