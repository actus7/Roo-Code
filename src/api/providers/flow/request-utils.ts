import { FlowHeaders, FlowRequestConfig } from "./types"
import { createAxiosHeaders } from "./utils"

export function createAuthHeaders(token: string, tenant: string): FlowHeaders {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    flowTenant: tenant,
  }
}

export function createBaseHeaders(tenant: string): FlowHeaders {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: "",
    flowTenant: tenant,
  }
}

export function createRequestConfig(
  headers: FlowHeaders,
  isStreaming: boolean,
  timeout?: number
): FlowRequestConfig {
  return {
    headers: createAxiosHeaders(headers),
    responseType: isStreaming ? "stream" : "json",
    timeout,
  }
}
