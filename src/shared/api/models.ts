import type { ModelInfo } from "../../shared/api"

/**
 * Flow models with their capabilities and context sizes
 */
export const flowModels: Record<string, ModelInfo> = {
	"gpt-4o": {
		contextWindow: 128000,
		maxTokens: 4096,
		supportsPromptCache: true,
		maxThinkingTokens: 1024,
		supportsImages: true,
		supportsComputerUse: false,
		inputPrice: 0.03,
		outputPrice: 0.06,
		cacheReadsPrice: 0.01,
		cacheWritesPrice: 0.04,
		description: "GPT-4o model through Flow AI Orchestration",
	},
	"gpt-4o-mini": {
		contextWindow: 128000,
		maxTokens: 4096,
		supportsPromptCache: true,
		maxThinkingTokens: 1024,
		supportsImages: true,
		supportsComputerUse: false,
		inputPrice: 0.015,
		outputPrice: 0.03,
		cacheReadsPrice: 0.005,
		cacheWritesPrice: 0.02,
		description: "GPT-4o Mini model through Flow AI Orchestration",
	},
	"gpt-4": {
		contextWindow: 8192,
		maxTokens: 4096,
		supportsPromptCache: true,
		maxThinkingTokens: 1024,
		supportsImages: false,
		supportsComputerUse: false,
		inputPrice: 0.03,
		outputPrice: 0.06,
		cacheReadsPrice: 0.01,
		cacheWritesPrice: 0.04,
		description: "GPT-4 model through Flow AI Orchestration",
	},
	"gpt-3.5-turbo": {
		contextWindow: 4096,
		maxTokens: 2048,
		supportsPromptCache: true,
		maxThinkingTokens: 512,
		supportsImages: false,
		supportsComputerUse: false,
		inputPrice: 0.0015,
		outputPrice: 0.002,
		cacheReadsPrice: 0.0005,
		cacheWritesPrice: 0.001,
		description: "GPT-3.5 Turbo model through Flow AI Orchestration",
	},
}
