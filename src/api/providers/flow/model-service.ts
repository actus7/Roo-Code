import type { FlowConfig, FlowProvider, Model } from "./types"
import { FLOW_ENDPOINTS, PROVIDER_CAPABILITIES } from "./config"
import { SecureTokenManager as TokenManager } from "./secure-token-manager"
import { makeJsonRequest, createFlowHeaders, handleHttpError } from "./request-utils"
import { debug } from "./utils"

/**
 * Cache for storing fetched models to avoid redundant API calls
 */
interface ModelCache {
	[provider: string]: {
		models: Model[]
		timestamp: number
		ttl: number
	}
}

const modelCache: ModelCache = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Hardcoded models that work but may not appear in API endpoints
 * Updated to include all known working models from API testing
 */
const HARDCODED_MODELS: Record<FlowProvider, Model[]> = {
	"azure-openai": [
		{
			id: "gpt-4",
			name: "gpt-4",
			provider: "azure-openai",
			capabilities: ["system-instruction", "chat-conversation", "streaming"],
			inputTokens: 8192,
			description: "GPT-4 model (hardcoded)"
		},
		{
			id: "gpt-4o",
			name: "gpt-4o",
			provider: "azure-openai",
			capabilities: ["streaming", "system-instruction", "chat-conversation", "image-recognition"],
			inputTokens: 128000,
			description: "GPT-4o model (hardcoded)"
		},
		{
			id: "gpt-4o-mini",
			name: "gpt-4o-mini",
			provider: "azure-openai",
			capabilities: ["streaming", "system-instruction", "chat-conversation", "image-recognition"],
			inputTokens: 128000,
			description: "GPT-4o Mini model (hardcoded)"
		},
		{
			id: "o1-mini",
			name: "o1-mini",
			provider: "azure-openai",
			capabilities: ["system-instruction", "chat-conversation", "streaming"],
			inputTokens: 128000,
			description: "O1 Mini model (hardcoded)"
		},
		{
			id: "o3-mini",
			name: "o3-mini",
			provider: "azure-openai",
			capabilities: ["streaming", "system-instruction", "chat-conversation"],
			inputTokens: 200000,
			description: "O3 Mini model (hardcoded)"
		},
		{
			id: "text-embedding-ada-002",
			name: "text-embedding-ada-002",
			provider: "azure-openai",
			capabilities: ["embeddings"],
			inputTokens: 8191,
			description: "Text Embedding Ada 002 (hardcoded)"
		},
		{
			id: "text-embedding-3-small",
			name: "text-embedding-3-small",
			provider: "azure-openai",
			capabilities: ["embeddings"],
			inputTokens: 8191,
			description: "Text Embedding 3 Small (hardcoded)"
		}
	],
	"google-gemini": [
		{
			id: "gemini-2.0-flash",
			name: "gemini-2.0-flash",
			provider: "google-gemini",
			capabilities: ["streaming", "chat-conversation", "image-recognition", "system-instruction"],
			inputTokens: 8192,
			description: "Gemini 2.0 Flash model (hardcoded)"
		},
		{
			id: "gemini-2.5-pro",
			name: "gemini-2.5-pro",
			provider: "google-gemini",
			capabilities: ["streaming", "chat-conversation", "image-recognition", "system-instruction"],
			inputTokens: 1048576,
			description: "Gemini 2.5 Pro model (hardcoded)"
		}
	],
	"amazon-bedrock": [
		{
			id: "amazon.nova-lite",
			name: "amazon.nova-lite",
			provider: "amazon-bedrock",
			capabilities: ["chat-conversation", "image-recognition", "streaming"],
			inputTokens: 300000,
			description: "Amazon Nova Lite model (hardcoded)"
		},
		{
			id: "amazon.nova-micro",
			name: "amazon.nova-micro",
			provider: "amazon-bedrock",
			capabilities: ["chat-conversation", "streaming"],
			inputTokens: 128000,
			description: "Amazon Nova Micro model (hardcoded)"
		},
		{
			id: "amazon.nova-pro",
			name: "amazon.nova-pro",
			provider: "amazon-bedrock",
			capabilities: ["chat-conversation", "image-recognition", "streaming"],
			inputTokens: 300000,
			description: "Amazon Nova Pro model (hardcoded)"
		},
		{
			id: "anthropic.claude-3-sonnet",
			name: "anthropic.claude-3-sonnet",
			provider: "amazon-bedrock",
			capabilities: ["chat-conversation", "image-recognition", "streaming", "system-instruction"],
			inputTokens: 200000,
			description: "Anthropic Claude 3 Sonnet model (hardcoded)"
		},
		{
			id: "anthropic.claude-37-sonnet",
			name: "anthropic.claude-37-sonnet",
			provider: "amazon-bedrock",
			capabilities: ["chat-conversation", "image-recognition", "streaming", "system-instruction"],
			inputTokens: 200000,
			description: "Anthropic Claude 3.7 Sonnet model (hardcoded)"
		},
		{
			id: "meta.llama3-70b-instruct",
			name: "meta.llama3-70b-instruct",
			provider: "amazon-bedrock",
			capabilities: ["chat-conversation", "image-recognition", "streaming"],
			inputTokens: 200000,
			description: "Meta Llama 3 70B Instruct model (hardcoded)"
		}
	],
	"azure-foundry": [
		{
			id: "DeepSeek-R1",
			name: "DeepSeek-R1",
			provider: "azure-foundry",
			capabilities: ["chat-conversation"],
			inputTokens: undefined,
			description: "DeepSeek R1 model (hardcoded)"
		}
	]
}

