/**
 * Flow Provider Interfaces - Contract Definitions
 *
 * This module defines TypeScript interfaces that establish clear contracts
 * between Flow components, ensuring type safety and adherence to SOLID principles.
 */

import { Anthropic } from "@anthropic-ai/sdk"
import type { ModelInfo } from "@roo-code/types"
import type { ApiHandlerCreateMessageMetadata } from "../../types"
import type {
	FlowConfig,
	FlowChatCompletionOptions,
	FlowEmbeddingOptions,
	FlowRequestOptions,
	Model,
	ChatCompletionResponse,
	EmbeddingResponse,
} from "./types"

/**
 * Core Flow Handler Interface
 * Defines the main contract for Flow API operations
 */
export interface IFlowHandler {
	/**
	 * Create a streaming chat message
	 */
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata
	): AsyncIterableIterator<any>

	/**
	 * Get model information
	 */
	getModel(): { id: string; info: ModelInfo }

	/**
	 * List available models for a provider
	 */
	listModels(options?: FlowRequestOptions): Promise<Model[]>

	/**
	 * Create non-streaming chat completion
	 */
	createChatCompletion(options: FlowChatCompletionOptions): Promise<ChatCompletionResponse>

	/**
	 * Create embeddings
	 */
	createEmbedding(options: FlowEmbeddingOptions): Promise<EmbeddingResponse>

	/**
	 * Get command factory for advanced operations
	 */
	getCommandFactory(): IFlowCommandFactory

	/**
	 * Get command invoker for history management
	 */
	getCommandInvoker(): ICommandInvoker

	/**
	 * Execute multiple commands in batch
	 */
	executeBatchCommands(commands: ICommand[]): Promise<any[]>

	/**
	 * Undo the last executed command
	 */
	undoLastCommand(): Promise<void>

	/**
	 * Get command execution history
	 */
	getCommandHistory(): ICommand[]
}

/**
 * Message Processor Interface
 * Defines contract for message processing operations
 */
export interface IFlowMessageProcessor {
	/**
	 * Convert Anthropic messages to Flow format
	 */
	convertAnthropicMessages(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): any[]

	/**
	 * Process message content
	 */
	processMessageContent(content: any): any

	/**
	 * Validate message format
	 */
	validateMessage(message: any): boolean

	/**
	 * Extract text content from message
	 */
	extractTextContent(content: any): string

	/**
	 * Create system message
	 */
	createSystemMessage(content: string): any

	/**
	 * Create user message
	 */
	createUserMessage(content: string): any

	/**
	 * Create assistant message
	 */
	createAssistantMessage(content: string): any

	/**
	 * Merge consecutive messages of same role
	 */
	mergeConsecutiveMessages(messages: any[]): any[]

	/**
	 * Estimate token count for messages
	 */
	estimateTokenCount(messages: any[]): number

	/**
	 * Truncate messages to fit token limit
	 */
	truncateMessages(messages: any[], maxTokens: number): any[]
}

/**
 * Stream Processor Interface
 * Defines contract for stream processing operations
 */
export interface IFlowStreamProcessor {
	/**
	 * Process streaming response from Flow API
	 */
	processStreamingResponse(stream: ReadableStream<Uint8Array>, provider: string): AsyncIterableIterator<any>

	/**
	 * Extract complete chunks from buffer
	 */
	extractCompleteChunks(buffer: string): { processedChunks: string[], remainingBuffer: string }

	/**
	 * Process buffered chunks
	 */
	processBufferedChunks(buffer: string, provider: string): AsyncIterableIterator<any>

	/**
	 * Create stream from text
	 */
	createStreamFromText(text: string): ReadableStream<Uint8Array>

	/**
	 * Validate chunk format
	 */
	validateChunk(chunk: string): boolean

	/**
	 * Normalize chunk data
	 */
	normalizeChunk(chunk: string): string

	/**
	 * Parse SSE chunk
	 */
	parseSSEChunk(chunk: string): any

	/**
	 * Transform stream chunk for provider
	 */
	transformStreamChunk(chunk: any, provider: string): any
}

/**
 * Request Builder Interface
 * Defines contract for request building operations
 */
export interface IFlowRequestBuilder {
	/**
	 * Build chat completion request
	 */
	buildChatRequest(
		options: FlowChatCompletionOptions,
		streaming: boolean
	): Promise<{ url: string; headers: Record<string, string>; payload: any; provider: string }>

