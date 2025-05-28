import React, { useState, useEffect, useCallback } from "react"
import { VSCodeDropdown, VSCodeOption, VSCodeProgressRing, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { flowModelCache } from "@src/utils/flowModelCache"

interface ModelOption {
	value: string
	label: string
	provider: string
}

interface FlowModelSelectorProps {
	selectedModel?: string
	onModelChange: (modelId: string) => void
	flowConfig: {
		flowBaseUrl?: string
		flowTenant?: string
		flowClientId?: string
		flowClientSecret?: string
		flowAuthBaseUrl?: string
		flowAppToAccess?: string
	}
	disabled?: boolean
}

export const FlowModelSelector: React.FC<FlowModelSelectorProps> = ({
	selectedModel,
	onModelChange,
	flowConfig,
	disabled = false
}) => {
	const { t } = useAppTranslation()
	const [models, setModels] = useState<ModelOption[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [lastFetchConfig, setLastFetchConfig] = useState<string>("")
	const [hasAttemptedAutoLoad, setHasAttemptedAutoLoad] = useState(false)
	const [isUsingCache, setIsUsingCache] = useState(false)
	const [cacheInfo, setCacheInfo] = useState<{ age?: number; expiresIn?: number } | null>(null)
	const [isModelValidated, setIsModelValidated] = useState(false)
	const [isUserSelection, setIsUserSelection] = useState(false)

	// Check if configuration is complete enough to fetch models
	const isConfigComplete = useCallback(() => {
		return !!(
			flowConfig.flowTenant &&
			flowConfig.flowClientId &&
			flowConfig.flowClientSecret
			// Note: flowBaseUrl is optional, defaults to "https://flow.ciandt.com"
		)
	}, [flowConfig])

	// Create a config hash to detect changes
	const getConfigHash = useCallback(() => {
		return JSON.stringify({
			baseUrl: flowConfig.flowBaseUrl,
			tenant: flowConfig.flowTenant,
			clientId: flowConfig.flowClientId,
			// Don't include secret in hash for security, but include a flag if it exists
			hasSecret: !!flowConfig.flowClientSecret,
			authBaseUrl: flowConfig.flowAuthBaseUrl,
			appToAccess: flowConfig.flowAppToAccess
		})
	}, [flowConfig])

	// Fetch models from cache or backend
	const fetchModels = useCallback(async (isAutoLoad = false, forceRefresh = false) => {
		if (!isConfigComplete()) {
			setModels([])
			setIsUsingCache(false)
			setCacheInfo(null)
			if (!isAutoLoad) {
				setError("Configuração incompleta. Preencha Tenant, Client ID e Client Secret.")
			}
			return
		}

		const currentConfigHash = getConfigHash()
		console.log(`[FlowModelSelector] ${isAutoLoad ? 'Auto-loading' : 'Manual loading'} models started`, {
			hasCredentials: {
				tenant: !!flowConfig.flowTenant,
				clientId: !!flowConfig.flowClientId,
				clientSecret: !!flowConfig.flowClientSecret,
				baseUrl: !!flowConfig.flowBaseUrl
			},
			configHash: currentConfigHash,
			forceRefresh
		})

		// Check cache first (unless force refresh)
		if (!forceRefresh) {
			const cachedModels = flowModelCache.getCachedModels(flowConfig)
			if (cachedModels && cachedModels.length > 0) {
				console.log(`[FlowModelSelector] Using cached models`, {
					modelCount: cachedModels.length,
					providers: Array.from(new Set(cachedModels.map(m => m.provider)))
				})

				setModels(cachedModels)
				setLastFetchConfig(currentConfigHash)
				setIsUsingCache(true)
				setCacheInfo(flowModelCache.getCacheInfo())
				if (!isAutoLoad) {
					setError(null)
				}
				return
			}
		}

		setIsLoading(true)
		setIsUsingCache(false)
		setCacheInfo(null)
		if (!isAutoLoad) {
			setError(null)
		}

		let timeoutId: NodeJS.Timeout | undefined

		try {
			const requestConfig = {
				flowBaseUrl: flowConfig.flowBaseUrl || "https://flow.ciandt.com",
				flowAuthBaseUrl: flowConfig.flowAuthBaseUrl || flowConfig.flowBaseUrl || "https://flow.ciandt.com",
				flowTenant: flowConfig.flowTenant,
				flowClientId: flowConfig.flowClientId,
				flowClientSecret: flowConfig.flowClientSecret,
				flowAppToAccess: flowConfig.flowAppToAccess || "llm-api"
			}

			console.log(`[FlowModelSelector] Sending fetchFlowModels request`, {
				configSummary: {
					baseUrl: requestConfig.flowBaseUrl,
					authBaseUrl: requestConfig.flowAuthBaseUrl,
					tenant: requestConfig.flowTenant,
					clientId: requestConfig.flowClientId ? `${requestConfig.flowClientId.substring(0, 8)}...` : 'missing',
					hasSecret: !!requestConfig.flowClientSecret,
					appToAccess: requestConfig.flowAppToAccess
				}
			})

			// Send request to backend to fetch models
			vscode.postMessage({
				type: "fetchFlowModels",
				config: requestConfig
			})

			// Listen for response
			const handleMessage = (event: MessageEvent) => {
				const message = event.data
				console.log(`[FlowModelSelector] Received message:`, { type: message.type, isAutoLoad })

				if (message.type === "fetchFlowModelsResult") {
					console.log(`[FlowModelSelector] Processing fetchFlowModelsResult`, {
						success: message.success,
						hasModels: !!message.models,
						modelCount: message.models?.length || 0,
						error: message.error
					})

					window.removeEventListener("message", handleMessage)
					if (timeoutId) clearTimeout(timeoutId)

					if (message.success && message.models) {
						console.log(`[FlowModelSelector] ${isAutoLoad ? 'Auto-load' : 'Manual load'} successful`, {
							modelCount: message.models.length,
							providers: Array.from(new Set(message.models.map((m: ModelOption) => m.provider)))
						})

						// Cache the models
						flowModelCache.cacheModels(message.models, flowConfig)

						setModels(message.models)
						setLastFetchConfig(currentConfigHash)
						setIsUsingCache(false)
						setCacheInfo(flowModelCache.getCacheInfo())
						if (!isAutoLoad) {
							setError(null)
						}
					} else {
						const errorMsg = message.error || "Falha ao buscar modelos"
						console.error(`[FlowModelSelector] ${isAutoLoad ? 'Auto-load' : 'Manual load'} failed:`, errorMsg)

						if (isAutoLoad) {
							// For auto-load, silently fall back to hardcoded models
							console.log("[FlowModelSelector] Auto-load failed, using hardcoded models as fallback")
							setModels(getHardcodedModels())
							setLastFetchConfig(currentConfigHash)
						} else {
							// For manual load, show error to user
							throw new Error(errorMsg)
						}
					}
					setIsLoading(false)
				}
			}

			window.addEventListener("message", handleMessage)

			// Set timeout to avoid hanging (30 seconds for Flow API calls)
			timeoutId = setTimeout(() => {
				window.removeEventListener("message", handleMessage)
				const timeoutMsg = "Timeout ao buscar modelos (30s)"
				console.error(`[FlowModelSelector] ${isAutoLoad ? 'Auto-load' : 'Manual load'} timeout after 30 seconds`, {
					configSummary: {
						tenant: flowConfig.flowTenant,
						hasClientId: !!flowConfig.flowClientId,
						hasSecret: !!flowConfig.flowClientSecret,
						baseUrl: flowConfig.flowBaseUrl || "https://flow.ciandt.com"
					}
				})

				if (isAutoLoad) {
					// For auto-load, silently fall back to hardcoded models
					console.log("[FlowModelSelector] Auto-load timeout, using hardcoded models as fallback")
					setModels(getHardcodedModels())
					setLastFetchConfig(currentConfigHash)
				} else {
					// For manual load, show error to user
					setError(timeoutMsg)
					setModels(getHardcodedModels())
				}
				setIsLoading(false)
			}, 30000)
		} catch (err) {
			if (timeoutId) clearTimeout(timeoutId)
			const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao buscar modelos"
			console.error(`[FlowModelSelector] ${isAutoLoad ? 'Auto-load' : 'Manual load'} exception:`, err)

			if (isAutoLoad) {
				// For auto-load, silently fall back to hardcoded models
				console.log("[FlowModelSelector] Auto-load exception, using hardcoded models as fallback")
				setModels(getHardcodedModels())
				setLastFetchConfig(currentConfigHash)
			} else {
				// For manual load, show error to user
				setError(errorMsg)
				setModels(getHardcodedModels())
			}
			setIsLoading(false)
		}
	}, [flowConfig, isConfigComplete, getConfigHash])

	// Validate and apply model selection when models are loaded
	const validateAndApplyModelSelection = useCallback(() => {
		if (!selectedModel || models.length === 0 || isModelValidated) {
			return
		}

		console.log(`[FlowModelSelector] Validating model selection`, {
			selectedModel,
			availableModels: models.length,
			modelValues: models.map(m => m.value),
			isUserSelection
		})

		// First, check if the selected model exists in the available models
		const modelExists = models.some(model => model.value === selectedModel)

		// If model exists, mark as validated and don't change anything
		if (modelExists) {
			console.log(`[FlowModelSelector] Selected model "${selectedModel}" is valid and available`)
			setIsModelValidated(true)
			// Reset user selection flag after validation
			if (isUserSelection) {
				setIsUserSelection(false)
			}
			return
		}

		// Check for invalid Anthropic default model IDs that shouldn't be in Flow context
		const invalidAnthropicModels = [
			"claude-sonnet-4-20250514",
			"claude-opus-4-20250514",
			"claude-3-7-sonnet-20250219",
			"claude-3-5-sonnet-20241022",
			"claude-3-5-haiku-20241022",
			"claude-3-opus-20240229",
			"claude-3-haiku-20240307"
		]

		// Only apply mapping if the model is actually invalid AND it's not a user selection
		if (invalidAnthropicModels.includes(selectedModel) && !isUserSelection) {
			console.warn(`[FlowModelSelector] Invalid Anthropic model ID "${selectedModel}" detected in Flow context. This suggests a configuration mismatch.`)

			// Try to find a corresponding Flow model
			const flowAnthropicModel = models.find(model =>
				model.provider === "amazon-bedrock" &&
				model.value.includes("anthropic.claude") &&
				!model.label.includes("hardcoded")
			)

			if (flowAnthropicModel) {
				console.log(`[FlowModelSelector] Mapping invalid Anthropic model to Flow equivalent: "${flowAnthropicModel.value}"`)
				onModelChange(flowAnthropicModel.value)
				setIsModelValidated(true)
				return
			}
		}

		// Model not found and not in invalid list - try fallback only if not a user selection
		if (!isUserSelection) {
			console.warn(`[FlowModelSelector] Selected model "${selectedModel}" not found in available models`, {
				availableModels: models.map(m => ({ value: m.value, label: m.label }))
			})

			// Try to find a similar model or use a smart fallback
			const fallbackModel = findBestFallbackModel(selectedModel, models)

			if (fallbackModel) {
				console.log(`[FlowModelSelector] Using fallback model: "${fallbackModel.value}" (reason: ${fallbackModel.reason})`)
				onModelChange(fallbackModel.value)
				setIsModelValidated(true)
			}
		} else {
			// If it's a user selection but model doesn't exist, just mark as validated
			// This allows the user to select models that might not be in the current list
			console.log(`[FlowModelSelector] User selected model "${selectedModel}" not found, but respecting user choice`)
			setIsModelValidated(true)
			setIsUserSelection(false)
		}
	}, [selectedModel, models, isModelValidated, isUserSelection, onModelChange])

	// Find the best fallback model when the selected model is not available
	const findBestFallbackModel = (selectedModel: string, availableModels: ModelOption[]): { value: string; reason: string } | null => {
		if (availableModels.length === 0) {
			return null
		}

		// 1. Try exact partial match (e.g., "gpt-4o" matches "gpt-4o-mini")
		let fallback = availableModels.find(model =>
			model.value.includes(selectedModel) || selectedModel.includes(model.value)
		)
		if (fallback) {
			return { value: fallback.value, reason: "partial match" }
		}

		// 2. Special handling for Anthropic models - map to Flow equivalents
		if (selectedModel.includes("claude")) {
			// Map Anthropic model IDs to Flow model IDs
			const anthropicMappings: Record<string, string> = {
				"claude-sonnet-4-20250514": "anthropic.claude-37-sonnet",
				"claude-opus-4-20250514": "anthropic.claude-37-sonnet", // Fallback to sonnet
				"claude-3-7-sonnet-20250219": "anthropic.claude-37-sonnet",
				"claude-3-5-sonnet-20241022": "anthropic.claude-3-sonnet",
				"claude-3-5-haiku-20241022": "anthropic.claude-3-sonnet", // Fallback to sonnet
				"claude-3-opus-20240229": "anthropic.claude-3-sonnet",
				"claude-3-haiku-20240307": "anthropic.claude-3-sonnet"
			}

			const mappedModel = anthropicMappings[selectedModel]
			if (mappedModel) {
				fallback = availableModels.find(model => model.value === mappedModel)
				if (fallback) {
					return { value: fallback.value, reason: `Anthropic model mapping (${selectedModel} → ${mappedModel})` }
				}
			}

			// Try to find any Claude model in Flow format
			fallback = availableModels.find(model =>
				model.provider === "amazon-bedrock" &&
				model.value.includes("anthropic.claude") &&
				!model.label.includes("hardcoded")
			)
			if (fallback) {
				return { value: fallback.value, reason: "Claude model family match" }
			}
		}

		// 3. Try to match by model family (e.g., "gpt-4" family)
		const modelFamily = selectedModel.split('-')[0] // e.g., "gpt" from "gpt-4o"
		fallback = availableModels.find(model => model.value.startsWith(modelFamily))
		if (fallback) {
			return { value: fallback.value, reason: "model family match" }
		}

		// 4. Try to match by provider (look for same provider in model label)
		const providerKeywords = ['azure-openai', 'google-gemini', 'amazon-bedrock', 'azure-foundry']
		for (const provider of providerKeywords) {
			if (selectedModel.includes(provider) || selectedModel.includes(provider.split('-')[0])) {
				fallback = availableModels.find(model => model.provider === provider)
				if (fallback) {
					return { value: fallback.value, reason: `provider match (${provider})` }
				}
			}
		}

		// 5. Prefer non-hardcoded models
		fallback = availableModels.find(model => !model.label.includes("hardcoded"))
		if (fallback) {
			return { value: fallback.value, reason: "first non-hardcoded model" }
		}

		// 6. Last resort: use first available model
		return { value: availableModels[0].value, reason: "first available model" }
	}

	// Get hardcoded models as fallback - synchronized with backend HARDCODED_MODELS
	const getHardcodedModels = (): ModelOption[] => {
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
	}

	// Effect for automatic loading on component mount
	useEffect(() => {
		if (!hasAttemptedAutoLoad && isConfigComplete()) {
			console.log("[FlowModelSelector] Component mounted with complete config, attempting auto-load")
			setHasAttemptedAutoLoad(true)
			// Set the config hash immediately to prevent manual load from triggering
			const currentConfigHash = getConfigHash()
			setLastFetchConfig(currentConfigHash)
			fetchModels(true) // true indicates auto-load
		}
	}, [hasAttemptedAutoLoad]) // Removed fetchModels and isConfigComplete to prevent loops

	// Effect to fetch models when config changes (manual changes)
	useEffect(() => {
		// Skip if we haven't attempted auto-load yet
		if (!hasAttemptedAutoLoad) {
			return
		}

		const currentConfigHash = getConfigHash()

		// Only fetch if config is complete and has actually changed
		if (isConfigComplete() && currentConfigHash !== lastFetchConfig) {
			console.log("[FlowModelSelector] Config changed, clearing cache and fetching models manually", {
				currentHash: currentConfigHash,
				lastHash: lastFetchConfig
			})
			// Clear cache when configuration changes
			flowModelCache.clearCache()
			setIsUsingCache(false)
			setCacheInfo(null)
			fetchModels(false) // false indicates manual load
		} else if (!isConfigComplete()) {
			setModels([])
			setError(null)
			setIsUsingCache(false)
			setCacheInfo(null)
		}
	}, [flowConfig, lastFetchConfig, hasAttemptedAutoLoad]) // Removed fetchModels, getConfigHash, isConfigComplete to prevent loops

// Effect to validate model selection when models are loaded or selectedModel changes
useEffect(() => {
	validateAndApplyModelSelection()
}, [validateAndApplyModelSelection])

// Reset validation when selectedModel prop changes from parent
useEffect(() => {
	if (selectedModel) {
		console.log(`[FlowModelSelector] Selected model prop changed to: "${selectedModel}"`)
		setIsModelValidated(false)
	}
}, [selectedModel])

// Reset validation when models change (new fetch)
useEffect(() => {
	if (models.length > 0) {
		console.log(`[FlowModelSelector] Models updated, resetting validation`, {
			modelCount: models.length,
			currentSelection: selectedModel
		})
		setIsModelValidated(false)
	}
}, [models])

	// Handle model selection
	const handleModelChange = (event: any) => {
		const selectedValue = event.target.value
		console.log(`[FlowModelSelector] User selected model: "${selectedValue}"`)
		setIsUserSelection(true)
		onModelChange(selectedValue)
		setIsModelValidated(true)
	}

	// Retry fetching models (always manual)
	const handleRetry = () => {
		console.log("[FlowModelSelector] Manual retry triggered")
		fetchModels(false) // false indicates manual load
	}

	// Force refresh models (bypass cache)
	const handleRefresh = () => {
		console.log("[FlowModelSelector] Manual refresh triggered (bypassing cache)")
		fetchModels(false, true) // true indicates force refresh
	}

	return (
		<div>
			<label className="block text-sm font-medium mb-2">
				Modelo
				<span className="text-xs text-gray-500 ml-2">(Selecione o modelo a ser usado)</span>
			</label>

			<div className="relative">
				<VSCodeDropdown
					value={selectedModel || ""}
					onChange={handleModelChange}
					disabled={disabled || isLoading || !isConfigComplete()}
					style={{ width: "100%" }}
				>
					<VSCodeOption value="">Selecione um modelo...</VSCodeOption>
					{models.map((model) => (
						<VSCodeOption key={model.value} value={model.value}>
							{model.label}
						</VSCodeOption>
					))}
				</VSCodeDropdown>

				{isLoading && (
					<div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
						<VSCodeProgressRing />
						<span className="text-xs text-gray-500">
							{isUsingCache ? "(cache)" : ""}
						</span>
					</div>
				)}
			</div>

			{/* Status messages */}
			{error && (
				<div className="mt-2 text-sm text-red-600 flex items-center gap-2">
					<span>❌ {error}</span>
					{isConfigComplete() && (
						<button
							onClick={handleRetry}
							className="text-blue-600 hover:text-blue-800 underline"
							disabled={isLoading}
						>
							Tentar novamente
						</button>
					)}
				</div>
			)}

			{!isConfigComplete() && (
				<div className="mt-2 text-sm text-yellow-600">
					⚠️ Preencha os campos obrigatórios para carregar modelos.
				</div>
			)}

			{models.length > 0 && !error && (
				<div className="mt-2 space-y-1">
					<div className="text-sm text-green-600">
						✅ {models.length} modelos carregados
						{isUsingCache && cacheInfo && (
							<span className="text-blue-600"> (cache - {cacheInfo.age}min atrás)</span>
						)}
						{models.some(m => m.label.includes("hardcoded")) && " (incluindo modelos hardcoded)"}
						{selectedModel && isModelValidated && (
							<span className="text-purple-600"> - "{selectedModel}" selecionado</span>
						)}
					</div>

					{/* Cache info and refresh button */}
					<div className="flex items-center gap-2 text-xs">
						{cacheInfo && cacheInfo.expiresIn !== undefined && (
							<span className="text-gray-500">
								Cache expira em {cacheInfo.expiresIn}min
							</span>
						)}

						{isConfigComplete() && (
							<VSCodeButton
								appearance="secondary"
								onClick={handleRefresh}
								disabled={isLoading}
								style={{ fontSize: '11px', padding: '2px 8px' }}
							>
								🔄 Atualizar Modelos
							</VSCodeButton>
						)}
					</div>
				</div>
			)}

			{/* Help text */}
			<div className="mt-2 text-xs text-gray-500">
				Os modelos são agrupados por provider. Modelos hardcoded são incluídos como fallback.
			</div>
		</div>
	)
}
