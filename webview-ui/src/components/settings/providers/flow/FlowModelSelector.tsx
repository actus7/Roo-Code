/**
 * FlowModelSelector Component
 *
 * Main component that combines all Flow model selection functionality
 */

import React from 'react'
import { FlowModelDropdown } from './FlowModelDropdown'
import { FlowModelStatus } from './FlowModelStatus'
import { FlowConfigValidator, type FlowConfig } from './FlowConfigValidator'
import { useFlowModelFetcher } from './useFlowModelFetcher'
import { useAppTranslation } from '@src/i18n/TranslationContext'

export interface FlowModelSelectorProps {
	selectedModel: string
	onModelChange: (model: string) => void
	flowConfig: FlowConfig
	disabled?: boolean
}

export interface FlowModelSelectorState {
	isReady: boolean
	configIssues: string[]
	hasModels: boolean
	isLoading: boolean
	error: string | null
}

/**
 * Hook that provides Flow model selector functionality
 */
export function useFlowModelSelector(
	flowConfig: FlowConfig,
	selectedModel?: string
) {
	const configValidator = FlowConfigValidator.validateConfig(flowConfig)
	const modelFetcher = useFlowModelFetcher(flowConfig)

	const selectorState: FlowModelSelectorState = {
		isReady: configValidator.isValid && modelFetcher.models.length > 0 && !modelFetcher.isLoading,
		configIssues: configValidator.missingFields,
		hasModels: modelFetcher.models.length > 0,
		isLoading: modelFetcher.isLoading,
		error: modelFetcher.error
	}

	const reloadModels = () => {
		modelFetcher.fetchModels()
	}

	const clearState = () => {
		modelFetcher.clear()
	}

	return {
		configValidator,
		modelFetcher,
		selectorState,
		reloadModels,
		clearState
	}
}

/**
 * Main FlowModelSelector component
 */
export function FlowModelSelector({
	selectedModel,
	onModelChange,
	flowConfig,
	disabled = false
}: FlowModelSelectorProps) {
	const { t } = useAppTranslation()
	const {
		configValidator,
		modelFetcher,
		selectorState,
		reloadModels,
		clearState
	} = useFlowModelSelector(flowConfig, selectedModel)

	// Show configuration warning if config is incomplete
	if (!configValidator.isValid) {
		const missingFieldsMessage = FlowConfigValidator.getMissingFieldsMessage(flowConfig)
		return (
			<div className="flow-model-selector">
				<div className="config-warning">
					<p className="text-yellow-600">
						{missingFieldsMessage || t('flow.config.incomplete')}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flow-model-selector">
			<FlowModelDropdown
				selectedModel={selectedModel}
				models={modelFetcher.models}
				onModelChange={onModelChange}
				isLoading={modelFetcher.isLoading}
				disabled={disabled}
				isConfigComplete={configValidator.isValid}
				isUsingCache={modelFetcher.isUsingCache}
			/>

			<FlowModelStatus
				models={modelFetcher.models}
				error={modelFetcher.error}
				isLoading={modelFetcher.isLoading}
				onRetry={reloadModels}
				onRefresh={reloadModels}
				isConfigComplete={configValidator.isValid}
				isUsingCache={modelFetcher.isUsingCache}
				cacheInfo={modelFetcher.cacheInfo}
				selectedModel={selectedModel}
				isModelValidated={selectedModel ? modelFetcher.models.some(m => m.value === selectedModel) : false}
			/>
		</div>
	)
}
