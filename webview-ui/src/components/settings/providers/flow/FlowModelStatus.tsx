/**
 * FlowModelStatus - Component for Displaying Model Loading Status and Information
 * 
 * This component handles the display of status messages, errors, success states,
 * cache information, and action buttons for the Flow model selector.
 */

import React from 'react'
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { ModelOption } from './useFlowModelFetcher'

export interface FlowModelStatusProps {
	models: ModelOption[]
	error: string | null
	isLoading: boolean
	isConfigComplete: boolean
	isUsingCache: boolean
	cacheInfo: { age?: number; expiresIn?: number } | null
	selectedModel?: string
	isModelValidated: boolean
	onRetry: () => void
	onRefresh: () => void
}

/**
 * FlowModelStatus component for displaying status information
 */
export const FlowModelStatus: React.FC<FlowModelStatusProps> = ({
	models,
	error,
	isLoading,
	isConfigComplete,
	isUsingCache,
	cacheInfo,
	selectedModel,
	isModelValidated,
	onRetry,
	onRefresh
}) => {
	/**
	 * Render error message with retry option
	 */
	const renderError = () => {
		if (!error) return null

		return (
			<div className="mt-2 text-sm text-red-600 flex items-center gap-2">
				<span>❌ {error}</span>
				{isConfigComplete && (
					<button
						onClick={onRetry}
						className="text-blue-600 hover:text-blue-800 underline"
						disabled={isLoading}
					>
						Tentar novamente
					</button>
				)}
			</div>
		)
	}

	/**
	 * Render configuration incomplete warning
	 */
	const renderConfigWarning = () => {
		if (isConfigComplete) return null

		return (
			<div className="mt-2 text-sm text-yellow-600">
				⚠️ Preencha os campos obrigatórios para carregar modelos.
			</div>
		)
	}

	/**
	 * Render success message with model count and selection info
	 */
	const renderSuccess = () => {
		if (models.length === 0 || error) return null

		const hasHardcodedModels = models.some(m => m.label.includes("hardcoded"))
		const selectedModelInfo = selectedModel && isModelValidated 
			? ` - "${selectedModel}" selecionado` 
			: ""

		return (
			<div className="text-sm text-green-600">
				✅ {models.length} modelos carregados
				{renderCacheIndicator()}
				{hasHardcodedModels && " (incluindo modelos hardcoded)"}
				{selectedModelInfo && (
					<span className="text-purple-600">{selectedModelInfo}</span>
				)}
			</div>
		)
	}

	/**
	 * Render cache indicator
	 */
	const renderCacheIndicator = () => {
		if (!isUsingCache || !cacheInfo) return null

		return (
			<span className="text-blue-600">
				{" "}(cache - {cacheInfo.age}min atrás)
			</span>
		)
	}

	/**
	 * Render cache information and refresh button
	 */
	const renderCacheInfo = () => {
		if (models.length === 0 || error) return null

		return (
			<div className="flex items-center gap-2 text-xs">
				{renderCacheExpiration()}
				{renderRefreshButton()}
			</div>
		)
	}

	/**
	 * Render cache expiration info
	 */
	const renderCacheExpiration = () => {
		if (!cacheInfo || cacheInfo.expiresIn === undefined) return null

		return (
			<span className="text-gray-500">
				Cache expira em {cacheInfo.expiresIn}min
			</span>
		)
	}

	/**
	 * Render refresh button
	 */
	const renderRefreshButton = () => {
		if (!isConfigComplete) return null

		return (
			<VSCodeButton
				appearance="secondary"
				onClick={onRefresh}
				disabled={isLoading}
				style={{ fontSize: '11px', padding: '2px 8px' }}
			>
				🔄 Atualizar Modelos
			</VSCodeButton>
		)
	}

	/**
	 * Get model statistics for display
	 */
	const getModelStats = () => {
		if (models.length === 0) return null

		const providers = Array.from(new Set(models.map(m => m.provider)))
		const hardcodedCount = models.filter(m => m.label.includes("hardcoded")).length
		const apiCount = models.length - hardcodedCount

		return {
			total: models.length,
			providers: providers.length,
			hardcoded: hardcodedCount,
			api: apiCount,
			providerList: providers
		}
	}

	/**
	 * Render detailed model statistics (for debugging/development)
	 */
	const renderModelStats = () => {
		const stats = getModelStats()
		if (!stats || process.env.NODE_ENV === 'production') return null

		return (
			<div className="mt-1 text-xs text-gray-400 font-mono">
				Debug: {stats.total} total ({stats.api} API + {stats.hardcoded} hardcoded) 
				across {stats.providers} providers: {stats.providerList.join(', ')}
			</div>
		)
	}

	/**
	 * Render loading state indicator
	 */
	const renderLoadingState = () => {
		if (!isLoading) return null

		return (
			<div className="mt-2 text-sm text-blue-600 flex items-center gap-2">
				<span>🔄 Carregando modelos...</span>
				{isUsingCache && <span className="text-xs">(verificando cache)</span>}
			</div>
		)
	}

	/**
	 * Render model validation status
	 */
	const renderValidationStatus = () => {
		if (!selectedModel || models.length === 0) return null

		const modelExists = models.some(m => m.value === selectedModel)
		
		if (!modelExists && selectedModel) {
			return (
				<div className="mt-1 text-xs text-orange-600">
					⚠️ Modelo selecionado "{selectedModel}" não encontrado na lista atual
				</div>
			)
		}

		return null
	}

	return (
		<div className="flow-model-status">
			{renderError()}
			{renderConfigWarning()}
			{renderLoadingState()}
			
			{models.length > 0 && !error && (
				<div className="mt-2 space-y-1">
					{renderSuccess()}
					{renderCacheInfo()}
					{renderValidationStatus()}
					{renderModelStats()}
				</div>
			)}
		</div>
	)
}

