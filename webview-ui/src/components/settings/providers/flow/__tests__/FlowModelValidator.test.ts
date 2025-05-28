/**
 * FlowModelValidator Tests
 *
 * Tests for the FlowModelValidator utility class
 */

import { FlowModelValidator, type ModelOption } from '../FlowModelValidator'

describe('FlowModelValidator', () => {
	const mockModels: ModelOption[] = [
		{
			value: 'gpt-4o',
			label: 'azure-openai - gpt-4o (Context: 128,000 tokens)',
			provider: 'azure-openai'
		},
		{
			value: 'gpt-4o-mini',
			label: 'azure-openai - gpt-4o-mini (Context: 128,000 tokens)',
			provider: 'azure-openai'
		},
		{
			value: 'anthropic.claude-3-sonnet',
			label: 'amazon-bedrock - anthropic.claude-3-sonnet (Context: 200,000 tokens)',
			provider: 'amazon-bedrock'
		},
		{
			value: 'anthropic.claude-37-sonnet',
			label: 'amazon-bedrock - anthropic.claude-37-sonnet (Context: 200,000 tokens)',
			provider: 'amazon-bedrock'
		},
		{
			value: 'gemini-2.0-flash',
			label: 'google-gemini - gemini-2.0-flash (Context: 8,192 tokens)',
			provider: 'google-gemini'
		},
		{
			value: 'text-embedding-ada-002',
			label: 'azure-openai - text-embedding-ada-002 (hardcoded)',
			provider: 'azure-openai'
		}
	]

	describe('validateModelSelection', () => {
		it('should return valid for existing model', () => {
			const result = FlowModelValidator.validateModelSelection('gpt-4o', mockModels, false)
			expect(result.isValid).toBe(true)
			expect(result.shouldUpdate).toBe(false)
		})

		it('should return invalid for non-existing model', () => {
			const result = FlowModelValidator.validateModelSelection('non-existing-model', mockModels, false)
			expect(result.isValid).toBe(false)
		})

		it('should suggest update for invalid Anthropic model', () => {
			const result = FlowModelValidator.validateModelSelection('claude-3-5-sonnet-20241022', mockModels, false)
			expect(result.isValid).toBe(false)
			expect(result.shouldUpdate).toBe(true)
			expect(result.newModelId).toBe('anthropic.claude-3-sonnet')
		})

		it('should respect user selection even if model does not exist', () => {
			const result = FlowModelValidator.validateModelSelection('user-custom-model', mockModels, true)
			expect(result.isValid).toBe(true)
			expect(result.shouldUpdate).toBe(false)
		})

		it('should not update invalid Anthropic model if user selection', () => {
			const result = FlowModelValidator.validateModelSelection('claude-3-5-sonnet-20241022', mockModels, true)
			expect(result.isValid).toBe(true)
			expect(result.shouldUpdate).toBe(false)
		})

		it('should handle empty model list', () => {
			const result = FlowModelValidator.validateModelSelection('any-model', [], false)
			expect(result.isValid).toBe(false)
			expect(result.shouldUpdate).toBe(false)
		})

		it('should handle empty selected model', () => {
			const result = FlowModelValidator.validateModelSelection('', mockModels, false)
			expect(result.isValid).toBe(false)
			expect(result.shouldUpdate).toBe(false)
		})
	})

	describe('findBestFallbackModel', () => {
		it('should find partial match', () => {
			const result = FlowModelValidator.findBestFallbackModel('gpt-4', mockModels)
			expect(result).toBeDefined()
			expect(result?.value).toBe('gpt-4o')
			expect(result?.reason).toBe('partial match')
		})

		it('should map Anthropic models to Flow equivalents', () => {
			const result = FlowModelValidator.findBestFallbackModel('claude-3-5-sonnet-20241022', mockModels)
			expect(result).toBeDefined()
			expect(result?.value).toBe('anthropic.claude-3-sonnet')
			expect(result?.reason).toContain('Anthropic model mapping')
		})

		it('should find Claude family match', () => {
			const result = FlowModelValidator.findBestFallbackModel('claude-unknown', mockModels)
			expect(result).toBeDefined()
			expect(result?.value).toBe('anthropic.claude-3-sonnet')
			expect(result?.reason).toBe('Claude model family match')
		})

		it('should find model family match', () => {
			const result = FlowModelValidator.findBestFallbackModel('gpt-unknown', mockModels)
			expect(result).toBeDefined()
			expect(result?.value).toBe('gpt-4o')
			expect(result?.reason).toBe('model family match')
		})

		it('should prefer non-hardcoded models', () => {
			const result = FlowModelValidator.findBestFallbackModel('unknown-model', mockModels)
			expect(result).toBeDefined()
			expect(result?.value).not.toBe('text-embedding-ada-002') // hardcoded model
			expect(result?.reason).toBe('first non-hardcoded model')
		})

		it('should return first available model as last resort', () => {
			const hardcodedOnlyModels: ModelOption[] = [
				{
					value: 'text-embedding-ada-002',
					label: 'azure-openai - text-embedding-ada-002 (hardcoded)',
					provider: 'azure-openai'
				}
			]
			const result = FlowModelValidator.findBestFallbackModel('unknown-model', hardcodedOnlyModels)
			expect(result).toBeDefined()
			expect(result?.value).toBe('text-embedding-ada-002')
			expect(result?.reason).toBe('first available model')
		})

		it('should return null for empty model list', () => {
			const result = FlowModelValidator.findBestFallbackModel('any-model', [])
			expect(result).toBeNull()
		})
	})

	describe('mapAnthropicModel', () => {
		it('should map known Anthropic models', () => {
			const result = FlowModelValidator.mapAnthropicModel('claude-3-5-sonnet-20241022')
			expect(result).toBe('anthropic.claude-3-sonnet')
		})

		it('should return null for unknown models', () => {
			const result = FlowModelValidator.mapAnthropicModel('unknown-model')
			expect(result).toBeNull()
		})
	})

	describe('isInvalidAnthropicModel', () => {
		it('should identify invalid Anthropic models', () => {
			expect(FlowModelValidator.isInvalidAnthropicModel('claude-3-5-sonnet-20241022')).toBe(true)
			expect(FlowModelValidator.isInvalidAnthropicModel('claude-3-opus-20240229')).toBe(true)
		})

		it('should not flag valid models as invalid', () => {
			expect(FlowModelValidator.isInvalidAnthropicModel('gpt-4o')).toBe(false)
			expect(FlowModelValidator.isInvalidAnthropicModel('anthropic.claude-3-sonnet')).toBe(false)
		})
	})

	describe('getAvailableProviders', () => {
		it('should return unique providers', () => {
			const providers = FlowModelValidator.getAvailableProviders(mockModels)
			expect(providers).toContain('azure-openai')
			expect(providers).toContain('amazon-bedrock')
			expect(providers).toContain('google-gemini')
			expect(providers.length).toBe(3)
		})

		it('should handle empty model list', () => {
			const providers = FlowModelValidator.getAvailableProviders([])
			expect(providers).toHaveLength(0)
		})
	})

	describe('filterModelsByProvider', () => {
		it('should filter models by provider', () => {
			const azureModels = FlowModelValidator.filterModelsByProvider(mockModels, 'azure-openai')
			expect(azureModels).toHaveLength(3) // gpt-4o, gpt-4o-mini, text-embedding-ada-002
			expect(azureModels.every(m => m.provider === 'azure-openai')).toBe(true)
		})

		it('should return empty array for non-existing provider', () => {
			const models = FlowModelValidator.filterModelsByProvider(mockModels, 'non-existing')
			expect(models).toHaveLength(0)
		})
	})

	describe('filterNonHardcodedModels', () => {
		it('should filter out hardcoded models', () => {
			const nonHardcoded = FlowModelValidator.filterNonHardcodedModels(mockModels)
			expect(nonHardcoded.every(m => !m.label.includes('hardcoded'))).toBe(true)
			expect(nonHardcoded).toHaveLength(5) // All except text-embedding-ada-002
		})
	})

	describe('findModelByValue', () => {
		it('should find model by value', () => {
			const model = FlowModelValidator.findModelByValue(mockModels, 'gpt-4o')
			expect(model).toBeDefined()
			expect(model?.value).toBe('gpt-4o')
		})

		it('should return null for non-existing value', () => {
			const model = FlowModelValidator.findModelByValue(mockModels, 'non-existing')
			expect(model).toBeNull()
		})
	})

	describe('getEmbeddingModels', () => {
		it('should return embedding models', () => {
			const embeddingModels = FlowModelValidator.getEmbeddingModels(mockModels)
			expect(embeddingModels).toHaveLength(1)
			expect(embeddingModels[0].value).toBe('text-embedding-ada-002')
		})
	})

	describe('getChatModels', () => {
		it('should return non-embedding models', () => {
			const chatModels = FlowModelValidator.getChatModels(mockModels)
			expect(chatModels).toHaveLength(5) // All except embedding model
			expect(chatModels.every(m => !m.value.includes('embedding'))).toBe(true)
		})
	})

	describe('sortModelsByPreference', () => {
		it('should sort non-hardcoded models first', () => {
			const sorted = FlowModelValidator.sortModelsByPreference(mockModels)
			const hardcodedIndex = sorted.findIndex(m => m.label.includes('hardcoded'))
			const nonHardcodedCount = sorted.filter(m => !m.label.includes('hardcoded')).length

			expect(hardcodedIndex).toBeGreaterThanOrEqual(nonHardcodedCount)
		})

		it('should maintain original array', () => {
			const originalLength = mockModels.length
			FlowModelValidator.sortModelsByPreference(mockModels)
			expect(mockModels).toHaveLength(originalLength)
		})
	})

	describe('getValidationSummary', () => {
		it('should provide comprehensive validation summary', () => {
			const summary = FlowModelValidator.getValidationSummary('gpt-4o', mockModels, false)

			expect(summary.selectedModel).toBe('gpt-4o')
			expect(summary.modelExists).toBe(true)
			expect(summary.isInvalidAnthropic).toBe(false)
			expect(summary.validation.isValid).toBe(true)
			expect(summary.availableProviders).toContain('azure-openai')
			expect(summary.totalModels).toBe(mockModels.length)
		})

		it('should handle invalid Anthropic model in summary', () => {
			const summary = FlowModelValidator.getValidationSummary('claude-3-5-sonnet-20241022', mockModels, false)

			expect(summary.isInvalidAnthropic).toBe(true)
			expect(summary.anthropicMapping).toBe('anthropic.claude-3-sonnet')
			expect(summary.validation.shouldUpdate).toBe(true)
		})

		it('should provide fallback information when validation fails', () => {
			const summary = FlowModelValidator.getValidationSummary('unknown-model', mockModels, false)

			expect(summary.modelExists).toBe(false)
			expect(summary.validation.isValid).toBe(false)
			expect(summary.fallback).toBeDefined()
			expect(summary.fallback?.value).toBeDefined()
			expect(summary.fallback?.reason).toBeDefined()
		})
	})
})
