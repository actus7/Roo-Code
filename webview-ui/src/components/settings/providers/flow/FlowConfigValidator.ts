/**
 * FlowConfigValidator - Configuration Validation Utility
 * 
 * This utility provides methods for validating Flow configuration
 * and detecting configuration changes.
 */

export interface FlowConfig {
	flowBaseUrl?: string
	flowTenant?: string
	flowClientId?: string
	flowClientSecret?: string
	flowAuthBaseUrl?: string
	flowAppToAccess?: string
}

export interface ConfigValidationResult {
	isValid: boolean
	missingFields: string[]
	warnings: string[]
}

/**
 * FlowConfigValidator class for validating Flow configuration
 */
export class FlowConfigValidator {
	/**
	 * Check if configuration is complete enough to fetch models
	 */
	static isConfigComplete(config: FlowConfig): boolean {
		return !!(
			config.flowTenant &&
			config.flowClientId &&
			config.flowClientSecret
			// Note: flowBaseUrl is optional, defaults to "https://flow.ciandt.com"
		)
	}

	/**
	 * Create a config hash to detect changes
	 * Excludes secret from hash for security, but includes a flag if it exists
	 */
	static getConfigHash(config: FlowConfig): string {
		return JSON.stringify({
			baseUrl: config.flowBaseUrl,
			tenant: config.flowTenant,
			clientId: config.flowClientId,
			// Don't include secret in hash for security, but include a flag if it exists
			hasSecret: !!config.flowClientSecret,
			authBaseUrl: config.flowAuthBaseUrl,
			appToAccess: config.flowAppToAccess
		})
	}

	/**
	 * Validate configuration and return detailed results
	 */
	static validateConfig(config: FlowConfig): ConfigValidationResult {
		const missingFields: string[] = []
		const warnings: string[] = []

		// Check required fields
		if (!config.flowTenant) {
			missingFields.push('flowTenant')
		}

		if (!config.flowClientId) {
			missingFields.push('flowClientId')
		}

		if (!config.flowClientSecret) {
			missingFields.push('flowClientSecret')
		}

		// Check optional fields and add warnings if missing
		if (!config.flowBaseUrl) {
			warnings.push('flowBaseUrl not specified, will use default: https://flow.ciandt.com')
		}

		if (!config.flowAuthBaseUrl) {
			warnings.push('flowAuthBaseUrl not specified, will use flowBaseUrl or default')
		}

		if (!config.flowAppToAccess) {
			warnings.push('flowAppToAccess not specified, will use default: llm-api')
		}

		return {
			isValid: missingFields.length === 0,
			missingFields,
			warnings
		}
	}

	/**
	 * Get missing fields as a user-friendly message
	 */
	static getMissingFieldsMessage(config: FlowConfig): string | null {
		const validation = this.validateConfig(config)
		
		if (validation.isValid) {
			return null
		}

		const fieldNames: Record<string, string> = {
			flowTenant: 'Tenant',
			flowClientId: 'Client ID',
			flowClientSecret: 'Client Secret'
		}

		const missingNames = validation.missingFields.map(field => fieldNames[field] || field)
		
		if (missingNames.length === 1) {
			return `Preencha o campo ${missingNames[0]}.`
		} else if (missingNames.length === 2) {
			return `Preencha os campos ${missingNames[0]} e ${missingNames[1]}.`
		} else {
			return `Preencha os campos ${missingNames.slice(0, -1).join(', ')} e ${missingNames[missingNames.length - 1]}.`
		}
	}

	/**
	 * Normalize configuration with defaults
	 */
	static normalizeConfig(config: FlowConfig): Required<FlowConfig> {
		return {
			flowBaseUrl: config.flowBaseUrl || "https://flow.ciandt.com",
			flowAuthBaseUrl: config.flowAuthBaseUrl || config.flowBaseUrl || "https://flow.ciandt.com",
			flowTenant: config.flowTenant || "",
			flowClientId: config.flowClientId || "",
			flowClientSecret: config.flowClientSecret || "",
			flowAppToAccess: config.flowAppToAccess || "llm-api"
		}
	}

	/**
	 * Check if two configurations are equivalent
	 */
	static areConfigsEqual(config1: FlowConfig, config2: FlowConfig): boolean {
		return this.getConfigHash(config1) === this.getConfigHash(config2)
	}

	/**
	 * Sanitize configuration for logging (removes sensitive data)
	 */
	static sanitizeConfigForLogging(config: FlowConfig): Record<string, any> {
		return {
			baseUrl: config.flowBaseUrl,
			authBaseUrl: config.flowAuthBaseUrl,
			tenant: config.flowTenant,
			clientId: config.flowClientId ? `${config.flowClientId.substring(0, 8)}...` : 'missing',
			hasSecret: !!config.flowClientSecret,
			appToAccess: config.flowAppToAccess
		}
	}

	/**
	 * Validate URL format
	 */
	static isValidUrl(url: string): boolean {
		try {
			new URL(url)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Validate configuration URLs
	 */
	static validateUrls(config: FlowConfig): { valid: boolean; errors: string[] } {
		const errors: string[] = []

		if (config.flowBaseUrl && !this.isValidUrl(config.flowBaseUrl)) {
			errors.push('flowBaseUrl is not a valid URL')
		}

		if (config.flowAuthBaseUrl && !this.isValidUrl(config.flowAuthBaseUrl)) {
			errors.push('flowAuthBaseUrl is not a valid URL')
		}

		return {
			valid: errors.length === 0,
			errors
		}
	}

	/**
	 * Get configuration summary for debugging
	 */
	static getConfigSummary(config: FlowConfig): Record<string, any> {
		const validation = this.validateConfig(config)
		const urlValidation = this.validateUrls(config)

		return {
			isComplete: validation.isValid,
			missingFields: validation.missingFields,
			warnings: validation.warnings,
			urlErrors: urlValidation.errors,
			sanitizedConfig: this.sanitizeConfigForLogging(config),
			configHash: this.getConfigHash(config)
		}
	}
}

/**
 * Hook for using FlowConfigValidator in React components
 */
export const useFlowConfigValidator = (config: FlowConfig) => {
	const isComplete = FlowConfigValidator.isConfigComplete(config)
	const validation = FlowConfigValidator.validateConfig(config)
	const missingFieldsMessage = FlowConfigValidator.getMissingFieldsMessage(config)
	const configHash = FlowConfigValidator.getConfigHash(config)
	const normalizedConfig = FlowConfigValidator.normalizeConfig(config)
	const urlValidation = FlowConfigValidator.validateUrls(config)

	return {
		isComplete,
		validation,
		missingFieldsMessage,
		configHash,
		normalizedConfig,
		urlValidation,
		sanitizedConfig: FlowConfigValidator.sanitizeConfigForLogging(config),
		configSummary: FlowConfigValidator.getConfigSummary(config)
	}
}