/**
 * Memoized version of FlowModelStatus for performance optimization
 */
export const MemoizedFlowModelStatus = React.memo(FlowModelStatus, (prevProps, nextProps) => {
	return (
		prevProps.error === nextProps.error &&
		prevProps.isLoading === nextProps.isLoading &&
		prevProps.isConfigComplete === nextProps.isConfigComplete &&
		prevProps.isUsingCache === nextProps.isUsingCache &&
		prevProps.selectedModel === nextProps.selectedModel &&
		prevProps.isModelValidated === nextProps.isModelValidated &&
		prevProps.models.length === nextProps.models.length &&
		JSON.stringify(prevProps.cacheInfo) === JSON.stringify(nextProps.cacheInfo)
	)
})

MemoizedFlowModelStatus.displayName = 'MemoizedFlowModelStatus'

/**
 * Hook for managing status display logic
 */
export const useFlowModelStatus = (
	models: ModelOption[],
	error: string | null,
	selectedModel?: string
) => {
	/**
	 * Get current status type
	 */
	const getStatusType = (): 'loading' | 'error' | 'success' | 'warning' | 'empty' => {
		if (error) return 'error'
		if (models.length === 0) return 'empty'
		if (selectedModel && !models.some(m => m.value === selectedModel)) return 'warning'
		return 'success'
	}

	/**
	 * Get status message
	 */
	const getStatusMessage = (): string => {
		const statusType = getStatusType()
		
		switch (statusType) {
			case 'error':
				return error || 'Erro desconhecido'
			case 'empty':
				return 'Nenhum modelo disponível'
			case 'warning':
				return `Modelo "${selectedModel}" não encontrado`
			case 'success':
				return `${models.length} modelos carregados`
			default:
				return ''
		}
	}

	/**
	 * Check if status indicates a problem
	 */
	const hasIssue = (): boolean => {
		const statusType = getStatusType()
		return statusType === 'error' || statusType === 'warning'
	}

	/**
	 * Get status color class
	 */
	const getStatusColor = (): string => {
		const statusType = getStatusType()
		
		switch (statusType) {
			case 'error':
				return 'text-red-600'
			case 'warning':
				return 'text-orange-600'
			case 'success':
				return 'text-green-600'
			case 'empty':
				return 'text-gray-500'
			default:
				return 'text-gray-600'
		}
	}

	return {
		statusType: getStatusType(),
		statusMessage: getStatusMessage(),
		hasIssue: hasIssue(),
		statusColor: getStatusColor()
	}
}
