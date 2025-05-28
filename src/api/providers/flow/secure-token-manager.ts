// Simple mutex implementation to avoid external dependency
class SimpleMutex {
	private locked = false
	private readonly queue: Array<() => void> = []

	async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const execute = async () => {
				this.locked = true
				try {
					const result = await fn()
					resolve(result)
				} catch (error) {
					reject(error)
				} finally {
					this.locked = false
					const next = this.queue.shift()
					if (next) {
						next()
					}
				}
			}

			if (this.locked) {
				this.queue.push(execute)
			} else {
				execute()
			}
		})
	}
}
import * as crypto from "crypto"
import jwt from "jsonwebtoken"
import { authenticate } from "./auth"
import { validateFlowCredentials } from "./credential-validator"
import { secureLogger } from "./secure-logger"
import { securityAuditTrail } from "./audit-trail"
import { retryWithBackoff } from "./utils"
import type { FlowConfig, AuthResponse } from "./types"

/**
 * Encrypted token storage interface
 */
interface EncryptedTokenData {
	encryptedToken: string
	iv: string
	authTag: string
	expiry: number
	tokenType: string
}

/**
 * Thread-safe token manager with encryption and enhanced security
 */
export class SecureTokenManager {
	private encryptedTokenData: EncryptedTokenData | null = null
	private readonly config: FlowConfig
	private readonly correlationId: string
	private readonly refreshMutex = new SimpleMutex()
	private refreshPromise: Promise<void> | null = null
	private readonly encryptionKey: Buffer

	// Security metrics
	private refreshAttempts = 0
	private lastRefreshTime = 0
	private consecutiveFailures = 0

	constructor(config: FlowConfig) {
		// Validate credentials before storing
		this.config = validateFlowCredentials(config)
		this.correlationId = secureLogger.generateCorrelationId()

		// Generate encryption key from client secret (deterministic but secure)
		this.encryptionKey = crypto.scryptSync(config.flowClientSecret, 'flow-token-salt', 32)

		secureLogger.logDebug("SecureTokenManager inicializado", {
			correlationId: this.correlationId,
			operation: "constructor",
			hasValidConfig: true
		})
	}

	/**
	 * Get a valid access token, refreshing if necessary (thread-safe)
	 */
	async getValidToken(): Promise<string> {
		const now = Date.now()
		const needsRefresh = !this.encryptedTokenData || now >= this.encryptedTokenData.expiry - 60000

		secureLogger.logDebug("getValidToken chamado", {
			correlationId: this.correlationId,
			hasToken: !!this.encryptedTokenData,
			needsRefresh,
			operation: "getValidToken"
		})

		if (needsRefresh) {
			// Use mutex to prevent race conditions
			return this.refreshMutex.runExclusive(async () => {
				// Double-check after acquiring lock
				const currentTime = Date.now()
				if (!this.encryptedTokenData || currentTime >= this.encryptedTokenData.expiry - 60000) {

					// If there's already a refresh in progress, wait for it
					if (this.refreshPromise) {
						await this.refreshPromise
					} else {
						this.refreshPromise = this.performTokenRefresh()
						await this.refreshPromise
						this.refreshPromise = null
					}
				}

				return this.decryptToken()
			})
		}

		return this.decryptToken()
	}

	/**
	 * Perform token refresh with retry logic and security monitoring
	 */
	private async performTokenRefresh(): Promise<void> {
		const startTime = Date.now()
		this.refreshAttempts++

		secureLogger.logDebug("Iniciando refresh de token", {
			correlationId: this.correlationId,
			operation: "token_refresh",
			attempt: this.refreshAttempts,
			consecutiveFailures: this.consecutiveFailures
		})

		try {
			// Use retry logic with exponential backoff
			const authResponse = await retryWithBackoff(
				() => authenticate(this.config),
				3, // max retries
				1000 // base delay
			)

			// Validate token before storing
			this.validateAuthResponse(authResponse)

			// Encrypt and store token
			this.encryptAndStoreToken(authResponse)

			// Reset failure counter on success
			this.consecutiveFailures = 0
			this.lastRefreshTime = Date.now()

			const refreshDuration = Date.now() - startTime

			secureLogger.logSecurityEvent({
				eventType: 'token_refresh',
				timestamp: Date.now(),
				correlationId: this.correlationId,
				result: 'success',
				metadata: {
					refreshDuration,
					attempt: this.refreshAttempts,
					expiresIn: authResponse.expires_in
				}
			})

			// Log successful refresh to audit trail
			await securityAuditTrail.logAuthenticationEvent(
				'token_refresh',
				this.correlationId,
				'success',
				{
					clientId: this.config.flowClientId,
					refreshDuration,
					attempt: this.refreshAttempts
				}
			)

		} catch (error) {
			this.consecutiveFailures++

			secureLogger.logError("Erro ao renovar token", error instanceof Error ? error : new Error(String(error)), {
				correlationId: this.correlationId,
				operation: "token_refresh",
				attempt: this.refreshAttempts,
				consecutiveFailures: this.consecutiveFailures
			})

			// Clear token data on failure
			this.clearTokenData()

			// Log failure to audit trail
			await securityAuditTrail.logAuthenticationEvent(
				'token_refresh_failure',
				this.correlationId,
				'failure',
				{
					clientId: this.config.flowClientId,
					attempt: this.refreshAttempts,
					consecutiveFailures: this.consecutiveFailures,
					errorMessage: error instanceof Error ? error.message : 'Unknown error'
				}
			)

			throw error
		}
	}

