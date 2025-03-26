import { FlowHeaders, FlowRequestConfig } from "./types"
import { createAxiosHeaders } from "./utils"

/**
 * Utility functions for creating Flow API request headers and configurations.
 */

/**
 * Creates authentication headers for Flow API requests.
 * @param token - The authentication bearer token
 * @param tenant - The Flow tenant identifier
 * @returns Headers object with authentication and content type settings
 */
export function createAuthHeaders(token: string, tenant: string): FlowHeaders {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    flowTenant: tenant,
  }
}

/**
 * Creates base headers without authentication for Flow API requests.
 * @param tenant - The Flow tenant identifier
 * @returns Headers object with content type settings and empty authorization
 */
export function createBaseHeaders(tenant: string): FlowHeaders {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: "",
    flowTenant: tenant,
  }
}

/**
 * Creates an Axios request configuration object for Flow API requests.
 * @param headers - The Flow request headers
 * @param isStreaming - Whether the request should use streaming response
 * @param timeout - Optional request timeout in milliseconds
 * @returns Request configuration object for Axios
 */
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
