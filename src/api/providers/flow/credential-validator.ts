import { z } from "zod"
import { FlowConfigSchema, type FlowConfig } from "./types"
import { secureLogger } from "./secure-logger"
import { securityAuditTrail } from "./audit-trail"

/**
 * Security error class for credential validation failures
 */
export class CredentialValidationError extends Error {
	constructor(message: string, public readonly field?: string) {
		super(message)
		this.name = "CredentialValidationError"
	}
}

/**
 * Validates Flow configuration credentials using Zod schema
 * @param config Flow configuration to validate
 * @returns Validated configuration
 * @throws CredentialValidationError if validation fails
 */
export function validateFlowCredentials(config: FlowConfig): FlowConfig {
	const correlationId = secureLogger.generateCorrelationId()

	secureLogger.logDebug("Iniciando validação de credenciais", {
		correlationId,
		operation: "validate_credentials",
		hasClientId: !!config.flowClientId,
		hasClientSecret: !!config.flowClientSecret,
		hasTenant: !!config.flowTenant,
		hasBaseUrl: !!config.flowBaseUrl
	})

	try {
		// Validate using Zod schema
		const validatedConfig = FlowConfigSchema.parse(config)

		// Additional security checks
		validateClientIdFormat(config.flowClientId)
		validateClientSecretStrength(config.flowClientSecret)
		validateTenantSecurity(config.flowTenant)

		secureLogger.logSecurityEvent({
			eventType: 'credential_validation',
			timestamp: Date.now(),
			correlationId,
			result: 'success',
			metadata: {
				validationPassed: true,
				configFields: Object.keys(config).length
			}
		})

		// Log successful validation to audit trail
		securityAuditTrail.logSecurityEvent({
			eventType: 'credential_validation',
			correlationId,
			result: 'success',
			severity: 'low',
			category: 'authentication',
			source: 'flow_provider',
			details: {
				action: 'validate_credentials',
				status: 'passed'
			}
		})

		return validatedConfig as FlowConfig
	} catch (error) {
		const errorMessage = error instanceof z.ZodError
			? formatZodError(error)
			: error instanceof Error
				? error.message
				: "Erro desconhecido na validação"

		secureLogger.logSecurityEvent({
			eventType: 'credential_validation',
			timestamp: Date.now(),
			correlationId,
			result: 'failure',
			errorCode: 'VALIDATION_FAILED',
			metadata: {
				validationPassed: false,
				errorType: error instanceof z.ZodError ? 'schema_validation' : 'security_validation'
			}
		})

		// Log validation failure to audit trail
		securityAuditTrail.logSecurityEvent({
			eventType: 'credential_validation',
			correlationId,
			result: 'failure',
			severity: 'medium',
			category: 'authentication',
			source: 'flow_provider',
			details: {
				action: 'validate_credentials',
				status: 'failed',
				errorType: error instanceof z.ZodError ? 'schema_validation' : 'security_validation'
			}
		})

		throw new CredentialValidationError(errorMessage)
	}
}

/**
 * Validates client ID format for additional security
 */
function validateClientIdFormat(clientId: string): void {
	// Check for suspicious patterns
	if (clientId.includes('..') || clientId.includes('//')) {
		throw new CredentialValidationError("Client ID contém padrões suspeitos", "flowClientId")
	}

	// Check for SQL injection patterns
	const sqlPatterns = /('|"|;|--|\*|\/\*|\*\/|xp_|sp_)/i
	if (sqlPatterns.test(clientId)) {
		throw new CredentialValidationError("Client ID contém caracteres não permitidos", "flowClientId")
	}
}

/**
 * Validates client secret strength
 */
function validateClientSecretStrength(clientSecret: string): void {
	// Check entropy (basic check for randomness)
	const uniqueChars = new Set(clientSecret).size
	if (uniqueChars < 16) {
		throw new CredentialValidationError("Client Secret tem baixa entropia", "flowClientSecret")
	}

	// Check for common weak patterns
	const weakPatterns = [
		/^(.)\1+$/, // All same character
		/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde)/i, // Sequential
		/^(password|secret|key|token)/i // Common words
	]

	for (const pattern of weakPatterns) {
		if (pattern.test(clientSecret)) {
			throw new CredentialValidationError("Client Secret contém padrões fracos", "flowClientSecret")
		}
	}
}

/**
 * Validates tenant for security issues
 */
function validateTenantSecurity(tenant: string): void {
	// Check for path traversal attempts
	if (tenant.includes('..') || tenant.includes('/') || tenant.includes('\\')) {
		throw new CredentialValidationError("Tenant contém caracteres não permitidos", "flowTenant")
	}

	// Check for script injection
	const scriptPatterns = /<script|javascript:|data:|vbscript:/i
	if (scriptPatterns.test(tenant)) {
		throw new CredentialValidationError("Tenant contém conteúdo suspeito", "flowTenant")
	}
}

/**
 * Formats Zod validation errors into user-friendly messages
 */
function formatZodError(error: z.ZodError): string {
	const issues = error.issues.map(issue => {
		const path = issue.path.join('.')
		return `${path}: ${issue.message}`
	})

	return `Erro de validação: ${issues.join(', ')}`
}

/**
 * Sanitizes configuration for logging (removes sensitive data)
 */
export function sanitizeConfigForLogging(config: FlowConfig): Record<string, any> {
	return {
		flowBaseUrl: config.flowBaseUrl,
		flowTenant: config.flowTenant,
		flowClientId: config.flowClientId ? `${config.flowClientId.substring(0, 8)}***` : undefined,
		hasClientSecret: !!config.flowClientSecret,
		flowAuthBaseUrl: config.flowAuthBaseUrl,
		flowAppToAccess: config.flowAppToAccess,
		flowAgent: config.flowAgent,
		apiModelId: config.apiModelId,
		modelTemperature: config.modelTemperature,
		modelMaxTokens: config.modelMaxTokens,
		flowRequestTimeout: config.flowRequestTimeout
	}
}
