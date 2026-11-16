import type { Metadata } from "next"
import { Fraunces, Outfit } from "next/font/google"
import "./globals.css"

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" })
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" })

export const metadata: Metadata = {
  title: "Agenda",
  description: "Agenda, equipe e faturamento para salão de estética, salão de beleza e manicure.",
  icons: {
    icon: "/agenda-icon.png",
    apple: "/agenda-icon.png",
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.variable} ${fraunces.variable} antialiased`}>{children}</body>
    </html>
  )
}
