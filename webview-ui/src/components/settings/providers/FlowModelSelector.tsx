/**
 * FlowModelSelector - Refactored Component Following Single Responsibility Principle
 * 
 * This component orchestrates the extracted components and hooks to provide
 * a clean, maintainable model selection interface.
 */

import React, { useState, useEffect, useCallback } from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"

// Import extracted components and utilities
import { FlowConfigValidator, useFlowConfigValidator, type FlowConfig } from "./flow/FlowConfigValidator"
import { useFlowModelFetcher, type ModelOption } from "./flow/useFlowModelFetcher"
import { FlowModelValidator } from "./flow/FlowModelValidator"
import { FlowModelDropdown } from "./flow/FlowModelDropdown"
import { FlowModelStatus } from "./flow/FlowModelStatus"

interface FlowModelSelectorProps {
	selectedModel?: string
	onModelChange: (modelId: string) => void
	flowConfig: FlowConfig
	disabled?: boolean
}

/**
 * Refactored FlowModelSelector component using extracted components
 */
export const FlowModelSelector: React.FC<FlowModelSelectorProps> = ({
	selectedModel,
	onModelChange,
	flowConfig,
	disabled = false
}) => {
	const { t } = useAppTranslation()
	
	// Use extracted hooks and utilities
	const configValidator = useFlowConfigValidator(flowConfig)
	const modelFetcher = useFlowModelFetcher(flowConfig)
	
	// Local state for model validation and user interaction tracking
	const [isModelValidated, setIsModelValidated] = useState(false)
	const [isUserSelection, setIsUserSelection] = useState(false)
	const [hasAttemptedAutoLoad, setHasAttemptedAutoLoad] = useState(false)

	/**
	 * Validate and apply model selection when models are loaded
	 */
	const validateAndApplyModelSelection = useCallback(() => {
		if (!selectedModel || modelFetcher.models.length === 0 || isModelValidated) {
			return
		}

		console.log(`[FlowModelSelector] Validating model selection`, {
			selectedModel,
			availableModels: modelFetcher.models.length,
			modelValues: modelFetcher.models.map(m => m.value),
			isUserSelection
		})

		const validation = FlowModelValidator.validateModelSelection(
			selectedModel,
			modelFetcher.models,
			isUserSelection
		)

		if (validation.isValid) {
			console.log(`[FlowModelSelector] Selected model "${selectedModel}" is valid and available`)
			setIsModelValidated(true)
			if (isUserSelection) {
				setIsUserSelection(false)
			}
		} else if (validation.shouldUpdate && validation.newModelId) {
			console.log(`[FlowModelSelector] Updating model selection: "${validation.newModelId}" (reason: ${validation.reason})`)
			onModelChange(validation.newModelId)
			setIsModelValidated(true)
		} else if (isUserSelection) {
			// If it's a user selection but model doesn't exist, respect user choice
			console.log(`[FlowModelSelector] User selected model "${selectedModel}" not found, but respecting user choice`)
			setIsModelValidated(true)
			setIsUserSelection(false)
		}
	}, [selectedModel, modelFetcher.models, isModelValidated, isUserSelection, onModelChange])

	/**
	 * Handle model selection from dropdown
	 */
	const handleModelChange = useCallback((modelId: string) => {
		console.log(`[FlowModelSelector] User selected model: "${modelId}"`)
		setIsUserSelection(true)
		setIsModelValidated(false) // Reset validation for new selection
		onModelChange(modelId)
	}, [onModelChange])

	/**
	 * Handle retry action
	 */
	const handleRetry = useCallback(() => {
		console.log("[FlowModelSelector] Manual retry triggered")
		modelFetcher.retry()
	}, [modelFetcher])

	/**
	 * Handle refresh action
	 */
	const handleRefresh = useCallback(() => {
		console.log("[FlowModelSelector] Manual refresh triggered")
		modelFetcher.refresh()
	}, [modelFetcher])

	// Effect: Auto-load models when configuration is complete
	useEffect(() => {
		if (configValidator.isComplete && !hasAttemptedAutoLoad) {
			console.log("[FlowModelSelector] Auto-loading models on mount")
			modelFetcher.fetchModels({ isAutoLoad: true })
			setHasAttemptedAutoLoad(true)
		}
	}, [configValidator.isComplete, hasAttemptedAutoLoad, modelFetcher])

	// Effect: Reset validation when configuration changes
	useEffect(() => {
		const currentConfigHash = configValidator.configHash
		if (currentConfigHash !== modelFetcher.lastFetchConfig) {
			console.log("[FlowModelSelector] Configuration changed, resetting validation")
			setIsModelValidated(false)
			setHasAttemptedAutoLoad(false)
		}
	}, [configValidator.configHash, modelFetcher.lastFetchConfig])

	// Effect: Validate model selection when models are loaded
	useEffect(() => {
		validateAndApplyModelSelection()
	}, [validateAndApplyModelSelection])

	// Effect: Mark as validated when user makes a selection
	useEffect(() => {
		if (isUserSelection && selectedModel) {
			setIsModelValidated(true)
		}
	}, [isUserSelection, selectedModel])

	return (
		<div className="flow-model-selector">
			{/* Model Dropdown */}
			<FlowModelDropdown
				selectedModel={selectedModel}
				models={modelFetcher.models}
				isLoading={modelFetcher.isLoading}
				disabled={disabled}
				isConfigComplete={configValidator.isComplete}
				isUsingCache={modelFetcher.isUsingCache}
				onModelChange={handleModelChange}
				placeholder="Selecione um modelo..."
			/>

			{/* Status Display */}
			<FlowModelStatus
				models={modelFetcher.models}
				error={modelFetcher.error}
				isLoading={modelFetcher.isLoading}
				isConfigComplete={configValidator.isComplete}
				isUsingCache={modelFetcher.isUsingCache}
				cacheInfo={modelFetcher.cacheInfo}
				selectedModel={selectedModel}
				isModelValidated={isModelValidated}
				onRetry={handleRetry}
				onRefresh={handleRefresh}
			/>

			{/* Configuration Warning */}
			{!configValidator.isComplete && configValidator.missingFieldsMessage && (
				<div className="mt-2 text-sm text-yellow-600">
					⚠️ {configValidator.missingFieldsMessage}
				</div>
			)}

			{/* Debug Information (Development Only) */}
			{process.env.NODE_ENV === 'development' && (
				<details className="mt-4 text-xs text-gray-400">
					<summary>Debug Information</summary>
					<pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
						{JSON.stringify({
							configComplete: configValidator.isComplete,
							configHash: configValidator.configHash,
							modelsCount: modelFetcher.models.length,
							isLoading: modelFetcher.isLoading,
							error: modelFetcher.error,
							isUsingCache: modelFetcher.isUsingCache,
							selectedModel,
							isModelValidated,
							isUserSelection,
							hasAttemptedAutoLoad,
							lastFetchConfig: modelFetcher.lastFetchConfig,
							cacheInfo: modelFetcher.cacheInfo
						}, null, 2)}
					</pre>
				</details>
			)}
		</div>
	)
}

