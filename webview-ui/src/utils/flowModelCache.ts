/**
 * Flow Model Cache Utility
 * Provides intelligent caching for Flow models to optimize performance
 */

interface ModelOption {
	value: string
	label: string
	provider: string
}

interface CacheEntry {
	models: ModelOption[]
	timestamp: number
	ttl: number
	configHash: string
}

interface CacheConfig {
	ttlMinutes: number
	enabled: boolean
	storageType: 'localStorage' | 'sessionStorage'
}

const DEFAULT_CONFIG: CacheConfig = {
	ttlMinutes: 60, // 60 minutes default TTL
	enabled: true,
	storageType: 'localStorage'
}

export class FlowModelCache {
	private config: CacheConfig
	private storage: Storage
	private cacheKey = 'flow-models-cache'

	constructor(config: Partial<CacheConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.storage = this.config.storageType === 'localStorage' ? localStorage : sessionStorage

		// Clean old cache entries on initialization (only if enabled)
		if (this.config.enabled) {
			this.cleanOldEntries()
		}
	}

	/**
	 * Generate cache key based on configuration
	 */
	private generateConfigHash(flowConfig: {
		flowTenant?: string
		flowClientId?: string
		flowBaseUrl?: string
	}): string {
		const { flowTenant, flowClientId, flowBaseUrl } = flowConfig
		const baseUrl = flowBaseUrl || "https://flow.ciandt.com"

		return JSON.stringify({
			tenant: flowTenant,
			clientId: flowClientId,
			baseUrl
		})
	}

	/**
	 * Check if cache is enabled
	 */
	isEnabled(): boolean {
		return this.config.enabled
	}

	/**
	 * Get cached models if valid
	 */
	getCachedModels(flowConfig: {
		flowTenant?: string
		flowClientId?: string
		flowBaseUrl?: string
	}): ModelOption[] | null {
		if (!this.isEnabled()) {
			return null
		}

		try {
			const configHash = this.generateConfigHash(flowConfig)
			const cached = this.storage.getItem(this.cacheKey)

			if (!cached) {
				console.log("[FlowModelCache] No cache found")
				return null
			}

			const cacheEntry: CacheEntry = JSON.parse(cached)

			// Check if config matches
			if (cacheEntry.configHash !== configHash) {
				console.log("[FlowModelCache] Config changed, cache invalid")
				this.clearCache()
				return null
			}

			// Check if cache is expired
			const now = Date.now()
			const expirationTime = cacheEntry.timestamp + cacheEntry.ttl

			if (now > expirationTime) {
				const ageMinutes = Math.round((now - cacheEntry.timestamp) / (1000 * 60))
				console.log(`[FlowModelCache] Cache expired (age: ${ageMinutes} minutes)`)
				this.clearCache()
				return null
			}

			const ageMinutes = Math.round((now - cacheEntry.timestamp) / (1000 * 60))
			console.log(`[FlowModelCache] Using cached models (age: ${ageMinutes} minutes, ${cacheEntry.models.length} models)`)

			return cacheEntry.models

		} catch (error) {
			console.error("[FlowModelCache] Error reading cache:", error)
			this.clearCache()
			return null
		}
	}

	/**
	 * Cache models with current configuration
	 */
	cacheModels(models: ModelOption[], flowConfig: {
		flowTenant?: string
		flowClientId?: string
		flowBaseUrl?: string
	}): void {
		if (!this.isEnabled()) {
			return
		}

		try {
			const configHash = this.generateConfigHash(flowConfig)
			const ttl = this.config.ttlMinutes * 60 * 1000 // Convert to milliseconds

			const cacheEntry: CacheEntry = {
				models,
				timestamp: Date.now(),
				ttl,
				configHash
			}

			this.storage.setItem(this.cacheKey, JSON.stringify(cacheEntry))

			console.log(`[FlowModelCache] Cached ${models.length} models (TTL: ${this.config.ttlMinutes} minutes)`)

		} catch (error) {
			console.error("[FlowModelCache] Error caching models:", error)
		}
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		try {
			this.storage.removeItem(this.cacheKey)
			console.log("[FlowModelCache] Cache cleared")
		} catch (error) {
			console.error("[FlowModelCache] Error clearing cache:", error)
		}
	}

	/**
	 * Get cache info for debugging
	 */
	getCacheInfo(): {
		hasCache: boolean
		age?: number
		modelCount?: number
		expiresIn?: number
		configHash?: string
	} {
		try {
			const cached = this.storage.getItem(this.cacheKey)

			if (!cached) {
				return { hasCache: false }
			}

			const cacheEntry: CacheEntry = JSON.parse(cached)
			const now = Date.now()
			const age = Math.round((now - cacheEntry.timestamp) / (1000 * 60))
			const expiresIn = Math.round((cacheEntry.timestamp + cacheEntry.ttl - now) / (1000 * 60))

			return {
				hasCache: true,
				age,
				modelCount: cacheEntry.models.length,
				expiresIn: Math.max(0, expiresIn),
				configHash: cacheEntry.configHash
			}

		} catch (error) {
			console.error("[FlowModelCache] Error getting cache info:", error)
			return { hasCache: false }
		}
	}

	/**
	 * Clean old cache entries (called on initialization)
	 */
	private cleanOldEntries(): void {
		try {
			const cached = this.storage.getItem(this.cacheKey)

			if (!cached) {
				return
			}

			const cacheEntry: CacheEntry = JSON.parse(cached)
			const now = Date.now()
			const expirationTime = cacheEntry.timestamp + cacheEntry.ttl

			if (now > expirationTime) {
				console.log("[FlowModelCache] Cleaning expired cache on initialization")
				this.clearCache()
			}

		} catch (error) {
			console.error("[FlowModelCache] Error cleaning old entries:", error)
			this.clearCache()
		}
	}

	/**
	 * Update cache configuration
	 */
	updateConfig(newConfig: Partial<CacheConfig>): void {
		this.config = { ...this.config, ...newConfig }

		// If storage type changed, clear old cache
		if (newConfig.storageType && newConfig.storageType !== this.config.storageType) {
			this.clearCache()
			this.storage = newConfig.storageType === 'localStorage' ? localStorage : sessionStorage
		}

		console.log("[FlowModelCache] Config updated:", this.config)
	}
}

// Export singleton instance
export const flowModelCache = new FlowModelCache()

// Export for development/debugging
export const FlowModelCacheDebug = {
	getCacheInfo: () => flowModelCache.getCacheInfo(),
	clearCache: () => flowModelCache.clearCache(),
	updateConfig: (config: Partial<CacheConfig>) => flowModelCache.updateConfig(config)
}
