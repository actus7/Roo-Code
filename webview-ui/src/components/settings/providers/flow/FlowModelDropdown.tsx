/**
 * FlowModelDropdown - Specialized Dropdown Component for Model Selection
 *
 * This component handles the rendering of the model selection dropdown
 * with loading states and proper event handling.
 */

import React from 'react'
import { VSCodeDropdown, VSCodeOption, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { ModelOption } from './useFlowModelFetcher'

export interface FlowModelDropdownProps {
	selectedModel?: string
	models: ModelOption[]
	isLoading: boolean
	disabled?: boolean
	isConfigComplete: boolean
	isUsingCache: boolean
	onModelChange: (modelId: string) => void
	placeholder?: string
	className?: string
}

/**
 * FlowModelDropdown component for model selection
 */
export const FlowModelDropdown: React.FC<FlowModelDropdownProps> = ({
	selectedModel,
	models,
	isLoading,
	disabled = false,
	isConfigComplete,
	isUsingCache,
	onModelChange,
	placeholder = "Selecione um modelo...",
	className = ""
}) => {
	/**
	 * Handle model selection change
	 */
	const handleModelChange = (event: any) => {
		const selectedValue = event.target.value
		console.log(`[FlowModelDropdown] User selected model: "${selectedValue}"`)
		onModelChange(selectedValue)
	}

	/**
	 * Render loading indicator
	 */
	const renderLoadingIndicator = () => {
		if (!isLoading) return null

		return (
			<div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
				<VSCodeProgressRing />
				<span className="text-xs text-gray-500">
					{isUsingCache ? "(cache)" : ""}
				</span>
			</div>
		)
	}

	/**
	 * Render model options grouped by provider
	 */
	const renderModelOptions = () => {
		if (models.length === 0) {
			return null
		}

		// Group models by provider for better organization
		const modelsByProvider = models.reduce((acc, model) => {
			if (!acc[model.provider]) {
				acc[model.provider] = []
			}
			acc[model.provider].push(model)
			return acc
		}, {} as Record<string, ModelOption[]>)

		// Sort providers for consistent ordering
		const sortedProviders = Object.keys(modelsByProvider).sort()

		return sortedProviders.map(provider => {
			const providerModels = modelsByProvider[provider]

			// Sort models within provider (non-hardcoded first)
			const sortedModels = providerModels.sort((a, b) => {
				const aHardcoded = a.label.includes("hardcoded")
				const bHardcoded = b.label.includes("hardcoded")

				if (aHardcoded !== bHardcoded) {
					return aHardcoded ? 1 : -1
				}

				return a.value.localeCompare(b.value)
			})

			return sortedModels.map((model) => (
				<VSCodeOption key={model.value} value={model.value}>
					{model.label}
				</VSCodeOption>
			))
		})
	}

	/**
	 * Get dropdown accessibility attributes
	 */
	const getAccessibilityProps = () => {
		return {
			'aria-label': 'Seleção de modelo Flow',
			'aria-describedby': 'model-dropdown-help',
			'aria-invalid': !selectedModel && models.length > 0
		}
	}

	/**
	 * Get dropdown state classes
	 */
	const getDropdownClasses = () => {
		const baseClasses = "w-full"
		const stateClasses = []

		if (isLoading) {
			stateClasses.push("opacity-75")
		}

		if (!isConfigComplete) {
			stateClasses.push("cursor-not-allowed")
		}

		return [baseClasses, ...stateClasses, className].filter(Boolean).join(" ")
	}

	/**
	 * Check if dropdown should be disabled
	 */
	const isDropdownDisabled = () => {
		return disabled || isLoading || !isConfigComplete
	}

	return (
		<div className="flow-model-dropdown">
			{/* Label */}
			<label className="block text-sm font-medium mb-2">
				Modelo
				<span className="text-xs text-gray-500 ml-2">(Selecione o modelo a ser usado)</span>
			</label>

			{/* Dropdown Container */}
			<div className="relative">
				<VSCodeDropdown
					value={selectedModel || ""}
					onChange={handleModelChange}
					disabled={isDropdownDisabled()}
					className={getDropdownClasses()}
					style={{ width: "100%" }}
					{...getAccessibilityProps()}
				>
					<VSCodeOption value="">{placeholder}</VSCodeOption>
					{renderModelOptions()}
				</VSCodeDropdown>

				{renderLoadingIndicator()}
			</div>

			{/* Help text */}
			<div id="model-dropdown-help" className="mt-2 text-xs text-gray-500">
				Os modelos são agrupados por provider. Modelos hardcoded são incluídos como fallback.
			</div>
		</div>
	)
}

/**
 * Memoized version of FlowModelDropdown for performance optimization
 */
export const MemoizedFlowModelDropdown = React.memo(FlowModelDropdown, (prevProps, nextProps) => {
	// Custom comparison function to prevent unnecessary re-renders
	return (
		prevProps.selectedModel === nextProps.selectedModel &&
		prevProps.isLoading === nextProps.isLoading &&
		prevProps.disabled === nextProps.disabled &&
		prevProps.isConfigComplete === nextProps.isConfigComplete &&
		prevProps.isUsingCache === nextProps.isUsingCache &&
		prevProps.models.length === nextProps.models.length &&
		prevProps.models.every((model, index) =>
			model.value === nextProps.models[index]?.value &&
			model.label === nextProps.models[index]?.label &&
			model.provider === nextProps.models[index]?.provider
		)
	)
})

MemoizedFlowModelDropdown.displayName = 'MemoizedFlowModelDropdown'

/**
 * Hook for managing dropdown state and behavior
 */
export const useFlowModelDropdown = (
	models: ModelOption[],
	selectedModel?: string
) => {
	/**
	 * Get model statistics
	 */
	const getModelStats = () => {
		const totalModels = models.length
		const providers = Array.from(new Set(models.map(m => m.provider)))
		const hardcodedCount = models.filter(m => m.label.includes("hardcoded")).length
		const apiCount = totalModels - hardcodedCount

		return {
			totalModels,
			providers,
			hardcodedCount,
			apiCount,
			providerCounts: providers.map(provider => ({
				provider,
				count: models.filter(m => m.provider === provider).length
			}))
		}
	}

	/**
	 * Check if selected model is valid
	 */
	const isSelectedModelValid = () => {
		if (!selectedModel) return false
		return models.some(model => model.value === selectedModel)
	}

	/**
	 * Get selected model details
	 */
	const getSelectedModelDetails = () => {
		if (!selectedModel) return null
		return models.find(model => model.value === selectedModel) || null
	}

	/**
	 * Get models by provider
	 */
	const getModelsByProvider = (provider: string) => {
		return models.filter(model => model.provider === provider)
	}

	/**
	 * Get non-hardcoded models
	 */
	const getNonHardcodedModels = () => {
		return models.filter(model => !model.label.includes("hardcoded"))
	}

	/**
	 * Get hardcoded models
	 */
	const getHardcodedModels = () => {
		return models.filter(model => model.label.includes("hardcoded"))
	}

	return {
		modelStats: getModelStats(),
		isSelectedModelValid: isSelectedModelValid(),
		selectedModelDetails: getSelectedModelDetails(),
		getModelsByProvider,
		getNonHardcodedModels,
		getHardcodedModels
	}
}
