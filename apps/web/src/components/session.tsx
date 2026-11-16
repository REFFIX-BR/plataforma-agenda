"use client"

import type { SessionState } from "@rumo/core"
import { createContext, useContext, type ReactNode } from "react"

type Value = { session: SessionState; reload: () => Promise<void> }

const SessionContext = createContext<Value | null>(null)

export function SessionProvider({ value, children }: { value: Value; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error("Sessão indisponível")
  return value
}