/**
 * Service for fetching and managing Flow models
 */
export class FlowModelService {
	private config: FlowConfig
	private tokenManager: TokenManager

	constructor(config: FlowConfig) {
		this.config = config
		this.tokenManager = new TokenManager(config)
	}

	/**
	 * Fetch models from a specific provider
	 * @param provider Flow provider name
	 * @param useCache Whether to use cached results
	 * @returns Promise resolving to array of models
	 */
	async fetchModelsFromProvider(provider: FlowProvider, useCache = true): Promise<Model[]> {
		const cacheKey = `${provider}-${this.config.flowTenant}`

		// Check cache first
		if (useCache && this.isCacheValid(cacheKey)) {
			debug(`Using cached models for provider: ${provider}`)
			return modelCache[cacheKey].models
		}

		try {
			const capabilities = PROVIDER_CAPABILITIES[provider]?.join(",") || "system-instruction,chat-conversation"
			const url = `${this.config.flowBaseUrl}${FLOW_ENDPOINTS.models}/${provider}?capabilities=${capabilities}`

			const token = await this.tokenManager.getValidToken()
			const headers = createFlowHeaders(token, this.config.flowTenant, this.config.flowAgent ?? "chat")

			const response = await makeJsonRequest<Model[]>(url, {
				method: "GET",
				headers,
				timeout: this.config.flowRequestTimeout
			})

			// Transform and validate response
			const models = this.transformApiModels(response, provider)

			// Add hardcoded models
			const hardcodedModels = HARDCODED_MODELS[provider] || []

			const allModels = [...models, ...hardcodedModels]

			// Remove duplicates based on model ID
			const uniqueModels = this.removeDuplicateModels(allModels)

			// Cache the results
			this.cacheModels(cacheKey, uniqueModels)

			return uniqueModels

		} catch (error) {
			const enhancedError = handleHttpError(error, `Fetching models from ${provider}`)
			debug(`Error fetching models from ${provider}`, { error: enhancedError.message })

			// Return hardcoded models as fallback
			const fallbackModels = HARDCODED_MODELS[provider] || []
			return fallbackModels
		}
	}

