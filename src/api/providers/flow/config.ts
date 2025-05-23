import type { FlowConfig } from "./types"
import { flowModels } from "../../../shared/api/models"

// Default values for Flow configuration
export const DEFAULT_FLOW_BASE_URL = "https://flow.ciandt.com"
export const DEFAULT_FLOW_APP_TO_ACCESS = "llm-api"
export const DEFAULT_FLOW_AGENT = "chat"
export const DEFAULT_FLOW_REQUEST_TIMEOUT = 30000
export const DEFAULT_MODEL_TEMPERATURE = 0.7

export const FLOW_MODELS = flowModels

/**
 * Initializes a complete Flow configuration by merging partial config with defaults
 * @param partialConfig Partial Flow configuration object
 * @returns Complete Flow configuration object
 */
export function initializeFlowConfig(partialConfig: Partial<FlowConfig>): FlowConfig {
	// Get the resolved base URL for Flow API
	const baseUrl = partialConfig.apiUrl || DEFAULT_FLOW_BASE_URL

	return {
		// Required fields
		apiKey: partialConfig.apiKey!,
		apiUrl: baseUrl,
		providerType: partialConfig.providerType!,
		flowAuthBaseUrl: partialConfig.flowAuthBaseUrl || baseUrl,
		flowTenant: partialConfig.flowTenant!,
		flowClientId: partialConfig.flowClientId!,
		flowClientSecret: partialConfig.flowClientSecret!,
		flowAppToAccess: partialConfig.flowAppToAccess || DEFAULT_FLOW_APP_TO_ACCESS,
		flowAgent: partialConfig.flowAgent || DEFAULT_FLOW_AGENT,
		flowRequestTimeout: partialConfig.flowRequestTimeout || DEFAULT_FLOW_REQUEST_TIMEOUT,

		// Optional fields
		version: partialConfig.version,
		deploymentId: partialConfig.deploymentId,
		region: partialConfig.region,
		project: partialConfig.project,
		apiModelId: partialConfig.apiModelId,
	}
}