	/**
	 * Build embedding request
	 */
	buildEmbeddingRequest(
		options: FlowEmbeddingOptions
	): Promise<{ url: string; headers: Record<string, string>; payload: any }>

	/**
	 * Build models listing request
	 */
	buildModelsRequest(
		provider: string,
		capabilities: string[]
	): Promise<{ url: string; headers: Record<string, string>; params: Record<string, any> }>

	/**
	 * Validate payload before sending
	 */
	validatePayload(payload: any, provider: string): boolean

	/**
	 * Determine provider from model
	 */
	determineProvider(model: string): string

	/**
	 * Get provider endpoint
	 */
	getProviderEndpoint(provider: string, operation: string): string

	/**
	 * Get provider capabilities
	 */
	getProviderCapabilities(provider: string): string[]

	/**
	 * Check if provider supports streaming
	 */
	supportsStreaming(provider: string): boolean

	/**
	 * Check if provider supports embeddings
	 */
	supportsEmbeddings(provider: string): boolean

	/**
	 * Check if provider supports images
	 */
	supportsImages(provider: string): boolean

	/**
	 * Get builder factory
	 */
	getBuilderFactory(): IFlowRequestBuilderFactory

	/**
	 * Create chat builder
	 */
	createChatBuilder(): IChatRequestBuilder

	/**
	 * Create embedding builder
	 */
	createEmbeddingBuilder(): IEmbeddingRequestBuilder

	/**
	 * Create models builder
	 */
	createModelsBuilder(): IModelsRequestBuilder

	/**
	 * Create streaming chat builder
	 */
	createStreamingChatBuilder(): IChatRequestBuilder

	/**
	 * Create O1/O3 optimized chat builder
	 */
	createO1ChatBuilder(): IChatRequestBuilder

	/**
	 * Create standard embedding builder
	 */
	createStandardEmbeddingBuilder(): IEmbeddingRequestBuilder
}

/**
 * Base Request Builder Interface
 * Defines common contract for all request builders
 */
export interface IRequestBuilder<T> {
	/**
	 * Build the request
	 */
	build(): Promise<T>

	/**
	 * Reset builder to initial state
	 */
	reset(): this

	/**
	 * Clone the builder
	 */
	clone(): IRequestBuilder<T>
}

/**
 * Chat Request Builder Interface
 * Defines contract for chat request building
 */
export interface IChatRequestBuilder extends IRequestBuilder<{
	url: string
	headers: Record<string, string>
	payload: any
	provider: string
}> {
	/**
	 * Set model for chat request
	 */
	setModel(model: string): this

	/**
	 * Set messages for chat request
	 */
	setMessages(messages: any[]): this

	/**
	 * Set maximum tokens
	 */
	setMaxTokens(maxTokens: number): this

	/**
	 * Set temperature
	 */
	setTemperature(temperature: number): this

	/**
	 * Enable/disable streaming
	 */
	setStreaming(streaming: boolean): this

	/**
	 * Add custom header
	 */
	addHeader(key: string, value: string): this

	/**
	 * Add multiple headers
	 */
	addHeaders(headers: Record<string, string>): this

	/**
	 * Set request timeout
	 */
	setTimeout(timeout: number): this

	/**
	 * Set top-p parameter
	 */
	setTopP(topP: number): this

	/**
	 * Set frequency penalty
	 */
	setFrequencyPenalty(frequencyPenalty: number): this

	/**
	 * Set presence penalty
	 */
	setPresencePenalty(presencePenalty: number): this

	/**
	 * Set stop sequences
	 */
	setStop(stop: string | string[]): this

	/**
	 * Set user identifier
	 */
	setUser(user: string): this
}

/**
 * Embedding Request Builder Interface
 * Defines contract for embedding request building
 */
export interface IEmbeddingRequestBuilder extends IRequestBuilder<{
	url: string
	headers: Record<string, string>
	payload: any
}> {
	/**
	 * Set input text or array of texts
	 */
	setInput(input: string | string[]): this

	/**
	 * Set embedding model
	 */
	setModel(model: string): this

	/**
	 * Set user identifier
	 */
	setUser(user: string): this

	/**
	 * Add custom header
	 */
	addHeader(key: string, value: string): this

	/**
	 * Add multiple headers
	 */
	addHeaders(headers: Record<string, string>): this

	/**
	 * Set dimensions for embedding
	 */
	setDimensions(dimensions: number): this

	/**
	 * Set encoding format
	 */
	setEncodingFormat(format: string): this
}

