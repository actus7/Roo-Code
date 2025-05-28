import type { FlowConfig, AuthResponse } from "./types"
import { FLOW_ENDPOINTS, FLOW_HEADERS } from "./config"

/**
 * Authenticate with Flow API using OAuth2 client credentials
 * @param config Flow configuration
 * @returns Promise resolving to authentication response
 */
export async function authenticate(config: FlowConfig): Promise<AuthResponse> {
	const url = `${config.flowAuthBaseUrl}${FLOW_ENDPOINTS.auth}`

	const payload = {
		clientId: config.flowClientId,
		clientSecret: config.flowClientSecret,
		appToAccess: config.flowAppToAccess,
	}

	console.log("🔐 [authenticate] Iniciando autenticação", {
		url,
		tenant: config.flowTenant,
		clientId: config.flowClientId,
		appToAccess: config.flowAppToAccess,
		hasClientSecret: !!config.flowClientSecret,
	})

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				...FLOW_HEADERS,
				FlowTenant: config.flowTenant,
			},
			body: JSON.stringify(payload),
		})

		console.log("📡 [authenticate] Resposta recebida", {
			status: response.status,
			statusText: response.statusText,
			ok: response.ok,
		})

		if (!response.ok) {
			const errorText = await response.text()
			console.error("❌ [authenticate] Falha na autenticação", {
				status: response.status,
				statusText: response.statusText,
				errorText,
			})
			throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`)
		}

		const data = await response.json()

		console.log("📋 [authenticate] Dados de resposta", {
			hasAccessToken: !!data.access_token,
			expiresIn: data.expires_in,
			tokenType: data.token_type,
		})

		if (!data.access_token) {
			throw new Error("Authentication response missing access_token")
		}

		console.log("✅ [authenticate] Autenticação bem-sucedida")
		return {
			access_token: data.access_token,
			expires_in: data.expires_in || 3600, // Default to 1 hour if not provided
			token_type: data.token_type || "Bearer",
		}
	} catch (error) {
		console.error("❌ [authenticate] Erro na autenticação:", {
			error: error instanceof Error ? error.message : String(error),
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
	private config: FlowConfig

	constructor(config: FlowConfig) {
		this.config = config
	}

	/**
	 * Get a valid access token, refreshing if necessary
	 * @returns Promise resolving to valid access token
	 */
	async getValidToken(): Promise<string> {
		const now = Date.now()

		console.log("🔑 [TokenManager] getValidToken chamado", {
			hasToken: !!this.token,
			tokenExpiry: this.tokenExpiry,
			now,
			needsRefresh: !this.token || now >= this.tokenExpiry - 60000,
		})

		// Refresh token if it doesn't exist or expires within 1 minute
		if (!this.token || now >= this.tokenExpiry - 60000) {
			console.log("🔄 [TokenManager] Token precisa ser renovado")
			await this.refreshToken()
		}

		console.log("✅ [TokenManager] Token válido retornado")
		return this.token!
	}

	/**
	 * Force refresh the access token
	 */
	async refreshToken(): Promise<void> {
		console.log("🔄 [TokenManager] refreshToken iniciado", {
			config: {
				baseUrl: this.config.flowAuthBaseUrl,
				tenant: this.config.flowTenant,
				clientId: this.config.flowClientId,
				hasClientSecret: !!this.config.flowClientSecret,
				appToAccess: this.config.flowAppToAccess,
			},
		})

		try {
			const authResponse = await authenticate(this.config)
			this.token = authResponse.access_token
			this.tokenExpiry = Date.now() + authResponse.expires_in * 1000

			console.log("✅ [TokenManager] Token renovado com sucesso", {
				tokenLength: this.token.length,
				expiresIn: authResponse.expires_in,
				tokenExpiry: this.tokenExpiry,
			})
		} catch (error) {
			console.error("❌ [TokenManager] Erro ao renovar token:", {
				error: error instanceof Error ? error.message : String(error),
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
