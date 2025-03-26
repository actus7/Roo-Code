import { AxiosRequestHeaders, RawAxiosRequestHeaders, AxiosHeaderValue } from "axios"
import { FlowHeaders } from "./types"

function ensureHeaderValue(value: AxiosHeaderValue | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  return String(value)
}

export function createAxiosHeaders(headers: FlowHeaders): RawAxiosRequestHeaders {
  // Criar um objeto temporário com os valores convertidos
  const processedHeaders: Record<string, string | undefined> = {
    "Content-Type": ensureHeaderValue(headers["Content-Type"]) || "application/json",
    Accept: ensureHeaderValue(headers.Accept) || "application/json",
    Authorization: ensureHeaderValue(headers.Authorization) || "",
    flowAgent: ensureHeaderValue(headers.flowAgent),
    flowTenant: ensureHeaderValue(headers.flowTenant),
  }

  // Filtrar headers undefined e criar o objeto final
  return Object.entries(processedHeaders).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value
    }
    return acc
  }, {} as RawAxiosRequestHeaders)
}

export function ensureAxiosHeaders(headers: RawAxiosRequestHeaders): AxiosRequestHeaders {
  const ensuredHeaders = { ...headers } as AxiosRequestHeaders
  
  // Garantir que os headers obrigatórios estão presentes
  if (!ensuredHeaders["Content-Type"]) {
    ensuredHeaders["Content-Type"] = "application/json"
  }
  if (!ensuredHeaders.Accept) {
    ensuredHeaders.Accept = "application/json"
  }
  
  return ensuredHeaders
}

export function mergeAxiosHeaders(
  base: RawAxiosRequestHeaders,
  override: Partial<FlowHeaders>
): AxiosRequestHeaders {
  const processedOverride = Object.entries(override).reduce((acc, [key, value]) => {
    const processed = ensureHeaderValue(value)
    if (processed !== undefined) {
      acc[key] = processed
    }
    return acc
  }, {} as Record<string, string>)

  const merged = {
    ...base,
    ...processedOverride,
  }

  return ensureAxiosHeaders(merged)
}