/**
 * Models Request Builder Interface
 * Defines contract for models request building
 */
export interface IModelsRequestBuilder extends IRequestBuilder<{
	url: string
	headers: Record<string, string>
	params: Record<string, any>
}> {
	/**
	 * Set provider
	 */
	setProvider(provider: string): this

	/**
	 * Set capabilities
	 */
	setCapabilities(capabilities: string[]): this

	/**
	 * Add single capability
	 */
	addCapability(capability: string): this

	/**
	 * Remove capability
	 */
	removeCapability(capability: string): this

	/**
	 * Add custom header
	 */
	addHeader(key: string, value: string): this

	/**
	 * Add multiple headers
	 */
	addHeaders(headers: Record<string, string>): this

	/**
	 * Add custom parameter
	 */
	addParam(key: string, value: any): this

	/**
	 * Add multiple parameters
	 */
	addParams(params: Record<string, any>): this
}

/**
 * Request Builder Factory Interface
 * Defines contract for creating request builders
 */
export interface IFlowRequestBuilderFactory {
	/**
	 * Create chat request builder
	 */
	createChatBuilder(): IChatRequestBuilder

	/**
	 * Create embedding request builder
	 */
	createEmbeddingBuilder(): IEmbeddingRequestBuilder

	/**
	 * Create models request builder
	 */
	createModelsBuilder(): IModelsRequestBuilder

	/**
	 * Create streaming chat builder
	 */
	createStreamingChatBuilder(): IChatRequestBuilder

	/**
	 * Create O1/O3 optimized chat builder
	 */
	createO1ChatBuilder(): IChatRequestBuilder

	/**
	 * Create standard embedding builder
	 */
	createStandardEmbeddingBuilder(): IEmbeddingRequestBuilder
}

/**
 * Base Command Interface
 * Defines contract for all commands
 */
export interface ICommand<T = any> {
	/**
	 * Execute the command
	 */
	execute(): Promise<T>

	/**
	 * Undo the command (optional)
	 */
	undo?(): Promise<void>

	/**
	 * Check if command can be executed
	 */
	canExecute(): boolean

	/**
	 * Get command description
	 */
	getDescription(): string

	/**
	 * Get command result
	 */
	getResult(): T | undefined

	/**
	 * Get command error
	 */
	getError(): Error | undefined

	/**
	 * Check if command was executed
	 */
	isExecuted(): boolean
}

/**
 * Chat Completion Command Interface
 * Defines contract for chat completion commands
 */
export interface IChatCompletionCommand extends ICommand<ChatCompletionResponse> {
	/**
	 * Get chat options
	 */
	getOptions(): FlowChatCompletionOptions
}

/**
 * Streaming Chat Command Interface
 * Defines contract for streaming chat commands
 */
export interface IStreamingChatCommand extends ICommand<AsyncIterableIterator<any>> {
	/**
	 * Get system prompt
	 */
	getSystemPrompt(): string

	/**
	 * Get messages
	 */
	getMessages(): Anthropic.Messages.MessageParam[]
}

/**
 * Embedding Command Interface
 * Defines contract for embedding commands
 */
export interface IEmbeddingCommand extends ICommand<EmbeddingResponse> {
	/**
	 * Get embedding options
	 */
	getOptions(): FlowEmbeddingOptions
}

/**
 * List Models Command Interface
 * Defines contract for list models commands
 */
export interface IListModelsCommand extends ICommand<Model[]> {
	/**
	 * Get request options
	 */
	getOptions(): FlowRequestOptions
}

/**
 * Composite Command Interface
 * Defines contract for composite commands
 */
export interface ICompositeCommand extends ICommand<any[]> {
	/**
	 * Add command to composite
	 */
	addCommand(command: ICommand): this

	/**
	 * Remove command from composite
	 */
	removeCommand(command: ICommand): this

	/**
	 * Get all commands
	 */
	getCommands(): ICommand[]
}

/**
 * Command Invoker Interface
 * Defines contract for command execution management
 */
export interface ICommandInvoker {
	/**
	 * Execute a command
	 */
	execute<T>(command: ICommand<T>): Promise<T>

	/**
	 * Undo last command
	 */
	undo(): Promise<void>

	/**
	 * Redo next command
	 */
	redo(): Promise<any>

	/**
	 * Get command history
	 */
	getHistory(): ICommand[]

