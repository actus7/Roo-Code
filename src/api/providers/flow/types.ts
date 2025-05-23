/**
 * Flow Provider type definitions
 */

export interface FlowConfig {
	apiKey: string
	apiUrl: string
	providerType: "azure" | "bedrock" | "gemini"
	version?: string
	deploymentId?: string
	region?: string
	project?: string
	// Campos de autenticação Flow
	flowAuthBaseUrl: string
	flowTenant: string
	flowClientId: string
	flowClientSecret: string
	flowAppToAccess: string
	// Campos adicionais
	apiModelId?: string
	flowAgent?: string
	flowRequestTimeout?: number
}

export interface AuthResponse {
	token: string
	expiresIn: number
}

export interface Model {
	id: string
	provider: string
	inputTokens: number
	outputTokens?: number
	capabilities: string[]
	deprecated?: boolean
}

export interface Message {
	role: "system" | "user" | "assistant" | "function"
	content: string
	name?: string
	function_call?: {
		name: string
		arguments: string
	}
}

export interface FlowRequestOptions {
	user?: string
	organization?: string
	maxRetries?: number
	timeout?: number
	providerName?: string
	capabilities?: string[]
}

export interface FlowChatCompletionOptions extends FlowRequestOptions {
	model: string
	messages: Message[]
	maxTokens?: number
	temperature?: number
	stream?: boolean
	functions?: {
		name: string
		description?: string
		parameters: Record<string, unknown>
	}[]
	functionCall?: "none" | "auto" | { name: string }
	responseFormat?: {
		type: "text" | "json_object"
	}
	topK?: number
	topP?: number
	presencePenalty?: number
	frequencyPenalty?: number
	stop?: string | string[]
}

export interface ChatCompletionChoice {
	index: number
	message: Message
	finishReason: "stop" | "length" | "function_call" | "content_filter"
}

export interface ChatCompletionResponse {
	id: string
	object: string
	created: number
	model: string
	choices: ChatCompletionChoice[]
	usage: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
	systemFingerprint?: string
}

export interface ChatCompletionChunk {
	id: string
	object: string
	created: number
	model: string
	choices: {
		index: number
		delta: Partial<Message>
		finishReason: string | null
	}[]
}

export interface FlowEmbeddingOptions extends FlowRequestOptions {
	model: string
	input: string | string[]
	user?: string
	encoding_format?: "float" | "base64"
}

export interface Embedding {
	object: string
	embedding: number[]
	index: number
}

export interface EmbeddingResponse {
	object: string
	data: Embedding[]
	model: string
	usage: {
		promptTokens: number
		totalTokens: number
	}
}

// Tipos específicos por provedor
export interface AzureRequestPayload extends FlowChatCompletionOptions {
	deployment: string
}

export interface BedrockRequestPayload extends FlowChatCompletionOptions {
	modelId: string
	region: string
}

export interface GeminiRequestPayload extends FlowChatCompletionOptions {
	project: string
}

// Tipos para filtros de conteúdo
export interface ContentFilterResults {
	hate: {
		filtered: boolean
		severity: "low" | "medium" | "high"
	}
	selfHarm: {
		filtered: boolean
		severity: "low" | "medium" | "high"
	}
	sexual: {
		filtered: boolean
		severity: "low" | "medium" | "high"
	}
	violence: {
		filtered: boolean
		severity: "low" | "medium" | "high"
	}
}

// Tipos para informações de uso
export interface Usage {
	promptTokens: number
	completionTokens: number
	totalTokens: number
}
