/**
 * FlowConfigValidator Tests
 *
 * Tests for the FlowConfigValidator utility class and hook
 */

import { FlowConfigValidator, useFlowConfigValidator, type FlowConfig } from '../FlowConfigValidator'
import { renderHook } from '@testing-library/react'

// Test configurations available to all test suites
const validConfig: FlowConfig = {
	flowBaseUrl: 'https://flow.ciandt.com',
	flowTenant: 'test-tenant',
	flowClientId: 'test-client-id',
	flowClientSecret: 'test-client-secret',
	flowAuthBaseUrl: 'https://auth.flow.ciandt.com',
	flowAppToAccess: 'llm-api'
}

const incompleteConfig: FlowConfig = {
	flowTenant: 'test-tenant',
	flowClientId: 'test-client-id'
	// Missing flowClientSecret
}

describe('FlowConfigValidator', () => {

	describe('isConfigComplete', () => {
		it('should return true for complete configuration', () => {
			expect(FlowConfigValidator.isConfigComplete(validConfig)).toBe(true)
		})

		it('should return false for incomplete configuration', () => {
			expect(FlowConfigValidator.isConfigComplete(incompleteConfig)).toBe(false)
		})

		it('should return false when tenant is missing', () => {
			const config = { ...validConfig, flowTenant: undefined }
			expect(FlowConfigValidator.isConfigComplete(config)).toBe(false)
		})

		it('should return false when clientId is missing', () => {
			const config = { ...validConfig, flowClientId: undefined }
			expect(FlowConfigValidator.isConfigComplete(config)).toBe(false)
		})

		it('should return false when clientSecret is missing', () => {
			const config = { ...validConfig, flowClientSecret: undefined }
			expect(FlowConfigValidator.isConfigComplete(config)).toBe(false)
		})

		it('should return true when only optional fields are missing', () => {
			const config = {
				flowTenant: 'test-tenant',
				flowClientId: 'test-client-id',
				flowClientSecret: 'test-client-secret'
			}
			expect(FlowConfigValidator.isConfigComplete(config)).toBe(true)
		})
	})

	describe('getConfigHash', () => {
		it('should generate consistent hash for same configuration', () => {
			const hash1 = FlowConfigValidator.getConfigHash(validConfig)
			const hash2 = FlowConfigValidator.getConfigHash(validConfig)
			expect(hash1).toBe(hash2)
		})

		it('should generate different hash for different configurations', () => {
			const config1 = { ...validConfig, flowTenant: 'tenant1' }
			const config2 = { ...validConfig, flowTenant: 'tenant2' }
			const hash1 = FlowConfigValidator.getConfigHash(config1)
			const hash2 = FlowConfigValidator.getConfigHash(config2)
			expect(hash1).not.toBe(hash2)
		})

		it('should not include secret in hash but include hasSecret flag', () => {
			const configWithSecret = { ...validConfig, flowClientSecret: 'secret123' }
			const configWithoutSecret = { ...validConfig, flowClientSecret: undefined }

			const hash1 = FlowConfigValidator.getConfigHash(configWithSecret)
			const hash2 = FlowConfigValidator.getConfigHash(configWithoutSecret)

			expect(hash1).not.toBe(hash2)
			expect(hash1).not.toContain('secret123')
		})
	})

	describe('validateConfig', () => {
		it('should return valid for complete configuration', () => {
			const result = FlowConfigValidator.validateConfig(validConfig)
			expect(result.isValid).toBe(true)
			expect(result.missingFields).toHaveLength(0)
		})

		it('should return invalid for incomplete configuration', () => {
			const result = FlowConfigValidator.validateConfig(incompleteConfig)
			expect(result.isValid).toBe(false)
			expect(result.missingFields).toContain('flowClientSecret')
		})

		it('should identify all missing required fields', () => {
			const emptyConfig: FlowConfig = {}
			const result = FlowConfigValidator.validateConfig(emptyConfig)
			expect(result.isValid).toBe(false)
			expect(result.missingFields).toContain('flowTenant')
			expect(result.missingFields).toContain('flowClientId')
			expect(result.missingFields).toContain('flowClientSecret')
		})

		it('should include warnings for missing optional fields', () => {
			const minimalConfig: FlowConfig = {
				flowTenant: 'test-tenant',
				flowClientId: 'test-client-id',
				flowClientSecret: 'test-client-secret'
			}
			const result = FlowConfigValidator.validateConfig(minimalConfig)
			expect(result.isValid).toBe(true)
			expect(result.warnings.length).toBeGreaterThan(0)
		})
	})

	describe('getMissingFieldsMessage', () => {
		it('should return null for complete configuration', () => {
			const message = FlowConfigValidator.getMissingFieldsMessage(validConfig)
			expect(message).toBeNull()
		})

		it('should return appropriate message for single missing field', () => {
			const config = { ...validConfig, flowClientSecret: undefined }
			const message = FlowConfigValidator.getMissingFieldsMessage(config)
			expect(message).toContain('Client Secret')
		})

		it('should return appropriate message for multiple missing fields', () => {
			const config = { flowTenant: 'test-tenant' }
			const message = FlowConfigValidator.getMissingFieldsMessage(config)
			expect(message).toContain('Client ID')
			expect(message).toContain('Client Secret')
		})
	})

	describe('normalizeConfig', () => {
		it('should add default values for missing optional fields', () => {
			const minimalConfig: FlowConfig = {
				flowTenant: 'test-tenant',
				flowClientId: 'test-client-id',
				flowClientSecret: 'test-client-secret'
			}
			const normalized = FlowConfigValidator.normalizeConfig(minimalConfig)
			expect(normalized.flowBaseUrl).toBe('https://flow.ciandt.com')
			expect(normalized.flowAppToAccess).toBe('llm-api')
		})

		it('should preserve existing values', () => {
			const normalized = FlowConfigValidator.normalizeConfig(validConfig)
			expect(normalized.flowBaseUrl).toBe(validConfig.flowBaseUrl)
			expect(normalized.flowTenant).toBe(validConfig.flowTenant)
		})

		it('should use flowBaseUrl as fallback for flowAuthBaseUrl', () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://custom.flow.com',
				flowTenant: 'test-tenant',
				flowClientId: 'test-client-id',
				flowClientSecret: 'test-client-secret'
			}
			const normalized = FlowConfigValidator.normalizeConfig(config)
			expect(normalized.flowAuthBaseUrl).toBe('https://custom.flow.com')
		})
	})

	describe('areConfigsEqual', () => {
		it('should return true for identical configurations', () => {
			const config1 = { ...validConfig }
			const config2 = { ...validConfig }
			expect(FlowConfigValidator.areConfigsEqual(config1, config2)).toBe(true)
		})

		it('should return false for different configurations', () => {
			const config1 = { ...validConfig, flowTenant: 'tenant1' }
			const config2 = { ...validConfig, flowTenant: 'tenant2' }
			expect(FlowConfigValidator.areConfigsEqual(config1, config2)).toBe(false)
		})
	})

	describe('validateUrls', () => {
		it('should return valid for valid URLs', () => {
			const result = FlowConfigValidator.validateUrls(validConfig)
			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should return invalid for malformed URLs', () => {
			const config = { ...validConfig, flowBaseUrl: 'not-a-url' }
			const result = FlowConfigValidator.validateUrls(config)
			expect(result.valid).toBe(false)
			expect(result.errors).toContain('flowBaseUrl is not a valid URL')
		})

		it('should handle undefined URLs gracefully', () => {
			const config: FlowConfig = {
				flowTenant: 'test-tenant',
				flowClientId: 'test-client-id',
				flowClientSecret: 'test-client-secret'
			}
			const result = FlowConfigValidator.validateUrls(config)
			expect(result.valid).toBe(true)
		})
	})

	describe('sanitizeConfigForLogging', () => {
		it('should mask sensitive information', () => {
			const sanitized = FlowConfigValidator.sanitizeConfigForLogging(validConfig)
			expect(sanitized.clientId).toContain('...')
			expect(sanitized.hasSecret).toBe(true)
			expect(sanitized).not.toHaveProperty('flowClientSecret')
		})

		it('should preserve non-sensitive information', () => {
			const sanitized = FlowConfigValidator.sanitizeConfigForLogging(validConfig)
			expect(sanitized.tenant).toBe(validConfig.flowTenant)
			expect(sanitized.baseUrl).toBe(validConfig.flowBaseUrl)
		})
	})
})

