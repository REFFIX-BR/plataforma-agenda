import Constants from "expo-constants"
import { NativeModules, Platform } from "react-native"
import { deleteItem, getItem, setItem } from "./storage"

export const API_KEY = "rumo_api"
export const TOKEN_KEY = "rumo_token"

function devBase() {
  const source = NativeModules.SourceCode as
    | { scriptURL?: string; getConstants?: () => { scriptURL?: string } }
    | undefined
  const scriptURL = source?.scriptURL ?? source?.getConstants?.().scriptURL
  const candidates = [scriptURL, Constants.expoConfig?.hostUri, Constants.linkingUri]
  for (const candidate of candidates) {
    if (!candidate) continue
    const match = candidate.match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/:]+)(?::(\d+))?/i)
    const host = match?.[1]
    if (!host || host === "localhost" || host === "127.0.0.1") continue
    return `http://${host}:${match?.[2] || "8081"}`
  }
  return null
}

export const PROD_API_URL = "https://agendaapi.reffix.com.br"

export function defaultApiUrl() {
  if (!__DEV__) return PROD_API_URL
  return devBase() ?? (Platform.OS === "android" ? "http://10.0.2.2:8081" : "http://localhost:8081")
}

export async function apiUrl() {
  const stored = await getItem(API_KEY)
  const fallback = defaultApiUrl()
  if (!stored) return fallback
  if (!__DEV__) {
    if (/10\.0\.2\.2|localhost|127\.0\.0\.1|:3000\b|:3010\b|:8081\b/.test(stored)) return PROD_API_URL
    return stored
  }
  if (devBase() && /10\.0\.2\.2|localhost|127\.0\.0\.1|:3000\b/.test(stored)) return fallback
  return stored
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const base = (await apiUrl()).replace(/\/$/, "")
  const token = await getItem(TOKEN_KEY)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ""
    if (/abort/i.test(message)) {
      throw new Error("O computador não respondeu. Feche o Expo Go e abra de novo.")
    }
    throw new Error("O computador não respondeu. Feche o Expo Go e abra de novo.")
  } finally {
    clearTimeout(timer)
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.")
  return data as T
}

export async function saveSessionToken(token: string) {
  await setItem(TOKEN_KEY, token)
}

export async function clearSessionToken() {
  await deleteItem(TOKEN_KEY)
}