/**
 * Memoized version for performance optimization
 */
export const MemoizedFlowModelSelector = React.memo(FlowModelSelector, (prevProps, nextProps) => {
	return (
		prevProps.selectedModel === nextProps.selectedModel &&
		prevProps.disabled === nextProps.disabled &&
		JSON.stringify(prevProps.flowConfig) === JSON.stringify(nextProps.flowConfig)
	)
})

MemoizedFlowModelSelector.displayName = 'MemoizedFlowModelSelector'

/**
 * Hook for using FlowModelSelector with additional utilities
 */
export const useFlowModelSelector = (
	flowConfig: FlowConfig,
	selectedModel?: string
) => {
	const configValidator = useFlowConfigValidator(flowConfig)
	const modelFetcher = useFlowModelFetcher(flowConfig)

	/**
	 * Get selector state summary
	 */
	const getSelectorState = () => {
		return {
			isReady: configValidator.isComplete && modelFetcher.models.length > 0,
			hasError: !!modelFetcher.error,
			isLoading: modelFetcher.isLoading,
			modelCount: modelFetcher.models.length,
			selectedModelExists: selectedModel ? modelFetcher.models.some(m => m.value === selectedModel) : false,
			configIssues: configValidator.validation.missingFields,
			providers: Array.from(new Set(modelFetcher.models.map(m => m.provider)))
		}
	}

	/**
	 * Force reload models
	 */
	const reloadModels = () => {
		modelFetcher.refresh()
	}

	/**
	 * Clear all state
	 */
	const clearState = () => {
		modelFetcher.clear()
	}

	return {
		configValidator,
		modelFetcher,
		selectorState: getSelectorState(),
		reloadModels,
		clearState
	}
}

// Export the refactored component as default
export default FlowModelSelector