describe('useFlowConfigValidator hook', () => {
	it('should return validation results', () => {
		const { result } = renderHook(() => useFlowConfigValidator(validConfig))

		expect(result.current.isComplete).toBe(true)
		expect(result.current.validation.isValid).toBe(true)
		expect(result.current.missingFieldsMessage).toBeNull()
		expect(result.current.configHash).toBeDefined()
		expect(result.current.normalizedConfig).toBeDefined()
		expect(result.current.urlValidation.valid).toBe(true)
	})

	it('should handle incomplete configuration', () => {
		const { result } = renderHook(() => useFlowConfigValidator(incompleteConfig))

		expect(result.current.isComplete).toBe(false)
		expect(result.current.validation.isValid).toBe(false)
		expect(result.current.missingFieldsMessage).toBeDefined()
	})

	it('should provide sanitized config', () => {
		const { result } = renderHook(() => useFlowConfigValidator(validConfig))

		expect(result.current.sanitizedConfig).toBeDefined()
		expect(result.current.sanitizedConfig.hasSecret).toBe(true)
		expect(result.current.sanitizedConfig).not.toHaveProperty('flowClientSecret')
	})

	it('should provide config summary', () => {
		const { result } = renderHook(() => useFlowConfigValidator(validConfig))

		expect(result.current.configSummary).toBeDefined()
		expect(result.current.configSummary.isComplete).toBe(true)
		expect(result.current.configSummary.configHash).toBeDefined()
	})
})