	/**
	 * Validate authentication response
	 */
	private validateAuthResponse(authResponse: AuthResponse): void {
		if (!authResponse.access_token) {
			throw new Error("Token de acesso não recebido")
		}

		// Basic JWT validation (if token is JWT format)
		try {
			const decoded = jwt.decode(authResponse.access_token, { complete: true })
			if (decoded && typeof decoded === 'object') {
				secureLogger.logDebug("Token JWT validado", {
					correlationId: this.correlationId,
					operation: "jwt_validation",
					hasHeader: !!decoded.header,
					hasPayload: !!decoded.payload
				})
			}
		} catch (error) {
			// Token might not be JWT format, which is acceptable
			secureLogger.logDebug("Token não é formato JWT", {
				correlationId: this.correlationId,
				operation: "jwt_validation",
				tokenLength: authResponse.access_token.length
			})
		}

		// Validate expiry
		if (authResponse.expires_in <= 0) {
			throw new Error("Token com tempo de expiração inválido")
		}
	}

	/**
	 * Encrypt and store token securely
	 */
	private encryptAndStoreToken(authResponse: AuthResponse): void {
		const iv = crypto.randomBytes(16)
		const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv)
		cipher.setAAD(Buffer.from(this.correlationId))

		let encrypted = cipher.update(authResponse.access_token, 'utf8', 'hex')
		encrypted += cipher.final('hex')
		const authTag = cipher.getAuthTag()

		this.encryptedTokenData = {
			encryptedToken: encrypted,
			iv: iv.toString('hex'),
			authTag: authTag.toString('hex'),
			expiry: Date.now() + authResponse.expires_in * 1000,
			tokenType: authResponse.token_type || "Bearer"
		}

		secureLogger.logDebug("Token criptografado e armazenado", {
			correlationId: this.correlationId,
			operation: "encrypt_token",
			expiryTime: new Date(this.encryptedTokenData.expiry).toISOString()
		})
	}

	/**
	 * Decrypt stored token
	 */
	private decryptToken(): string {
		if (!this.encryptedTokenData) {
			throw new Error("Nenhum token armazenado")
		}

		try {
			const iv = Buffer.from(this.encryptedTokenData.iv, 'hex')
			const authTag = Buffer.from(this.encryptedTokenData.authTag, 'hex')
			const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv)
			decipher.setAAD(Buffer.from(this.correlationId))
			decipher.setAuthTag(authTag)

			let decrypted = decipher.update(this.encryptedTokenData.encryptedToken, 'hex', 'utf8')
			decrypted += decipher.final('utf8')

			return decrypted
		} catch (error) {
			secureLogger.logError("Erro ao descriptografar token", error instanceof Error ? error : new Error(String(error)), {
				correlationId: this.correlationId,
				operation: "decrypt_token"
			})

			// Clear corrupted token data
			this.clearTokenData()
			throw new Error("Falha na descriptografia do token")
		}
	}

	/**
	 * Check if current token is valid (not expired)
	 */
	isTokenValid(): boolean {
		return this.encryptedTokenData !== null && Date.now() < this.encryptedTokenData.expiry - 60000
	}

	/**
	 * Clear stored token data securely
	 */
	clearTokenData(): void {
		if (this.encryptedTokenData) {
			// Overwrite sensitive data before clearing
			this.encryptedTokenData.encryptedToken = '0'.repeat(this.encryptedTokenData.encryptedToken.length)
			this.encryptedTokenData = null
		}

		secureLogger.logDebug("Token data limpo", {
			correlationId: this.correlationId,
			operation: "clear_token"
		})
	}

	/**
	 * Get token expiry time
	 */
	getTokenExpiry(): number | null {
		return this.encryptedTokenData ? this.encryptedTokenData.expiry : null
	}

	/**
	 * Get security metrics
	 */
	getSecurityMetrics(): {
		refreshAttempts: number
		lastRefreshTime: number
		consecutiveFailures: number
		hasValidToken: boolean
	} {
		return {
			refreshAttempts: this.refreshAttempts,
			lastRefreshTime: this.lastRefreshTime,
			consecutiveFailures: this.consecutiveFailures,
			hasValidToken: this.isTokenValid()
		}
	}
}
