import { secureLogger } from "./secure-logger"
import { securityAuditTrail } from "./audit-trail"

/**
 * Retry configuration options
 */
export interface RetryConfig {
	maxRetries: number
	baseDelay: number
	maxDelay: number
	backoffMultiplier: number
	jitter: boolean
	retryableErrors: string[]
	onRetry?: (error: Error, attempt: number) => void
}

/**
 * Default retry configuration for authentication
 */
export const DEFAULT_AUTH_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelay: 1000, // 1 second
	maxDelay: 30000, // 30 seconds
	backoffMultiplier: 2,
	jitter: true,
	retryableErrors: [
		'ECONNRESET',
		'ENOTFOUND',
		'ECONNREFUSED',
		'ETIMEDOUT',
		'NETWORK_ERROR',
		'RATE_LIMITED',
		'SERVICE_UNAVAILABLE'
	]
}

/**
 * Enhanced retry utility with exponential backoff, jitter, and security monitoring
 */
export class EnhancedRetry {
	private readonly config: RetryConfig
	private readonly correlationId: string

	constructor(config: Partial<RetryConfig> = {}) {
		this.config = { ...DEFAULT_AUTH_RETRY_CONFIG, ...config }
		this.correlationId = secureLogger.generateCorrelationId()
	}

	/**
	 * Execute function with retry logic
	 */
	async execute<T>(
		fn: () => Promise<T>,
		context: string = 'unknown_operation'
	): Promise<T> {
		let lastError: Error
		const startTime = Date.now()

		secureLogger.logDebug("Iniciando operação com retry", {
			correlationId: this.correlationId,
			operation: context,
			maxRetries: this.config.maxRetries,
			baseDelay: this.config.baseDelay
		})

		for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
			try {
				const result = await fn()
				
				if (attempt > 0) {
					const totalDuration = Date.now() - startTime
					
					secureLogger.logSecurityEvent({
						eventType: 'retry_success',
						timestamp: Date.now(),
						correlationId: this.correlationId,
						result: 'success',
						metadata: {
							operation: context,
							attempt,
							totalDuration,
							retriesUsed: attempt
						}
					})

					// Log retry success to audit trail
					await securityAuditTrail.logSecurityEvent({
						eventType: 'retry_success',
						correlationId: this.correlationId,
						result: 'success',
						severity: 'low',
						category: 'resilience',
						source: 'enhanced_retry',
						details: {
							operation: context,
							attempt,
							totalDuration,
							retriesUsed: attempt
						}
					})
				}

				return result
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))
				
				// Check if error is retryable
				if (!this.isRetryableError(lastError) || attempt === this.config.maxRetries) {
					const totalDuration = Date.now() - startTime
					
					secureLogger.logSecurityEvent({
						eventType: 'retry_exhausted',
						timestamp: Date.now(),
						correlationId: this.correlationId,
						result: 'failure',
						errorCode: this.getErrorCode(lastError),
						metadata: {
							operation: context,
							totalAttempts: attempt + 1,
							totalDuration,
							finalError: lastError.message,
							isRetryable: this.isRetryableError(lastError)
						}
					})

					// Log retry exhaustion to audit trail
					await securityAuditTrail.logSecurityEvent({
						eventType: 'retry_exhausted',
						correlationId: this.correlationId,
						result: 'failure',
						severity: 'medium',
						category: 'resilience',
						source: 'enhanced_retry',
						details: {
							operation: context,
							totalAttempts: attempt + 1,
							totalDuration,
							finalError: lastError.message,
							isRetryable: this.isRetryableError(lastError)
						}
					})

					throw lastError
				}

				// Calculate delay for next attempt
				const delay = this.calculateDelay(attempt)
				
				secureLogger.logDebug("Tentativa falhou, aguardando retry", {
					correlationId: this.correlationId,
					operation: context,
					attempt: attempt + 1,
					error: lastError.message,
					nextRetryIn: delay,
					isRetryable: this.isRetryableError(lastError)
				})

				// Call retry callback if provided
				if (this.config.onRetry) {
					this.config.onRetry(lastError, attempt + 1)
				}

				// Log retry attempt to audit trail
				await securityAuditTrail.logSecurityEvent({
					eventType: 'retry_attempt',
					correlationId: this.correlationId,
					result: 'pending',
					severity: 'low',
					category: 'resilience',
					source: 'enhanced_retry',
					details: {
						operation: context,
						attempt: attempt + 1,
						error: lastError.message,
						nextRetryIn: delay
					}
				})

				// Wait before next attempt
				await this.delay(delay)
			}
		}

		throw lastError!
	}

	/**
	 * Check if error is retryable based on configuration
	 */
	private isRetryableError(error: Error): boolean {
		const errorMessage = error.message.toLowerCase()
		const errorCode = this.getErrorCode(error)
		
		// Check for specific error codes
		if (this.config.retryableErrors.includes(errorCode)) {
			return true
		}

		// Check for HTTP status codes
		if ('status' in error) {
			const status = (error as any).status
			// Retry on 5xx errors and 429 (rate limiting)
			if (status >= 500 || status === 429) {
				return true
			}
		}

		// Check for network-related errors
		const networkErrors = [
			'network error',
			'connection reset',
			'connection refused',
			'timeout',
			'dns lookup failed',
			'socket hang up'
		]

		return networkErrors.some(pattern => errorMessage.includes(pattern))
	}

	/**
	 * Extract error code from error object
	 */
	private getErrorCode(error: Error): string {
		if ('code' in error && typeof error.code === 'string') {
			return error.code
		}
		
		if ('status' in error && typeof error.status === 'number') {
			return `HTTP_${error.status}`
		}

		// Extract from error message
		const codeMatch = error.message.match(/^([A-Z_]+):/i)
		if (codeMatch) {
			return codeMatch[1].toUpperCase()
		}

		return 'UNKNOWN_ERROR'
	}

	/**
	 * Calculate delay with exponential backoff and optional jitter
	 */
	private calculateDelay(attempt: number): number {
		let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt)
		
		// Apply maximum delay limit
		delay = Math.min(delay, this.config.maxDelay)
		
		// Add jitter to prevent thundering herd
		if (this.config.jitter) {
			const jitterAmount = delay * 0.1 // 10% jitter
			delay += (Math.random() - 0.5) * 2 * jitterAmount
		}
		
		return Math.max(delay, 0)
	}

	/**
	 * Promise-based delay utility
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}

/**
 * Convenience function for authentication retry
 */
export async function retryAuthentication<T>(
	fn: () => Promise<T>,
	context: string = 'authentication'
): Promise<T> {
	const retry = new EnhancedRetry({
		maxRetries: 3,
		baseDelay: 2000, // Start with 2 seconds for auth
		maxDelay: 60000, // Max 1 minute
		backoffMultiplier: 2,
		jitter: true,
		retryableErrors: [
			...DEFAULT_AUTH_RETRY_CONFIG.retryableErrors,
			'AUTH_TIMEOUT',
			'TOKEN_REFRESH_FAILED'
		]
	})

	return retry.execute(fn, context)
}

/**
 * Convenience function for API request retry
 */
export async function retryApiRequest<T>(
	fn: () => Promise<T>,
	context: string = 'api_request'
): Promise<T> {
	const retry = new EnhancedRetry({
		maxRetries: 2,
		baseDelay: 1000,
		maxDelay: 10000,
		backoffMultiplier: 2,
		jitter: true
	})

	return retry.execute(fn, context)
}
