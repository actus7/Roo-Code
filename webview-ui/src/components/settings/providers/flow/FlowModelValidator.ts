/**
 * FlowModelValidator - Model Validation and Mapping Utility
 * 
 * This utility provides methods for validating model selections,
 * mapping Anthropic models to Flow equivalents, and finding fallback models.
 */

export interface ModelOption {
	value: string
	label: string
	provider: string
}

export interface ValidationResult {
	isValid: boolean
	shouldUpdate: boolean
	newModelId?: string
	reason?: string
}

export interface FallbackResult {
	value: string
	reason: string
}

/**
 * FlowModelValidator class for model validation and mapping
 */
export class FlowModelValidator {
	/**
	 * Invalid Anthropic model IDs that shouldn't be in Flow context
	 */
	private static readonly INVALID_ANTHROPIC_MODELS = [
		"claude-sonnet-4-20250514",
		"claude-opus-4-20250514",
		"claude-3-7-sonnet-20250219",
		"claude-3-5-sonnet-20241022",
		"claude-3-5-haiku-20241022",
		"claude-3-opus-20240229",
		"claude-3-haiku-20240307"
	]

	/**
	 * Mapping from Anthropic model IDs to Flow model IDs
	 */
	private static readonly ANTHROPIC_MAPPINGS: Record<string, string> = {
		"claude-sonnet-4-20250514": "anthropic.claude-37-sonnet",
		"claude-opus-4-20250514": "anthropic.claude-37-sonnet", // Fallback to sonnet
		"claude-3-7-sonnet-20250219": "anthropic.claude-37-sonnet",
		"claude-3-5-sonnet-20241022": "anthropic.claude-3-sonnet",
		"claude-3-5-haiku-20241022": "anthropic.claude-3-sonnet", // Fallback to sonnet
		"claude-3-opus-20240229": "anthropic.claude-3-sonnet",
		"claude-3-haiku-20240307": "anthropic.claude-3-sonnet"
	}

	/**
	 * Provider keywords for matching
	 */
	private static readonly PROVIDER_KEYWORDS = [
		'azure-openai', 
		'google-gemini', 
		'amazon-bedrock', 
		'azure-foundry'
	]

	/**
	 * Validate model selection and determine if update is needed
	 */
	static validateModelSelection(
		selectedModel: string,
		availableModels: ModelOption[],
		isUserSelection: boolean = false
	): ValidationResult {
		if (!selectedModel || availableModels.length === 0) {
			return { isValid: false, shouldUpdate: false }
		}

		console.log(`[FlowModelValidator] Validating model selection`, {
			selectedModel,
			availableModels: availableModels.length,
			modelValues: availableModels.map(m => m.value),
			isUserSelection
		})

		// First, check if the selected model exists in the available models
		const modelExists = availableModels.some(model => model.value === selectedModel)

		// If model exists, it's valid
		if (modelExists) {
			console.log(`[FlowModelValidator] Selected model "${selectedModel}" is valid and available`)
			return { isValid: true, shouldUpdate: false }
		}

		// Check for invalid Anthropic default model IDs that shouldn't be in Flow context
		if (this.INVALID_ANTHROPIC_MODELS.includes(selectedModel) && !isUserSelection) {
			console.warn(`[FlowModelValidator] Invalid Anthropic model ID "${selectedModel}" detected in Flow context. This suggests a configuration mismatch.`)

			// Try to find a corresponding Flow model
			const flowAnthropicModel = availableModels.find(model =>
				model.provider === "amazon-bedrock" &&
				model.value.includes("anthropic.claude") &&
				!model.label.includes("hardcoded")
			)

			if (flowAnthropicModel) {
				console.log(`[FlowModelValidator] Mapping invalid Anthropic model to Flow equivalent: "${flowAnthropicModel.value}"`)
				return {
					isValid: false,
					shouldUpdate: true,
					newModelId: flowAnthropicModel.value,
					reason: `Mapped invalid Anthropic model to Flow equivalent`
				}
			}
		}

		// Model not found and not in invalid list - try fallback only if not a user selection
		if (!isUserSelection) {
			console.warn(`[FlowModelValidator] Selected model "${selectedModel}" not found in available models`, {
				availableModels: availableModels.map(m => ({ value: m.value, label: m.label }))
			})

			// Try to find a similar model or use a smart fallback
			const fallbackModel = this.findBestFallbackModel(selectedModel, availableModels)

			if (fallbackModel) {
				console.log(`[FlowModelValidator] Using fallback model: "${fallbackModel.value}" (reason: ${fallbackModel.reason})`)
				return {
					isValid: false,
					shouldUpdate: true,
					newModelId: fallbackModel.value,
					reason: fallbackModel.reason
				}
			}
		} else {
			// If it's a user selection but model doesn't exist, respect user choice
			console.log(`[FlowModelValidator] User selected model "${selectedModel}" not found, but respecting user choice`)
			return { isValid: true, shouldUpdate: false }
		}

		return { isValid: false, shouldUpdate: false }
	}