	/**
	 * Get current command index
	 */
	getCurrentIndex(): number

	/**
	 * Clear command history
	 */
	clearHistory(): void

	/**
	 * Check if undo is possible
	 */
	canUndo(): boolean

	/**
	 * Check if redo is possible
	 */
	canRedo(): boolean

	/**
	 * Get last executed command
	 */
	getLastCommand(): ICommand | undefined

	/**
	 * Execute commands in sequence
	 */
	executeSequence(commands: ICommand[]): Promise<any[]>

	/**
	 * Execute commands in parallel
	 */
	executeParallel(commands: ICommand[]): Promise<any[]>
}

/**
 * Command Factory Interface
 * Defines contract for command creation
 */
export interface IFlowCommandFactory {
	/**
	 * Create chat completion command
	 */
	createChatCompletionCommand(options: FlowChatCompletionOptions): IChatCompletionCommand

	/**
	 * Create streaming chat command
	 */
	createStreamingChatCommand(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[]
	): IStreamingChatCommand

	/**
	 * Create embedding command
	 */
	createEmbeddingCommand(options: FlowEmbeddingOptions): IEmbeddingCommand

	/**
	 * Create list models command
	 */
	createListModelsCommand(options?: FlowRequestOptions): IListModelsCommand

	/**
	 * Create composite command
	 */
	createCompositeCommand(commands?: ICommand[]): ICompositeCommand

	/**
	 * Create command invoker
	 */
	createInvoker(): ICommandInvoker

	/**
	 * Create batch chat command
	 */
	createBatchChatCommand(optionsArray: FlowChatCompletionOptions[]): ICompositeCommand

	/**
	 * Create batch embedding command
	 */
	createBatchEmbeddingCommand(optionsArray: FlowEmbeddingOptions[]): ICompositeCommand

	/**
	 * Create multi-provider models command
	 */
	createMultiProviderModelsCommand(providers: string[]): ICompositeCommand
}

/**
 * Configuration Manager Interface
 * Defines contract for configuration management
 */
export interface IFlowConfigurationManager {
	/**
	 * Initialize configuration with defaults
	 */
	initializeConfig(partialConfig: Partial<FlowConfig>): FlowConfig

	/**
	 * Validate configuration
	 */
	validateConfig(config: FlowConfig): boolean

	/**
	 * Get configuration value
	 */
	getConfigValue<K extends keyof FlowConfig>(key: K): FlowConfig[K]

	/**
	 * Set configuration value
	 */
	setConfigValue<K extends keyof FlowConfig>(key: K, value: FlowConfig[K]): void

	/**
	 * Merge configuration
	 */
	mergeConfig(config: Partial<FlowConfig>): FlowConfig

	/**
	 * Reset configuration to defaults
	 */
	resetConfig(): FlowConfig

	/**
	 * Export configuration
	 */
	exportConfig(): FlowConfig

	/**
	 * Import configuration
	 */
	importConfig(config: FlowConfig): void
}

/**
 * Token Manager Interface
 * Defines contract for authentication token management
 */
export interface ITokenManager {
	/**
	 * Get valid authentication token
	 */
	getValidToken(): Promise<string>

	/**
	 * Refresh authentication token
	 */
	refreshToken(): Promise<string>

	/**
	 * Check if token is valid
	 */
	isTokenValid(): boolean

	/**
	 * Clear stored token
	 */
	clearToken(): void

	/**
	 * Get token expiration time
	 */
	getTokenExpiration(): Date | null

	/**
	 * Set token manually
	 */
	setToken(token: string, expiresIn?: number): void
}

/**
 * Logger Interface
 * Defines contract for logging operations
 */
export interface IFlowLogger {
	/**
	 * Log debug message
	 */
	logDebug(message: string, data?: any): void

	/**
	 * Log info message
	 */
	logInfo(message: string, data?: any): void

	/**
	 * Log warning message
	 */
	logWarning(message: string, data?: any): void

	/**
	 * Log error message
	 */
	logError(message: string, error: Error, data?: any): void

	/**
	 * Log request
	 */
	logRequest(method: string, url: string, data?: any): void

	/**
	 * Log response
	 */
	logResponse(status: number, data?: any): void

	/**
	 * Generate correlation ID
	 */
	generateCorrelationId(): string

	/**
	 * Set correlation ID
	 */
	setCorrelationId(id: string): void

	/**
	 * Get correlation ID
	 */
	getCorrelationId(): string
}

