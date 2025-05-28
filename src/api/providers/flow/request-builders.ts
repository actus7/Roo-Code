import type { FlowConfig, FlowChatCompletionOptions, FlowEmbeddingOptions } from "./types"
import { SecureTokenManager as TokenManager } from "./secure-token-manager"

/**
 * Base interface for all request builders
 */
export interface IRequestBuilder<T> {
	build(): Promise<T>
	reset(): this
}

/**
 * Chat Request Builder using Builder Pattern
 */
export class ChatRequestBuilder implements IRequestBuilder<{
	url: string
	headers: Record<string, string>
	payload: any
	provider: string
}> {
	private options: Partial<FlowChatCompletionOptions> = {}
	private streaming: boolean = false
	private customHeaders: Record<string, string> = {}
	private timeout?: number

	constructor(
		private readonly config: FlowConfig,
		private readonly tokenManager: TokenManager,
		private readonly requestBuilder: any // FlowRequestBuilder instance
	) {}

	/**
	 * Set the model for the chat request
	 */
	setModel(model: string): this {
		this.options.model = model
		return this
	}

	/**
	 * Set messages for the chat request
	 */
	setMessages(messages: any[]): this {
		this.options.messages = messages
		return this
	}

	/**
	 * Set maximum tokens
	 */
	setMaxTokens(maxTokens: number): this {
		this.options.maxTokens = maxTokens
		return this
	}

	/**
	 * Set temperature
	 */
	setTemperature(temperature: number): this {
		this.options.temperature = temperature
		return this
	}

	/**
	 * Enable or disable streaming
	 */
	setStreaming(streaming: boolean): this {
		this.streaming = streaming
		return this
	}

	/**
	 * Add custom headers
	 */
	addHeader(key: string, value: string): this {
		this.customHeaders[key] = value
		return this
	}

	/**
	 * Add multiple custom headers
	 */
	addHeaders(headers: Record<string, string>): this {
		Object.assign(this.customHeaders, headers)
		return this
	}

	/**
	 * Set request timeout
	 */
	setTimeout(timeout: number): this {
		this.timeout = timeout
		return this
	}

	/**
	 * Set top-p parameter
	 */
	setTopP(topP: number): this {
		this.options.topP = topP
		return this
	}

	/**
	 * Set frequency penalty
	 */
	setFrequencyPenalty(frequencyPenalty: number): this {
		this.options.frequencyPenalty = frequencyPenalty
		return this
	}

	/**
	 * Set presence penalty
	 */
	setPresencePenalty(presencePenalty: number): this {
		this.options.presencePenalty = presencePenalty
		return this
	}

	/**
	 * Set stop sequences
	 */
	setStop(stop: string | string[]): this {
		this.options.stop = stop
		return this
	}

	/**
	 * Set user identifier
	 */
	setUser(user: string): this {
		this.options.user = user
		return this
	}

	/**
	 * Build the chat request
	 */
	async build(): Promise<{
		url: string
		headers: Record<string, string>
		payload: any
		provider: string
	}> {
		// Use default model if not set
		if (!this.options.model) {
			this.options.model = this.config.apiModelId ?? "gpt-4o-mini"
		}

		// Build the request using the existing requestBuilder
		const result = await this.requestBuilder.buildChatRequest(this.options as FlowChatCompletionOptions, this.streaming)

		// Apply custom headers
		if (Object.keys(this.customHeaders).length > 0) {
			result.headers = { ...result.headers, ...this.customHeaders }
		}

		return result
	}

	/**
	 * Reset the builder to initial state
	 */
	reset(): this {
		this.options = {}
		this.streaming = false
		this.customHeaders = {}
		this.timeout = undefined
		return this
	}

	/**
	 * Create a copy of the current builder
	 */
	clone(): ChatRequestBuilder {
		const clone = new ChatRequestBuilder(this.config, this.tokenManager, this.requestBuilder)
		clone.options = { ...this.options }
		clone.streaming = this.streaming
		clone.customHeaders = { ...this.customHeaders }
		clone.timeout = this.timeout
		return clone
	}
}