	/**
	 * Find the best fallback model when the selected model is not available
	 */
	static findBestFallbackModel(selectedModel: string, availableModels: ModelOption[]): FallbackResult | null {
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
			const mappedModel = this.ANTHROPIC_MAPPINGS[selectedModel]
			if (mappedModel) {
				fallback = availableModels.find(model => model.value === mappedModel)
				if (fallback) {
					return { 
						value: fallback.value, 
						reason: `Anthropic model mapping (${selectedModel} → ${mappedModel})` 
					}
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

		// 3. Try to match by model family (e.g., "gpt" from "gpt-4o")
		const modelFamily = selectedModel.split('-')[0]
		fallback = availableModels.find(model => model.value.startsWith(modelFamily))
		if (fallback) {
			return { value: fallback.value, reason: "model family match" }
		}

		// 4. Try to match by provider (look for same provider in model label)
		for (const provider of this.PROVIDER_KEYWORDS) {
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

	/**
	 * Map Anthropic model ID to Flow equivalent
	 */
	static mapAnthropicModel(anthropicModelId: string): string | null {
		return this.ANTHROPIC_MAPPINGS[anthropicModelId] || null
	}

	/**
	 * Check if model ID is an invalid Anthropic model
	 */
	static isInvalidAnthropicModel(modelId: string): boolean {
		return this.INVALID_ANTHROPIC_MODELS.includes(modelId)
	}

	/**
	 * Get all available providers from model list
	 */
	static getAvailableProviders(models: ModelOption[]): string[] {
		return Array.from(new Set(models.map(model => model.provider)))
	}

	/**
	 * Filter models by provider
	 */
	static filterModelsByProvider(models: ModelOption[], provider: string): ModelOption[] {
		return models.filter(model => model.provider === provider)
	}

	/**
	 * Filter out hardcoded models
	 */
	static filterNonHardcodedModels(models: ModelOption[]): ModelOption[] {
		return models.filter(model => !model.label.includes("hardcoded"))
	}

	/**
	 * Get model by value
	 */
	static findModelByValue(models: ModelOption[], value: string): ModelOption | null {
		return models.find(model => model.value === value) || null
	}

	/**
	 * Check if model supports a specific capability (based on label)
	 */
	static modelSupportsCapability(model: ModelOption, capability: string): boolean {
		return model.label.toLowerCase().includes(capability.toLowerCase())
	}

	/**
	 * Get models that support embedding
	 */
	static getEmbeddingModels(models: ModelOption[]): ModelOption[] {
		return models.filter(model => 
			model.value.includes("embedding") || 
			model.label.toLowerCase().includes("embedding")
		)
	}

	/**
	 * Get chat models (non-embedding models)
	 */
	static getChatModels(models: ModelOption[]): ModelOption[] {
		return models.filter(model => 
			!model.value.includes("embedding") && 
			!model.label.toLowerCase().includes("embedding")
		)
	}

	/**
	 * Sort models by preference (non-hardcoded first, then by provider)
	 */
	static sortModelsByPreference(models: ModelOption[]): ModelOption[] {
		return [...models].sort((a, b) => {
			// Non-hardcoded models first
			const aHardcoded = a.label.includes("hardcoded")
			const bHardcoded = b.label.includes("hardcoded")
			
			if (aHardcoded !== bHardcoded) {
				return aHardcoded ? 1 : -1
			}

			// Then sort by provider
			if (a.provider !== b.provider) {
				return a.provider.localeCompare(b.provider)
			}

			// Finally sort by value
			return a.value.localeCompare(b.value)
		})
	}

	/**
	 * Get validation summary for debugging
	 */
	static getValidationSummary(
		selectedModel: string,
		availableModels: ModelOption[],
		isUserSelection: boolean = false
	): Record<string, any> {
		const validation = this.validateModelSelection(selectedModel, availableModels, isUserSelection)
		const fallback = validation.shouldUpdate ? null : this.findBestFallbackModel(selectedModel, availableModels)
		
		return {
			selectedModel,
			modelExists: availableModels.some(m => m.value === selectedModel),
			isInvalidAnthropic: this.isInvalidAnthropicModel(selectedModel),
			anthropicMapping: this.mapAnthropicModel(selectedModel),
			validation,
			fallback,
			availableProviders: this.getAvailableProviders(availableModels),
			totalModels: availableModels.length,
			nonHardcodedModels: this.filterNonHardcodedModels(availableModels).length
		}
	}
}
