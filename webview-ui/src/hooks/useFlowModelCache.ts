/**
 * Hook for managing Flow Model Cache configuration and debugging
 */

import { useState, useEffect } from 'react'
import { flowModelCache, FlowModelCacheDebug } from '@src/utils/flowModelCache'

interface CacheInfo {
	hasCache: boolean
	age?: number
	modelCount?: number
	expiresIn?: number
	configHash?: string
}

interface CacheConfig {
	ttlMinutes: number
	enabled: boolean
	storageType: 'localStorage' | 'sessionStorage'
}

export const useFlowModelCache = () => {
	const [cacheInfo, setCacheInfo] = useState<CacheInfo>({ hasCache: false })
	const [config, setConfig] = useState<CacheConfig>({
		ttlMinutes: 60,
		enabled: true,
		storageType: 'localStorage'
	})

	// Update cache info
	const refreshCacheInfo = () => {
		const info = FlowModelCacheDebug.getCacheInfo()
		setCacheInfo(info)
	}

	// Clear cache
	const clearCache = () => {
		FlowModelCacheDebug.clearCache()
		refreshCacheInfo()
	}

	// Update cache configuration
	const updateConfig = (newConfig: Partial<CacheConfig>) => {
		const updatedConfig = { ...config, ...newConfig }
		setConfig(updatedConfig)
		FlowModelCacheDebug.updateConfig(updatedConfig)
		refreshCacheInfo()
	}

	// Disable cache (for development)
	const disableCache = () => {
		updateConfig({ enabled: false })
	}

	// Enable cache
	const enableCache = () => {
		updateConfig({ enabled: true })
	}

	// Set TTL
	const setTTL = (minutes: number) => {
		updateConfig({ ttlMinutes: minutes })
	}

	// Switch storage type
	const switchStorage = (storageType: 'localStorage' | 'sessionStorage') => {
		updateConfig({ storageType })
	}

	// Auto-refresh cache info every 30 seconds
	useEffect(() => {
		refreshCacheInfo()
		
		const interval = setInterval(refreshCacheInfo, 30000)
		return () => clearInterval(interval)
	}, [])

	return {
		cacheInfo,
		config,
		refreshCacheInfo,
		clearCache,
		updateConfig,
		disableCache,
		enableCache,
		setTTL,
		switchStorage,
		
		// Utility functions
		isEnabled: () => config.enabled,
		getCacheAge: () => cacheInfo.age || 0,
		getCacheExpiry: () => cacheInfo.expiresIn || 0,
		hasValidCache: () => cacheInfo.hasCache && (cacheInfo.expiresIn || 0) > 0
	}
}

// Development utilities (available in browser console)
if (typeof window !== 'undefined') {
	(window as any).FlowModelCacheDebug = {
		...FlowModelCacheDebug,
		
		// Quick commands for development
		disable: () => FlowModelCacheDebug.updateConfig({ enabled: false }),
		enable: () => FlowModelCacheDebug.updateConfig({ enabled: true }),
		setTTL: (minutes: number) => FlowModelCacheDebug.updateConfig({ ttlMinutes: minutes }),
		info: () => {
			const info = FlowModelCacheDebug.getCacheInfo()
			console.table(info)
			return info
		},
		clear: () => {
			FlowModelCacheDebug.clearCache()
			console.log('Cache cleared')
		}
	}
	
	console.log('FlowModelCache debug utilities available at window.FlowModelCacheDebug')
}