	/**
	 * Fetch models from all providers
	 * @param useCache Whether to use cached results
	 * @returns Promise resolving to grouped models by provider
	 */
	async fetchAllModels(useCache = true): Promise<Record<FlowProvider, Model[]>> {
		const providers: FlowProvider[] = ["azure-openai", "google-gemini", "amazon-bedrock", "azure-foundry"]
		const results: Record<FlowProvider, Model[]> = {} as Record<FlowProvider, Model[]>

		// Fetch models from all providers in parallel
		const promises = providers.map(async (provider) => {
			try {
				const models = await this.fetchModelsFromProvider(provider, useCache)
				return { provider, models }
			} catch (error) {
				debug(`Failed to fetch models from ${provider}`, { error })
				return { provider, models: HARDCODED_MODELS[provider] || [] }
			}
		})

		const responses = await Promise.allSettled(promises)

		responses.forEach((response, index) => {
			const provider = providers[index]
			if (response.status === "fulfilled") {
				results[provider] = response.value.models
			} else {
				debug(`Promise rejected for ${provider}`, { reason: response.reason })
				results[provider] = HARDCODED_MODELS[provider] || []
			}
		})

		return results
	}

	/**
	 * Get models formatted for dropdown selection
	 * @param useCache Whether to use cached results
	 * @returns Promise resolving to formatted model options
	 */
	async getModelOptions(useCache = true): Promise<Array<{ value: string; label: string; provider: string }>> {
		const allModels = await this.fetchAllModels(useCache)

		const options: Array<{ value: string; label: string; provider: string }> = []

		Object.entries(allModels).forEach(([provider, models]) => {
			models.forEach((model) => {
				const contextInfo = model.inputTokens ? ` (Context: ${model.inputTokens.toLocaleString()} tokens)` : ""
				const label = `${provider} - ${model.name}${contextInfo}`

				const option = {
					value: model.id,
					label,
					provider
				}

				options.push(option)
			})
		})

		// Sort by provider, then by model name
		options.sort((a, b) => {
			if (a.provider !== b.provider) {
				return a.provider.localeCompare(b.provider)
			}
			return a.label.localeCompare(b.label)
		})

		return options
	}

	/**
	 * Clear cache for a specific provider or all providers
	 * @param provider Optional provider to clear cache for
	 */
	clearCache(provider?: FlowProvider): void {
		if (provider) {
			const cacheKey = `${provider}-${this.config.flowTenant}`
			delete modelCache[cacheKey]
			debug(`Cleared cache for provider: ${provider}`)
		} else {
			Object.keys(modelCache).forEach(key => delete modelCache[key])
			debug("Cleared all model cache")
		}
	}

	/**
	 * Check if cached data is still valid
	 */
	private isCacheValid(cacheKey: string): boolean {
		const cached = modelCache[cacheKey]
		if (!cached) return false

		const now = Date.now()
		return now < cached.timestamp + cached.ttl
	}

	/**
	 * Cache models for a provider
	 */
	private cacheModels(cacheKey: string, models: Model[]): void {
		modelCache[cacheKey] = {
			models,
			timestamp: Date.now(),
			ttl: CACHE_TTL
		}
	}

	/**
	 * Transform API response to Model objects
	 */
	private transformApiModels(response: any, provider: FlowProvider): Model[] {
		if (!Array.isArray(response)) {
			debug(`Invalid response format for ${provider}`, { response })
			return []
		}

		return response.map((item: any) => ({
			id: item.id || item.name,
			name: item.name || item.id,
			provider,
			capabilities: item.capabilities || [],
			inputTokens: item.inputTokens || item.contextWindow,
			description: item.description || `${item.name || item.id} model`
		}))
	}

	/**
	 * Remove duplicate models based on ID
	 */
	private removeDuplicateModels(models: Model[]): Model[] {
		const seen = new Set<string>()
		return models.filter(model => {
			if (seen.has(model.id)) {
				return false
			}
			seen.add(model.id)
			return true
		})
	}
}
