import { AxiosRequestHeaders, RawAxiosRequestHeaders, AxiosHeaderValue } from "axios"
import { FlowHeaders } from "./types"

/**
 * Converts an Axios header value to a string or undefined.
 * @param value - The header value to convert
 * @returns The string value or undefined if the input is null/undefined
 */
function ensureHeaderValue(value: AxiosHeaderValue | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  return String(value)
}

/**
 * Creates Axios headers from Flow-specific headers, setting default values for required fields.
 * @param headers - Flow-specific headers
 * @returns Processed Axios request headers with undefined values filtered out
 */
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

/**
 * Ensures required headers are present in Axios request headers.
 * @param headers - Raw Axios request headers
 * @returns Axios request headers with guaranteed Content-Type and Accept headers
 */
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

/**
 * Merges base Axios headers with override Flow headers.
 * @param base - Base Axios request headers
 * @param override - Flow headers to override the base headers
 * @returns Merged and processed Axios request headers
 */
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
