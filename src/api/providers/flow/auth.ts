import type { FlowConfig, AuthResponse } from "./types"
import { FLOW_ENDPOINTS, FLOW_HEADERS } from "./config"
import { secureLogger } from "./secure-logger"
import { securityAuditTrail } from "./audit-trail"
import { validateFlowCredentials } from "./credential-validator"
import { retryAuthentication } from "./enhanced-retry"

/**
 * Authenticate with Flow API using OAuth2 client credentials
 * @param config Flow configuration
 * @returns Promise resolving to authentication response
 */
export async function authenticate(config: FlowConfig): Promise<AuthResponse> {
	// Validate credentials before proceeding
	const validatedConfig = validateFlowCredentials(config)

	const correlationId = secureLogger.generateCorrelationId()
	const url = `${validatedConfig.flowAuthBaseUrl}${FLOW_ENDPOINTS.auth}`

	const payload = {
		clientId: validatedConfig.flowClientId,
		clientSecret: validatedConfig.flowClientSecret,
		appToAccess: validatedConfig.flowAppToAccess,
	}

	secureLogger.logAuth("Iniciando autenticação", {
		correlationId,
		url,
		tenant: validatedConfig.flowTenant,
		appToAccess: validatedConfig.flowAppToAccess,
		hasClientSecret: !!validatedConfig.flowClientSecret,
	})

	// Log authentication attempt to audit trail
	await securityAuditTrail.logAuthenticationEvent(
		'auth_attempt',
		correlationId,
		'pending',
		{
			clientId: validatedConfig.flowClientId
		}
	)

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				...FLOW_HEADERS,
				FlowTenant: validatedConfig.flowTenant,
			},
			body: JSON.stringify(payload),
		})

		secureLogger.logResponse(response.status, {
			correlationId,
			operation: "authenticate",
			ok: response.ok,
		})

		if (!response.ok) {
			const errorText = await response.text()
			secureLogger.logSecurityEvent({
				eventType: 'auth_failure',
				timestamp: Date.now(),
				correlationId,
				result: 'failure',
				errorCode: response.status.toString(),
				metadata: {
					statusText: response.statusText,
					hasErrorText: !!errorText
				}
			})

			// Log authentication failure to audit trail
			await securityAuditTrail.logAuthenticationEvent(
				'auth_failure',
				correlationId,
				'failure',
				{
					clientId: validatedConfig.flowClientId,
					errorCode: response.status.toString()
				}
			)

			throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`)
		}

		const data = await response.json()

		secureLogger.logDebug("Dados de resposta recebidos", {
			correlationId,
			hasAccessToken: !!data.access_token,
			expiresIn: data.expires_in,
			tokenType: data.token_type,
		})

		if (!data.access_token) {
			secureLogger.logSecurityEvent({
				eventType: 'auth_failure',
				timestamp: Date.now(),
				correlationId,
				result: 'failure',
				errorCode: 'MISSING_TOKEN',
				metadata: { reason: 'access_token missing in response' }
			})
			throw new Error("Authentication response missing access_token")
		}

		secureLogger.logSecurityEvent({
			eventType: 'auth_success',
			timestamp: Date.now(),
			correlationId,
			result: 'success'
		})

		// Log authentication success to audit trail
		await securityAuditTrail.logAuthenticationEvent(
			'auth_success',
			correlationId,
			'success',
			{
				clientId: validatedConfig.flowClientId
			}
		)

		return {
			access_token: data.access_token,
			expires_in: data.expires_in ?? 3600, // Default to 1 hour if not provided
			token_type: data.token_type ?? "Bearer",
		}
	} catch (error) {
		secureLogger.logError("Erro na autenticação", error instanceof Error ? error : new Error(String(error)), {
			correlationId,
			operation: "authenticate"
		})

		if (error instanceof Error) {
			throw new Error(`Flow authentication error: ${error.message}`)
		}
		throw error
	}
}

/**
 * Token manager class for handling authentication and token renewal
 */
export class TokenManager {
	private token: string | null = null
	private tokenExpiry: number = 0
	private readonly config: FlowConfig
	private readonly correlationId: string

	constructor(config: FlowConfig) {
		// Validate credentials during construction
		this.config = validateFlowCredentials(config)
		this.correlationId = secureLogger.generateCorrelationId()
	}

	/**
	 * Get a valid access token, refreshing if necessary
	 * @returns Promise resolving to valid access token
	 */
	async getValidToken(): Promise<string> {
		const now = Date.now()
		const needsRefresh = !this.token || now >= this.tokenExpiry - 60000

		secureLogger.logDebug("getValidToken chamado", {
			correlationId: this.correlationId,
			hasToken: !!this.token,
			needsRefresh,
			operation: "getValidToken"
		})

		// Refresh token if it doesn't exist or expires within 1 minute
		if (needsRefresh) {
			secureLogger.logDebug("Token precisa ser renovado", {
				correlationId: this.correlationId,
				operation: "token_refresh_needed"
			})
			await this.refreshToken()
		}

		secureLogger.logDebug("Token válido retornado", {
			correlationId: this.correlationId,
			operation: "getValidToken_success"
		})
		return this.token!
	}

	/**
	 * Force refresh the access token
	 */
	async refreshToken(): Promise<void> {
		secureLogger.logDebug("refreshToken iniciado", {
			correlationId: this.correlationId,
			operation: "refreshToken",
			config: {
				baseUrl: this.config.flowAuthBaseUrl,
				tenant: this.config.flowTenant,
				hasClientSecret: !!this.config.flowClientSecret,
				appToAccess: this.config.flowAppToAccess,
			},
		})

		try {
			const authResponse = await authenticate(this.config)
			this.token = authResponse.access_token
			this.tokenExpiry = Date.now() + authResponse.expires_in * 1000

			secureLogger.logSecurityEvent({
				eventType: 'token_refresh',
				timestamp: Date.now(),
				correlationId: this.correlationId,
				result: 'success',
				metadata: {
					expiresIn: authResponse.expires_in,
					hasToken: !!this.token
				}
			})

			// Log token refresh to audit trail
			await securityAuditTrail.logAuthenticationEvent(
				'token_refresh',
				this.correlationId,
				'success',
				{
					clientId: this.config.flowClientId
				}
			)
		} catch (error) {
			secureLogger.logError("Erro ao renovar token", error instanceof Error ? error : new Error(String(error)), {
				correlationId: this.correlationId,
				operation: "refreshToken"
			})

			this.token = null
			this.tokenExpiry = 0
			throw error
		}
	}

	/**
	 * Check if current token is valid (not expired)
	 * @returns boolean indicating if token is valid
	 */
	isTokenValid(): boolean {
		return this.token !== null && Date.now() < this.tokenExpiry - 60000
	}

	/**
	 * Clear stored token (useful for logout or error scenarios)
	 */
	clearToken(): void {
		this.token = null
		this.tokenExpiry = 0
	}

	/**
	 * Get token expiry time
	 * @returns Token expiry timestamp or null if no token
	 */
	getTokenExpiry(): number | null {
		return this.token ? this.tokenExpiry : null
	}
}
