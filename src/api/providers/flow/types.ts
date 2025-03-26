import { AxiosHeaderValue } from "axios"
import { ApiHandlerOptions } from "../../../shared/api"

export type Nullable<T> = T | null | undefined

export interface FlowHeaders {
  "Content-Type"?: AxiosHeaderValue
  Accept?: AxiosHeaderValue
  Authorization?: AxiosHeaderValue
  flowAgent?: AxiosHeaderValue
  flowTenant?: AxiosHeaderValue
  [key: string]: AxiosHeaderValue | undefined
}

export interface FlowModel {
  id: string
  maxTokens?: number
  contextWindow?: number
  supportsImages?: boolean
  supportsComputerUse?: boolean
  description?: string
}

export interface FlowMessage {
  role: string
  content: Array<{
    type: string
    text: string
  }>
}

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

export interface FlowRequestConfig {
  headers: FlowHeaders
  responseType: "stream" | "json"
  timeout?: number
}

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

export interface PayloadOptions {
  stream?: boolean
  max_tokens?: number
  temperature?: Nullable<number>
}

export type FlowHandlerOptions = ApiHandlerOptions & Partial<FlowOptions>

export interface FlowAuthResponse {
  access_token: string
}

export const DEFAULT_FLOW_CONFIG = {
  flowAppToAccess: "llm-api",
  flowAgent: "chat",
  modelTemperature: 0.7,
} as const

export function ensureTemperature(temp: Nullable<number>): number {
  if (temp === null || temp === undefined) {
    return DEFAULT_FLOW_CONFIG.modelTemperature
  }
  return temp
}

export const DEFAULT_HEADERS: FlowHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: "",
} as const