/**
 * Audit Trail Interface
 * Defines contract for security audit operations
 */
export interface IAuditTrail {
	/**
	 * Log API access event
	 */
	logApiAccessEvent(
		method: string,
		endpoint: string,
		correlationId: string,
		status: string,
		metadata?: any
	): Promise<void>

	/**
	 * Log security event
	 */
	logSecurityEvent(
		eventType: string,
		correlationId: string,
		details: any
	): Promise<void>

	/**
	 * Log authentication event
	 */
	logAuthenticationEvent(
		action: string,
		correlationId: string,
		success: boolean,
		details?: any
	): Promise<void>

	/**
	 * Get audit logs
	 */
	getAuditLogs(
		startDate?: Date,
		endDate?: Date,
		eventType?: string
	): Promise<any[]>

	/**
	 * Clear audit logs
	 */
	clearAuditLogs(olderThan?: Date): Promise<void>
}

/**
 * Model Service Interface
 * Defines contract for model management operations
 */
export interface IFlowModelService {
	/**
	 * Get available models
	 */
	getAvailableModels(provider?: string): Promise<Model[]>

	/**
	 * Get model by ID
	 */
	getModelById(id: string): Promise<Model | null>

	/**
	 * Get models by capability
	 */
	getModelsByCapability(capability: string): Promise<Model[]>

	/**
	 * Get models by provider
	 */
	getModelsByProvider(provider: string): Promise<Model[]>

	/**
	 * Refresh model cache
	 */
	refreshModelCache(): Promise<void>

	/**
	 * Clear model cache
	 */
	clearModelCache(): void

	/**
	 * Get model capabilities
	 */
	getModelCapabilities(modelId: string): Promise<string[]>

	/**
	 * Check if model supports capability
	 */
	supportsCapability(modelId: string, capability: string): Promise<boolean>

	/**
	 * Get model pricing
	 */
	getModelPricing(modelId: string): Promise<{ inputPrice: number; outputPrice: number } | null>
}

/**
 * Utility Functions Interface
 * Defines contract for utility operations
 */
export interface IFlowUtils {
	/**
	 * Parse SSE chunk
	 */
	parseSSEChunk(chunk: string): any

	/**
	 * Transform model data
	 */
	transformModelData(data: any): Model

	/**
	 * Transform chat response
	 */
	transformChatResponse(provider: string, response: any): ChatCompletionResponse

	/**
	 * Handle HTTP error
	 */
	handleHttpError(error: any, context: string): Error

	/**
	 * Create Flow headers
	 */
	createFlowHeaders(token: string, streaming?: boolean): Record<string, string>

	/**
	 * Determine provider from model
	 */
	determineProvider(model: string): string

	/**
	 * Get provider endpoint
	 */
	getProviderEndpoint(provider: string, operation: string): string

	/**
	 * Validate payload
	 */
	validatePayload(payload: any, provider: string): boolean

	/**
	 * Generate provider payload
	 */
	generateProviderPayload(provider: string, options: any): any

	/**
	 * Generate embedding payload
	 */
	generateEmbeddingPayload(options: FlowEmbeddingOptions): any

	/**
	 * Make JSON request
	 */
	makeJsonRequest(url: string, options: any): Promise<any>

	/**
	 * Make streaming request
	 */
	makeStreamingRequest(url: string, options: any): Promise<ReadableStream<Uint8Array>>
}

/**
 * Validation Interface
 * Defines contract for validation operations
 */
export interface IFlowValidator {
	/**
	 * Validate configuration
	 */
	validateConfiguration(config: FlowConfig): { valid: boolean; errors: string[] }

	/**
	 * Validate message format
	 */
	validateMessage(message: any): { valid: boolean; errors: string[] }

	/**
	 * Validate payload
	 */
	validatePayload(payload: any, provider: string): { valid: boolean; errors: string[] }

	/**
	 * Validate model compatibility
	 */
	validateModelCompatibility(model: string, provider: string): { valid: boolean; errors: string[] }

	/**
	 * Validate request options
	 */
	validateRequestOptions(options: any): { valid: boolean; errors: string[] }

	/**
	 * Validate token format
	 */
	validateToken(token: string): { valid: boolean; errors: string[] }

	/**
	 * Validate URL format
	 */
	validateUrl(url: string): { valid: boolean; errors: string[] }

	/**
	 * Validate headers
	 */
	validateHeaders(headers: Record<string, string>): { valid: boolean; errors: string[] }
}
