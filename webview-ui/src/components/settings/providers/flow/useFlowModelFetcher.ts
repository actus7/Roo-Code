/**
 * useFlowModelFetcher - Custom Hook for Fetching Flow Models
 * 
 * This hook provides functionality for fetching Flow models from the API
 * with cache support, timeout handling, and error management.
 */

import { useState, useCallback, useRef } from 'react'
import { vscode } from '@src/utils/vscode'
import { flowModelCache } from '@src/utils/flowModelCache'
import { FlowConfig, FlowConfigValidator } from './FlowConfigValidator'

export interface ModelOption {
	value: string
	label: string
	provider: string
}

export interface FetchState {
	models: ModelOption[]
	isLoading: boolean
	error: string | null
	isUsingCache: boolean
	cacheInfo: { age?: number; expiresIn?: number } | null
	lastFetchConfig: string
}

export interface FetchOptions {
	isAutoLoad?: boolean
	forceRefresh?: boolean
	timeout?: number
}

/**
 * Custom hook for fetching Flow models
 */
export const useFlowModelFetcher = (config: FlowConfig) => {
	const [state, setState] = useState<FetchState>({
		models: [],
		isLoading: false,
		error: null,
		isUsingCache: false,
		cacheInfo: null,
		lastFetchConfig: ""
	})

	const timeoutRef = useRef<NodeJS.Timeout>()
	const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null)

	/**
	 * Get hardcoded models as fallback - synchronized with backend HARDCODED_MODELS
	 */
	const getHardcodedModels = useCallback((): ModelOption[] => {
		return [
			// Azure OpenAI models
			{
				value: "gpt-4",
				label: "azure-openai - gpt-4 (Context: 8,192 tokens) (hardcoded)",
				provider: "azure-openai"
			},
			{
				value: "gpt-4o",
				label: "azure-openai - gpt-4o (Context: 128,000 tokens) (hardcoded)",
				provider: "azure-openai"
			},
			{
				value: "gpt-4o-mini",
				label: "azure-openai - gpt-4o-mini (Context: 128,000 tokens) (hardcoded)",
				provider: "azure-openai"
			},
			{
				value: "o1-mini",
				label: "azure-openai - o1-mini (Context: 128,000 tokens) (hardcoded)",
				provider: "azure-openai"
			},
			{
				value: "o3-mini",
				label: "azure-openai - o3-mini (Context: 200,000 tokens) (hardcoded)",
				provider: "azure-openai"
			},
			{
				value: "text-embedding-ada-002",
				label: "azure-openai - text-embedding-ada-002 (hardcoded)",
				provider: "azure-openai"
			},
			{
				value: "text-embedding-3-small",
				label: "azure-openai - text-embedding-3-small (hardcoded)",
				provider: "azure-openai"
			},
			// Google Gemini models
			{
				value: "gemini-2.0-flash",
				label: "google-gemini - gemini-2.0-flash (Context: 8,192 tokens) (hardcoded)",
				provider: "google-gemini"
			},
			{
				value: "gemini-2.5-pro",
				label: "google-gemini - gemini-2.5-pro (Context: 1,048,576 tokens) (hardcoded)",
				provider: "google-gemini"
			},
			// Amazon Bedrock models
			{
				value: "amazon.nova-lite",
				label: "amazon-bedrock - amazon.nova-lite (Context: 300,000 tokens) (hardcoded)",
				provider: "amazon-bedrock"
			},
			{
				value: "amazon.nova-micro",
				label: "amazon-bedrock - amazon.nova-micro (Context: 128,000 tokens) (hardcoded)",
				provider: "amazon-bedrock"
			},
			{
				value: "amazon.nova-pro",
				label: "amazon-bedrock - amazon.nova-pro (Context: 300,000 tokens) (hardcoded)",
				provider: "amazon-bedrock"
			},
			{
				value: "anthropic.claude-3-sonnet",
				label: "amazon-bedrock - anthropic.claude-3-sonnet (Context: 200,000 tokens) (hardcoded)",
				provider: "amazon-bedrock"
			},
			{
				value: "anthropic.claude-37-sonnet",
				label: "amazon-bedrock - anthropic.claude-37-sonnet (Context: 200,000 tokens) (hardcoded)",
				provider: "amazon-bedrock"
			},
			{
				value: "meta.llama3-70b-instruct",
				label: "amazon-bedrock - meta.llama3-70b-instruct (Context: 200,000 tokens) (hardcoded)",
				provider: "amazon-bedrock"
			},
			// Azure Foundry models
			{
				value: "DeepSeek-R1",
				label: "azure-foundry - DeepSeek-R1 (hardcoded)",
				provider: "azure-foundry"
			}
		]
	}, [])

	/**
	 * Clean up any pending operations
	 */
	const cleanup = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = undefined
		}

		if (messageHandlerRef.current) {
			window.removeEventListener("message", messageHandlerRef.current)
			messageHandlerRef.current = null
		}
	}, [])

	/**
	 * Update state with new values
	 */
	const updateState = useCallback((updates: Partial<FetchState>) => {
		setState(prevState => ({ ...prevState, ...updates }))
	}, [])

	/**
	 * Handle successful model fetch
	 */
	const handleFetchSuccess = useCallback((models: ModelOption[], configHash: string, isAutoLoad: boolean) => {
		console.log(`[useFlowModelFetcher] ${isAutoLoad ? 'Auto-load' : 'Manual load'} successful`, {
			modelCount: models.length,
			providers: Array.from(new Set(models.map(m => m.provider)))
		})

		// Cache the models
		flowModelCache.cacheModels(models, config)

		updateState({
			models,
			lastFetchConfig: configHash,
			isUsingCache: false,
			cacheInfo: flowModelCache.getCacheInfo(),
			error: isAutoLoad ? state.error : null, // Don't clear error on auto-load
			isLoading: false
		})
	}, [config, updateState, state.error])

	/**
	 * Handle fetch error
	 */
	const handleFetchError = useCallback((error: string, configHash: string, isAutoLoad: boolean) => {
		console.error(`[useFlowModelFetcher] ${isAutoLoad ? 'Auto-load' : 'Manual load'} failed:`, error)

		if (isAutoLoad) {
			// For auto-load, silently fall back to hardcoded models
			console.log("[useFlowModelFetcher] Auto-load failed, using hardcoded models as fallback")
			updateState({
				models: getHardcodedModels(),
				lastFetchConfig: configHash,
				isLoading: false
			})
		} else {
			// For manual load, show error to user
			updateState({
				error,
				models: getHardcodedModels(),
				isLoading: false
			})
		}
	}, [updateState, getHardcodedModels])

	/**
	 * Handle fetch timeout
	 */
	const handleTimeout = useCallback((configHash: string, isAutoLoad: boolean) => {
		const timeoutMsg = "Timeout ao buscar modelos (30s)"
		console.error(`[useFlowModelFetcher] ${isAutoLoad ? 'Auto-load' : 'Manual load'} timeout after 30 seconds`, {
			configSummary: FlowConfigValidator.sanitizeConfigForLogging(config)
		})

		cleanup()
		handleFetchError(timeoutMsg, configHash, isAutoLoad)
	}, [config, cleanup, handleFetchError])

	/**
	 * Fetch models from cache or backend
	 */
	const fetchModels = useCallback(async (options: FetchOptions = {}) => {
		const { isAutoLoad = false, forceRefresh = false, timeout = 30000 } = options

		if (!FlowConfigValidator.isConfigComplete(config)) {
			updateState({
				models: [],
				isUsingCache: false,
				cacheInfo: null,
				error: isAutoLoad ? state.error : "Configuração incompleta. Preencha Tenant, Client ID e Client Secret."
			})
			return
		}

		const currentConfigHash = FlowConfigValidator.getConfigHash(config)
		console.log(`[useFlowModelFetcher] ${isAutoLoad ? 'Auto-loading' : 'Manual loading'} models started`, {
			hasCredentials: {
				tenant: !!config.flowTenant,
				clientId: !!config.flowClientId,
				clientSecret: !!config.flowClientSecret,
				baseUrl: !!config.flowBaseUrl
			},
			configHash: currentConfigHash,
			forceRefresh
		})

		// Check cache first (unless force refresh)
		if (!forceRefresh) {
			const cachedModels = flowModelCache.getCachedModels(config)
			if (cachedModels && cachedModels.length > 0) {
				console.log(`[useFlowModelFetcher] Using cached models`, {
					modelCount: cachedModels.length,
					providers: Array.from(new Set(cachedModels.map(m => m.provider)))
				})

				updateState({
					models: cachedModels,
					lastFetchConfig: currentConfigHash,
					isUsingCache: true,
					cacheInfo: flowModelCache.getCacheInfo(),
					error: isAutoLoad ? state.error : null
				})
				return
			}
		}

		// Start loading
		updateState({
			isLoading: true,
			isUsingCache: false,
			cacheInfo: null,
			error: isAutoLoad ? state.error : null
		})

		cleanup() // Clean up any previous operations

		try {
			const requestConfig = FlowConfigValidator.normalizeConfig(config)

			console.log(`[useFlowModelFetcher] Sending fetchFlowModels request`, {
				configSummary: FlowConfigValidator.sanitizeConfigForLogging(requestConfig)
			})

			// Create message handler
			const handleMessage = (event: MessageEvent) => {
				const message = event.data
				console.log(`[useFlowModelFetcher] Received message:`, { type: message.type, isAutoLoad })

				if (message.type === "fetchFlowModelsResult") {
					console.log(`[useFlowModelFetcher] Processing fetchFlowModelsResult`, {
						success: message.success,
						hasModels: !!message.models,
						modelCount: message.models?.length || 0,
						error: message.error
					})

					cleanup()

					if (message.success && message.models) {
						handleFetchSuccess(message.models, currentConfigHash, isAutoLoad)
					} else {
						const errorMsg = message.error || "Falha ao buscar modelos"
						handleFetchError(errorMsg, currentConfigHash, isAutoLoad)
					}
				}
			}

			messageHandlerRef.current = handleMessage
			window.addEventListener("message", handleMessage)

			// Send request to backend to fetch models
			vscode.postMessage({
				type: "fetchFlowModels",
				config: requestConfig
			})

			// Set timeout to avoid hanging
			timeoutRef.current = setTimeout(() => {
				handleTimeout(currentConfigHash, isAutoLoad)
			}, timeout)

		} catch (err) {
			cleanup()
			const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao buscar modelos"
			console.error(`[useFlowModelFetcher] ${isAutoLoad ? 'Auto-load' : 'Manual load'} exception:`, err)
			handleFetchError(errorMsg, currentConfigHash, isAutoLoad)
		}
	}, [config, state.error, updateState, cleanup, handleFetchSuccess, handleFetchError, handleTimeout])

	/**
	 * Retry fetching models (always manual)
	 */
	const retry = useCallback(() => {
		console.log("[useFlowModelFetcher] Manual retry triggered")
		fetchModels({ isAutoLoad: false })
	}, [fetchModels])

	/**
	 * Force refresh models (bypass cache)
	 */
	const refresh = useCallback(() => {
		console.log("[useFlowModelFetcher] Manual refresh triggered (bypassing cache)")
		fetchModels({ isAutoLoad: false, forceRefresh: true })
	}, [fetchModels])

	/**
	 * Clear current state
	 */
	const clear = useCallback(() => {
		cleanup()
		setState({
			models: [],
			isLoading: false,
			error: null,
			isUsingCache: false,
			cacheInfo: null,
			lastFetchConfig: ""
		})
	}, [cleanup])

	return {
		...state,
		fetchModels,
		retry,
		refresh,
		clear,
		getHardcodedModels
	}
}
