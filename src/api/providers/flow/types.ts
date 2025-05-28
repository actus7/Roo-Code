import type { Anthropic } from "@anthropic-ai/sdk"
import { z } from "zod"

// Flow Configuration Validation Schema
export const FlowConfigSchema = z.object({
	// Required parameters with validation
	flowBaseUrl: z.string().url("Base URL deve ser uma URL válida"),
	flowTenant: z.string().min(1, "Tenant é obrigatório").max(100, "Tenant muito longo"),
	flowClientId: z.string()
		.min(1, "Client ID é obrigatório")
		.regex(/^[a-zA-Z0-9\-_]+$/, "Client ID deve conter apenas letras, números, hífens e underscores")
		.max(255, "Client ID muito longo"),
	flowClientSecret: z.string()
		.min(32, "Client Secret deve ter pelo menos 32 caracteres")
		.max(512, "Client Secret muito longo"),

	// Optional parameters with defaults and validation
	flowAuthBaseUrl: z.string().url("Auth Base URL deve ser uma URL válida").optional(),
	flowAppToAccess: z.string().min(1).max(100).optional(),
	flowAgent: z.string().min(1).max(50).optional(),
	apiModelId: z.string().min(1).max(100).optional(),
	modelTemperature: z.number().min(0).max(1).optional(),
	modelMaxTokens: z.number().min(1).max(1000000).optional(),
	flowRequestTimeout: z.number().min(1000).max(300000).optional()
})

// Flow Configuration Types
export interface FlowConfig {
	// Required parameters
	flowBaseUrl: string
	flowTenant: string
	flowClientId: string
	flowClientSecret: string

	// Optional parameters with defaults
	flowAuthBaseUrl?: string
	flowAppToAccess?: string
	flowAgent?: string
	apiModelId?: string
	modelTemperature?: number
	modelMaxTokens?: number
	flowRequestTimeout?: number
}

// Type inference from schema
export type ValidatedFlowConfig = z.infer<typeof FlowConfigSchema>

// Authentication Types
export interface AuthResponse {
	access_token: string
	expires_in: number
	token_type: string
}

// Model Types
export interface Model {
	id: string
	name: string
	provider: string
	capabilities: string[]
	inputTokens?: number
	outputTokens?: number
	contextWindow?: number
	description?: string
}

// Provider Types
export type FlowProvider = "azure-openai" | "google-gemini" | "amazon-bedrock" | "azure-foundry"

// Request Options
export interface FlowRequestOptions {
	provider?: FlowProvider
	capabilities?: string[]
}

// Chat Completion Types
export interface FlowMessage {
	role: "system" | "user" | "assistant"
	content: string | FlowMessageContent[]
}

export interface FlowMessageContent {
	type: "text" | "image"
	text?: string
	source?: {
		type: "base64"
		data: string
		media_type: string
	}
}

export interface FlowChatCompletionOptions {
	model?: string
	messages: FlowMessage[]
	maxTokens?: number
	temperature?: number
	stream?: boolean
	user?: string
}

// Azure OpenAI Payload
export interface AzureOpenAIPayload {
	model?: string
	allowedModels?: string[]
	messages: Array<{
		role: "system" | "user" | "assistant"
		content: string
	}>
	max_tokens?: number
	temperature?: number // Optional for o1/o3 models
	stream?: boolean // Optional for o1/o3 models
	reasoning_effort?: "low" | "medium" | "high" // For o3 models
}

// Google Gemini Payload
export interface GeminiPayload {
	model?: string
	allowedModels?: string[]
	contents: Array<{
		parts: Array<{
			text: string
		}>
		role: "user" | "model"
	}>
	generationConfig?: {
		maxOutputTokens?: number
		temperature?: number
	}
	// Note: stream field removed - Google Gemini API doesn't support it in payload
	// Streaming is handled at HTTP level via Accept: text/event-stream header
}

// Amazon Bedrock Payload
export interface BedrockPayload {
	allowedModels: string[]
	messages: Array<{
		role: "user" | "assistant"
		content: Array<{
			type: "text"
			text: string
		}>
	}>
	system?: string
	anthropic_version?: string // Optional - only for Anthropic models, not for Nova
	max_tokens: number
	temperature?: number
	// Note: stream field removed - Amazon Bedrock API doesn't support it in payload
	// Streaming is handled at HTTP level via Accept: text/event-stream header
}

// Azure Foundry Payload
export interface FoundryPayload {
	model: string
	messages: Array<{
		role: "user" | "assistant"
		content: string
	}>
	max_tokens?: number
	temperature?: number
	stream?: boolean
}

// Response Types
export interface ChatCompletionResponse {
	id: string
	object: string
	created: number
	model: string
	choices: Array<{
		index: number
		message: {
			role: string
			content: string
		}
		finish_reason: string
	}>
	usage?: {
		prompt_tokens: number
		completion_tokens: number
		total_tokens: number
	}
}

export interface ChatCompletionChunk {
	id: string
	object: string
	created: number
	model: string
	choices: Array<{
		index: number
		delta: {
			role?: string
			content?: string
		}
		finish_reason?: string
	}>
}

// Embedding Types
export interface FlowEmbeddingOptions {
	input: string | string[]
	model?: string
	user?: string
}

export interface EmbeddingResponse {
	object: string
	data: Array<{
		object: string
		index: number
		embedding: number[]
	}>
	model: string
	usage: {
		prompt_tokens: number
		total_tokens: number
	}
}

// Error Types
export interface FlowError {
	error: {
		message: string
		type: string
		code?: string
	}
}

// Streaming Types
export interface StreamChunk {
	data: string
	event?: string
}

// Provider Endpoint Mapping
export interface ProviderEndpoints {
	"azure-openai": string
	"google-gemini": string
	"amazon-bedrock": string
	"azure-foundry": string
}

// Model Capabilities
export type ModelCapability =
	| "streaming"
	| "system-instruction"
	| "chat-conversation"
	| "image-recognition"
	| "embeddings"

// Utility Types
export type ProviderPayload = AzureOpenAIPayload | GeminiPayload | BedrockPayload | FoundryPayload

export interface RequestOptions {
	method: string
	headers: HeadersInit
	body?: string
	timeout?: number
}

// Constants for model mapping
export interface ModelMapping {
	[key: string]: {
		provider: FlowProvider
		capabilities: ModelCapability[]
		contextWindow?: number
		maxTokens?: number
	}
}
