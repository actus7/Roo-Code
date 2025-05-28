import type { FlowConfig, FlowChatCompletionOptions, FlowEmbeddingOptions } from "./types"
import { determineProvider, getProviderEndpoint } from "./model-utils"
import { generateProviderPayload, generateEmbeddingPayload, validatePayload } from "./payload-generator"
import { createFlowHeaders } from "./request-utils"
import { SecureTokenManager as TokenManager } from "./secure-token-manager"
import { FlowRequestBuilderFactory } from "./request-builders"
import { IFlowRequestBuilder } from "./interfaces"



/**
 * Flow Request Builder
 *
 * Responsible for building requests for Flow API.
 * Handles provider determination, endpoint resolution, payload generation, and header creation.
 */
export class FlowRequestBuilder implements IFlowRequestBuilder {
	private readonly builderFactory: FlowRequestBuilderFactory

	constructor(
		private readonly config: FlowConfig,
		private readonly tokenManager: TokenManager
	) {
		this.builderFactory = new FlowRequestBuilderFactory(this.config, this.tokenManager, this)
	}

	/**
	 * Build a chat completion request
	 */
	async buildChatRequest(
		options: FlowChatCompletionOptions,
		stream: boolean = false
	): Promise<{
		url: string
		headers: Record<string, string>
		payload: any
		provider: string
	}> {
		// Determine provider and model
		const model = options.model ?? this.config.apiModelId ?? "gpt-4o-mini"
		const provider = this.getProviderForModel(model)

		// Get endpoint
		const endpoint = getProviderEndpoint(provider)
		const url = `${this.config.flowBaseUrl}${endpoint}`

		// Generate payload
		const payload = generateProviderPayload(provider, { ...options, model, stream }, this.config)

		// Validate payload
		if (!this.validateRequest(payload, provider)) {
			throw new Error("Invalid request payload generated")
		}

		// Get token and build headers
		const token = await this.tokenManager.getValidToken()
		const headers = this.buildHeaders(token, {
			"Content-Type": "application/json",
			...(stream && {
				"Accept": "text/event-stream",
				"Cache-Control": "no-cache",
				"Connection": "keep-alive",
			}),
		})

		return {
			url,
			headers,
			payload,
			provider,
		}
	}

	/**
	 * Build an embedding request
	 */
	async buildEmbeddingRequest(
		options: FlowEmbeddingOptions
	): Promise<{
		url: string
		headers: Record<string, string>
		payload: any
	}> {
		// Use default embedding model if not specified
		const model = options.model ?? "text-embedding-3-small"

		// Generate payload
		const payload = generateEmbeddingPayload(options.input, model, options.user)

		// Validate payload
		if (!this.validateRequest(payload, "azure-openai")) {
			throw new Error("Invalid embedding request payload generated")
		}

		// Get token and build headers
		const token = await this.tokenManager.getValidToken()
		const headers = this.buildHeaders(token, {
			"Content-Type": "application/json",
			"x-ms-model-mesh-model-name": model,
		})

		// Use embeddings endpoint
		const url = `${this.config.flowBaseUrl}/ai-orchestration-api/v1/embeddings`

		return {
			url,
			headers,
			payload,
		}
	}

	/**
	 * Build a models list request
	 */
	async buildModelsRequest(
		provider: string = "azure-openai",
		capabilities: string[] = ["chat-conversation"]
	): Promise<{
		url: string
		headers: Record<string, string>
		params: Record<string, any>
	}> {
		// Get token and build headers
		const token = await this.tokenManager.getValidToken()
		const headers = this.buildHeaders(token, {
			"Content-Type": "application/json",
		})

		// Build URL and params
		const url = `${this.config.flowBaseUrl}/ai-orchestration-api/v1/models`
		const params = {
			provider,
			capabilities: capabilities.join(","),
		}

		return {
			url,
			headers,
			params,
		}
	}

	/**
	 * Validate request payload
	 */
	validateRequest(payload: any, provider: string): boolean {
		try {
			validatePayload(provider as any, payload)
			return true
		} catch (error) {
			// Log validation error for debugging
			console.debug(`Payload validation failed for provider ${provider}:`, error instanceof Error ? error.message : String(error))
			return false
		}
	}

	/**
	 * Get provider for model
	 */
	getProviderForModel(model: string): string {
		return determineProvider(model)
	}

