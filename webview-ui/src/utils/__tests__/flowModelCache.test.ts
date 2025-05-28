/**
 * Tests for FlowModelCache utility
 */

import { FlowModelCache } from '../flowModelCache'

// Mock localStorage
const mockLocalStorage = {
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn()
}

Object.defineProperty(window, 'localStorage', {
	value: mockLocalStorage
})

describe('FlowModelCache', () => {
	let cache: FlowModelCache

	beforeEach(() => {
		jest.clearAllMocks()
		cache = new FlowModelCache()
	})

	const mockConfig = {
		flowTenant: 'test-tenant',
		flowClientId: 'test-client-id',
		flowBaseUrl: 'https://test.flow.com'
	}

	const mockModels = [
		{ value: 'model-1', label: 'Model 1', provider: 'azure-openai' },
		{ value: 'model-2', label: 'Model 2', provider: 'google-gemini' }
	]

	describe('getCachedModels', () => {
		it('should return null when no cache exists', () => {
			mockLocalStorage.getItem.mockReturnValue(null)

			const result = cache.getCachedModels(mockConfig)

			expect(result).toBeNull()
			expect(mockLocalStorage.getItem).toHaveBeenCalledWith('flow-models-cache')
		})

		it('should return null when cache is expired', () => {
			const expiredCache = {
				models: mockModels,
				timestamp: Date.now() - (70 * 60 * 1000), // 70 minutes ago
				ttl: 60 * 60 * 1000, // 60 minutes TTL
				configHash: JSON.stringify({
					tenant: mockConfig.flowTenant,
					clientId: mockConfig.flowClientId,
					baseUrl: mockConfig.flowBaseUrl
				})
			}

			mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredCache))

			const result = cache.getCachedModels(mockConfig)

			expect(result).toBeNull()
			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('flow-models-cache')
		})

		it('should return cached models when valid', () => {
			const validCache = {
				models: mockModels,
				timestamp: Date.now() - (30 * 60 * 1000), // 30 minutes ago
				ttl: 60 * 60 * 1000, // 60 minutes TTL
				configHash: JSON.stringify({
					tenant: mockConfig.flowTenant,
					clientId: mockConfig.flowClientId,
					baseUrl: mockConfig.flowBaseUrl
				})
			}

			mockLocalStorage.getItem.mockReturnValue(JSON.stringify(validCache))

			const result = cache.getCachedModels(mockConfig)

			expect(result).toEqual(mockModels)
		})

		it('should return null when config hash does not match', () => {
			const cacheWithDifferentConfig = {
				models: mockModels,
				timestamp: Date.now() - (30 * 60 * 1000),
				ttl: 60 * 60 * 1000,
				configHash: JSON.stringify({
					tenant: 'different-tenant',
					clientId: mockConfig.flowClientId,
					baseUrl: mockConfig.flowBaseUrl
				})
			}

			mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheWithDifferentConfig))

			const result = cache.getCachedModels(mockConfig)

			expect(result).toBeNull()
			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('flow-models-cache')
		})
	})

	describe('cacheModels', () => {
		it('should cache models with correct structure', () => {
			const beforeTime = Date.now()

			cache.cacheModels(mockModels, mockConfig)

			expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
				'flow-models-cache',
				expect.stringContaining('"models"')
			)

			const setItemCall = mockLocalStorage.setItem.mock.calls[0]
			const cachedData = JSON.parse(setItemCall[1])

			expect(cachedData.models).toEqual(mockModels)
			expect(cachedData.timestamp).toBeGreaterThanOrEqual(beforeTime)
			expect(cachedData.ttl).toBe(60 * 60 * 1000) // 60 minutes
			expect(cachedData.configHash).toBe(JSON.stringify({
				tenant: mockConfig.flowTenant,
				clientId: mockConfig.flowClientId,
				baseUrl: mockConfig.flowBaseUrl
			}))
		})
	})

	describe('clearCache', () => {
		it('should remove cache from localStorage', () => {
			cache.clearCache()

			expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('flow-models-cache')
		})
	})

	describe('getCacheInfo', () => {
		it('should return hasCache false when no cache exists', () => {
			mockLocalStorage.getItem.mockReturnValue(null)

			const info = cache.getCacheInfo()

			expect(info).toEqual({ hasCache: false })
		})

		it('should return cache info when cache exists', () => {
			const cacheData = {
				models: mockModels,
				timestamp: Date.now() - (30 * 60 * 1000), // 30 minutes ago
				ttl: 60 * 60 * 1000, // 60 minutes TTL
				configHash: 'test-hash'
			}

			mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheData))

			const info = cache.getCacheInfo()

			expect(info.hasCache).toBe(true)
			expect(info.age).toBe(30) // 30 minutes
			expect(info.modelCount).toBe(2)
			expect(info.expiresIn).toBe(30) // 30 minutes remaining
			expect(info.configHash).toBe('test-hash')
		})
	})

	describe('configuration', () => {
		it('should respect disabled cache', () => {
			// Clear previous calls
			jest.clearAllMocks()

			const disabledCache = new FlowModelCache({ enabled: false })

			const result = disabledCache.getCachedModels(mockConfig)

			expect(result).toBeNull()
			expect(mockLocalStorage.getItem).not.toHaveBeenCalled()
		})

		it('should use custom TTL', () => {
			const customCache = new FlowModelCache({ ttlMinutes: 120 })

			customCache.cacheModels(mockModels, mockConfig)

			const setItemCall = mockLocalStorage.setItem.mock.calls[0]
			const cachedData = JSON.parse(setItemCall[1])

			expect(cachedData.ttl).toBe(120 * 60 * 1000) // 120 minutes
		})
	})
})
