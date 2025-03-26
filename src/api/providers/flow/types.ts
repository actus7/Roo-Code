import { AxiosHeaderValue } from "axios"
import { ApiHandlerOptions } from "../../../shared/api"

/** Type helper for nullable values */
export type Nullable<T> = T | null | undefined

/** HTTP headers specific to Flow API requests */
export interface FlowHeaders {
  "Content-Type"?: AxiosHeaderValue
  Accept?: AxiosHeaderValue
  Authorization?: AxiosHeaderValue
  flowAgent?: AxiosHeaderValue
  flowTenant?: AxiosHeaderValue
  [key: string]: AxiosHeaderValue | undefined
}

/** Represents a language model in the Flow API */
export interface FlowModel {
  id: string
  maxTokens?: number
  contextWindow?: number
  supportsImages?: boolean
  supportsComputerUse?: boolean
  description?: string
}

/** Structure of messages sent to Flow API */
export interface FlowMessage {
  role: string
  content: Array<{
    type: string
    text: string
  }>
}

/** Response structure from Flow API model endpoints */
export interface FlowModelResponse {
  choices?: Array<{
    delta?: {
      content?: string
    }
    message?: {
      content?: string
    }
  }>
  completion?: string
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  }
}

/** Configuration for Flow API requests */
export interface FlowRequestConfig {
  headers: FlowHeaders
  responseType: "stream" | "json"
  timeout?: number
}

/** Optional configuration parameters for Flow API handler */
export interface FlowOptions extends Partial<ApiHandlerOptions> {
  flowBaseUrl?: string
  flowAppToAccess?: string
  flowTenant?: string
  flowClientId?: string
  flowClientSecret?: string
  flowAuthBaseUrl?: string
  flowAgent?: string
  flowRequestTimeout?: number
  modelMaxTokens?: number
  modelTemperature?: Nullable<number>
}

/** Options for constructing API request payload */
export interface PayloadOptions {
  stream?: boolean
  max_tokens?: number
  temperature?: Nullable<number>
}

/** Combined type for Flow handler options */
export type FlowHandlerOptions = ApiHandlerOptions & Partial<FlowOptions>

/** Response structure from Flow authentication endpoint */
export interface FlowAuthResponse {
  access_token: string
}

/** Default configuration values for Flow API */
export const DEFAULT_FLOW_CONFIG = {
  flowAppToAccess: "llm-api",
  flowAgent: "chat",
  modelTemperature: 0.7,
} as const

/**
 * Ensures a valid temperature value is returned
 * @param temp - Temperature value to validate
 * @returns Valid temperature value or default
 */
export function ensureTemperature(temp: Nullable<number>): number {
  if (temp === null || temp === undefined) {
    return DEFAULT_FLOW_CONFIG.modelTemperature
  }
  return temp
}

/** Default headers for Flow API requests */
export const DEFAULT_HEADERS: FlowHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: "",
} as const