/**
 * Embedding Request Builder using Builder Pattern
 */
export class EmbeddingRequestBuilder implements IRequestBuilder<{
	url: string
	headers: Record<string, string>
	payload: any
}> {
	private input: string | string[] = ""
	private model?: string
	private user?: string
	private customHeaders: Record<string, string> = {}
	private dimensions?: number
	private encodingFormat?: string

	constructor(
		private readonly config: FlowConfig,
		private readonly tokenManager: TokenManager,
		private readonly requestBuilder: any // FlowRequestBuilder instance
	) {}

	/**
	 * Set input text or array of texts
	 */
	setInput(input: string | string[]): this {
		this.input = input
		return this
	}

	/**
	 * Set the embedding model
	 */
	setModel(model: string): this {
		this.model = model
		return this
	}

	/**
	 * Set user identifier
	 */
	setUser(user: string): this {
		this.user = user
		return this
	}

	/**
	 * Add custom header
	 */
	addHeader(key: string, value: string): this {
		this.customHeaders[key] = value
		return this
	}

	/**
	 * Add multiple custom headers
	 */
	addHeaders(headers: Record<string, string>): this {
		Object.assign(this.customHeaders, headers)
		return this
	}

	/**
	 * Set dimensions for the embedding
	 */
	setDimensions(dimensions: number): this {
		this.dimensions = dimensions
		return this
	}

	/**
	 * Set encoding format
	 */
	setEncodingFormat(format: string): this {
		this.encodingFormat = format
		return this
	}

	/**
	 * Build the embedding request
	 */
	async build(): Promise<{
		url: string
		headers: Record<string, string>
		payload: any
	}> {
		const options: FlowEmbeddingOptions = {
			input: this.input,
			model: this.model,
			user: this.user,
			...(this.dimensions && { dimensions: this.dimensions }),
			...(this.encodingFormat && { encoding_format: this.encodingFormat }),
		}

		// Build the request using the existing requestBuilder
		const result = await this.requestBuilder.buildEmbeddingRequest(options)

		// Apply custom headers
		if (Object.keys(this.customHeaders).length > 0) {
			result.headers = { ...result.headers, ...this.customHeaders }
		}

		return result
	}

	/**
	 * Reset the builder to initial state
	 */
	reset(): this {
		this.input = ""
		this.model = undefined
		this.user = undefined
		this.customHeaders = {}
		this.dimensions = undefined
		this.encodingFormat = undefined
		return this
	}

	/**
	 * Create a copy of the current builder
	 */
	clone(): EmbeddingRequestBuilder {
		const clone = new EmbeddingRequestBuilder(this.config, this.tokenManager, this.requestBuilder)
		clone.input = this.input
		clone.model = this.model
		clone.user = this.user
		clone.customHeaders = { ...this.customHeaders }
		clone.dimensions = this.dimensions
		clone.encodingFormat = this.encodingFormat
		return clone
	}
}

/**
 * Models Request Builder using Builder Pattern
 */