	/**
	 * Build request headers
	 */
	buildHeaders(token: string, additionalHeaders: Record<string, string> = {}): Record<string, string> {
		const baseHeaders = createFlowHeaders(
			token,
			this.config.flowTenant,
			this.config.flowAgent ?? "chat"
		)
		return {
			...baseHeaders,
			...additionalHeaders,
		}
	}

	/**
	 * Build streaming headers
	 */
	buildStreamingHeaders(token: string): Record<string, string> {
		return this.buildHeaders(token, {
			"Accept": "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
		})
	}

	/**
	 * Build JSON headers
	 */
	buildJsonHeaders(token: string): Record<string, string> {
		return this.buildHeaders(token, {
			"Content-Type": "application/json",
			"Accept": "application/json",
		})
	}

	/**
	 * Build embedding headers
	 */
	buildEmbeddingHeaders(token: string, model: string): Record<string, string> {
		return this.buildHeaders(token, {
			"Content-Type": "application/json",
			"x-ms-model-mesh-model-name": model,
		})
	}

	/**
	 * Get base URL for requests
	 */
	getBaseUrl(): string {
		return this.config.flowBaseUrl
	}

	/**
	 * Get timeout configuration
	 */
	getTimeout(): number {
		return this.config.flowRequestTimeout ?? 30000
	}

	/**
	 * Build request configuration object
	 */
	buildRequestConfig(
		method: string = "POST",
		additionalConfig: Record<string, any> = {}
	): Record<string, any> {
		return {
			method,
			timeout: this.getTimeout(),
			...additionalConfig,
		}
	}

	/**
	 * Validate model compatibility with provider
	 */
	validateModelProvider(model: string, provider: string): boolean {
		const detectedProvider = this.getProviderForModel(model)
		return detectedProvider === provider
	}

	/**
	 * Get supported capabilities for a provider
	 */
	getProviderCapabilities(provider: string): string[] {
		const capabilityMap: Record<string, string[]> = {
			"azure-openai": ["chat-conversation", "streaming", "embeddings", "system-instruction"],
			"google-gemini": ["chat-conversation", "streaming", "image-recognition", "system-instruction"],
			"amazon-bedrock": ["chat-conversation", "streaming", "system-instruction"],
			"azure-foundry": ["chat-conversation", "streaming", "system-instruction"],
		}

		return capabilityMap[provider] ?? ["chat-conversation"]
	}

	/**
	 * Check if provider supports streaming
	 */
	supportsStreaming(provider: string): boolean {
		return this.getProviderCapabilities(provider).includes("streaming")
	}

	/**
	 * Check if provider supports embeddings
	 */
	supportsEmbeddings(provider: string): boolean {
		return this.getProviderCapabilities(provider).includes("embeddings")
	}

	/**
	 * Check if provider supports images
	 */
	supportsImages(provider: string): boolean {
		return this.getProviderCapabilities(provider).includes("image-recognition")
	}

	/**
	 * Validate payload before sending
	 */
	validatePayload(payload: any, provider: string): boolean {
		return this.validateRequest(payload, provider)
	}

	/**
	 * Determine provider from model
	 */
	determineProvider(model: string): string {
		return determineProvider(model)
	}

	/**
	 * Get provider endpoint
	 */
	getProviderEndpoint(provider: string, operation: string): string {
		return getProviderEndpoint(provider, operation)
	}

	/**
	 * Get the builder factory for advanced request building
	 */
	getBuilderFactory(): FlowRequestBuilderFactory {
		return this.builderFactory
	}

	/**
	 * Create a chat request builder using Builder Pattern
	 */
	createChatBuilder() {
		return this.builderFactory.createChatBuilder()
	}

	/**
	 * Create an embedding request builder using Builder Pattern
	 */
	createEmbeddingBuilder() {
		return this.builderFactory.createEmbeddingBuilder()
	}

	/**
	 * Create a models request builder using Builder Pattern
	 */
	createModelsBuilder() {
		return this.builderFactory.createModelsBuilder()
	}

	/**
	 * Create a streaming chat builder using Builder Pattern
	 */
	createStreamingChatBuilder() {
		return this.builderFactory.createStreamingChatBuilder()
	}

	/**
	 * Create an O1/O3 optimized chat builder using Builder Pattern
	 */
	createO1ChatBuilder() {
		return this.builderFactory.createO1ChatBuilder()
	}

	/**
	 * Create a standard embedding builder using Builder Pattern
	 */
	createStandardEmbeddingBuilder() {
		return this.builderFactory.createStandardEmbeddingBuilder()
	}
}