export class ModelsRequestBuilder implements IRequestBuilder<{
	url: string
	headers: Record<string, string>
	params: Record<string, any>
}> {
	private provider: string = "azure-openai"
	private capabilities: string[] = ["chat-conversation"]
	private customHeaders: Record<string, string> = {}
	private customParams: Record<string, any> = {}

	constructor(
		private readonly config: FlowConfig,
		private readonly tokenManager: TokenManager,
		private readonly requestBuilder: any // FlowRequestBuilder instance
	) {}

	/**
	 * Set the provider
	 */
	setProvider(provider: string): this {
		this.provider = provider
		return this
	}

	/**
	 * Set capabilities
	 */
	setCapabilities(capabilities: string[]): this {
		this.capabilities = capabilities
		return this
	}

	/**
	 * Add a single capability
	 */
	addCapability(capability: string): this {
		if (!this.capabilities.includes(capability)) {
			this.capabilities.push(capability)
		}
		return this
	}

	/**
	 * Remove a capability
	 */
	removeCapability(capability: string): this {
		this.capabilities = this.capabilities.filter(cap => cap !== capability)
		return this
	}

	/**
	 * Add custom header
	 */
	addHeader(key: string, value: string): this {
		this.customHeaders[key] = value
		return this
	}

	/**
	 * Add multiple custom headers
	 */
	addHeaders(headers: Record<string, string>): this {
		Object.assign(this.customHeaders, headers)
		return this
	}

	/**
	 * Add custom parameter
	 */
	addParam(key: string, value: any): this {
		this.customParams[key] = value
		return this
	}

	/**
	 * Add multiple custom parameters
	 */
	addParams(params: Record<string, any>): this {
		Object.assign(this.customParams, params)
		return this
	}

	/**
	 * Build the models request
	 */
	async build(): Promise<{
		url: string
		headers: Record<string, string>
		params: Record<string, any>
	}> {
		// Build the request using the existing requestBuilder
		const result = await this.requestBuilder.buildModelsRequest(this.provider, this.capabilities)

		// Apply custom headers
		if (Object.keys(this.customHeaders).length > 0) {
			result.headers = { ...result.headers, ...this.customHeaders }
		}

		// Apply custom parameters
		if (Object.keys(this.customParams).length > 0) {
			result.params = { ...result.params, ...this.customParams }
		}

		return result
	}

	/**
	 * Reset the builder to initial state
	 */
	reset(): this {
		this.provider = "azure-openai"
		this.capabilities = ["chat-conversation"]
		this.customHeaders = {}
		this.customParams = {}
		return this
	}

	/**
	 * Create a copy of the current builder
	 */
	clone(): ModelsRequestBuilder {
		const clone = new ModelsRequestBuilder(this.config, this.tokenManager, this.requestBuilder)
		clone.provider = this.provider
		clone.capabilities = [...this.capabilities]
		clone.customHeaders = { ...this.customHeaders }
		clone.customParams = { ...this.customParams }
		return clone
	}
}

/**
 * Request Builder Factory using Builder Pattern
 */
export class FlowRequestBuilderFactory {
	constructor(
		private readonly config: FlowConfig,
		private readonly tokenManager: TokenManager,
		private readonly requestBuilder: any // FlowRequestBuilder instance
	) {}

	/**
	 * Create a chat request builder
	 */
	createChatBuilder(): ChatRequestBuilder {
		return new ChatRequestBuilder(this.config, this.tokenManager, this.requestBuilder)
	}

	/**
	 * Create an embedding request builder
	 */
	createEmbeddingBuilder(): EmbeddingRequestBuilder {
		return new EmbeddingRequestBuilder(this.config, this.tokenManager, this.requestBuilder)
	}

	/**
	 * Create a models request builder
	 */
	createModelsBuilder(): ModelsRequestBuilder {
		return new ModelsRequestBuilder(this.config, this.tokenManager, this.requestBuilder)
	}

	/**
	 * Create a pre-configured chat builder for streaming
	 */
	createStreamingChatBuilder(): ChatRequestBuilder {
		return this.createChatBuilder()
			.setStreaming(true)
			.addHeaders({
				"Accept": "text/event-stream",
				"Cache-Control": "no-cache",
				"Connection": "keep-alive",
			})
	}

	/**
	 * Create a pre-configured chat builder for O1/O3 models
	 */
	createO1ChatBuilder(): ChatRequestBuilder {
		return this.createChatBuilder()
			.setStreaming(true)
			// O1/O3 models don't support temperature, so we don't set it
	}

	/**
	 * Create a pre-configured embedding builder with common settings
	 */
	createStandardEmbeddingBuilder(): EmbeddingRequestBuilder {
		return this.createEmbeddingBuilder()
			.setModel("text-embedding-3-small")
			.setDimensions(1536)
	}
}