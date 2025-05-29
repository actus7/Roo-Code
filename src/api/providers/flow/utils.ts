/**
 * Create a conditional logger for Flow components
 * @param component Component name for logging context
 * @returns Logger object with conditional methods
 */
export function createLogger(component: string) {
	const isDev = process.env.NODE_ENV === 'development'
	const logLevel = process.env.FLOW_LOG_LEVEL || 'info'
	const isDebugEnabled = process.env.DEBUG === "true" || process.env.FLOW_DEBUG === "true"

	return {
		debug: (isDev && (logLevel === 'debug' || isDebugEnabled))
			? (msg: string, data?: any) => console.log(`🔍 [${component}] ${msg}`, data || "")
			: () => {},
		info: (msg: string, data?: any) => console.info(`ℹ️ [${component}] ${msg}`, data || ""),
		warn: (msg: string, data?: any) => console.warn(`⚠️ [${component}] ${msg}`, data || ""),
		error: (msg: string, data?: any) => console.error(`❌ [${component}] ${msg}`, data || ""),
		// Security logs are always active
		security: (msg: string, data?: any) => console.info(`🔒 [${component}] ${msg}`, data || "")
	}
}

/**
 * Debug logging utility for Flow provider (legacy compatibility)
 * @param message Debug message
 * @param data Optional data to log
 */
export function debug(message: string, data?: any): void {
	const logger = createLogger('Flow')
	logger.debug(message, data)
}

/**
 * Sleep utility for implementing delays
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 * @param retryCount Current retry attempt (0-based)
 * @param baseDelay Base delay in milliseconds (default: 1000)
 * @param maxDelay Maximum delay in milliseconds (default: 30000)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(retryCount: number, baseDelay = 1000, maxDelay = 30000): number {
	const delay = baseDelay * Math.pow(2, retryCount)
	return Math.min(delay, maxDelay)
}

/**
 * Add jitter to a delay to avoid thundering herd
 * @param delay Base delay in milliseconds
 * @param jitterFactor Factor for jitter (0-1, default: 0.1)
 * @returns Delay with jitter applied
 */
export function addJitter(delay: number, jitterFactor = 0.1): number {
	const jitter = delay * jitterFactor * Math.random()
	return delay + jitter
}

/**
 * Validate that a string is a valid URL
 * @param url URL string to validate
 * @returns boolean indicating if URL is valid
 */
export function isValidUrl(url: string): boolean {
	try {
		new URL(url)
		return true
	} catch {
		return false
	}
}

/**
 * Sanitize error message for logging
 * @param error Error object or string
 * @returns Sanitized error message
 */
export function sanitizeError(error: unknown): string {
	if (error instanceof Error) {
		return error.message
	}
	if (typeof error === "string") {
		return error
	}
	return "Unknown error"
}

/**
 * Create a timeout promise that rejects after specified time
 * @param ms Timeout in milliseconds
 * @param message Optional timeout message
 * @returns Promise that rejects after timeout
 */
export function createTimeout(ms: number, message = "Operation timed out"): Promise<never> {
	return new Promise((_, reject) => {
		setTimeout(() => reject(new Error(message)), ms)
	})
}

/**
 * Race a promise against a timeout
 * @param promise Promise to race
 * @param timeoutMs Timeout in milliseconds
 * @param timeoutMessage Optional timeout message
 * @returns Promise that resolves with the original promise or rejects on timeout
 */
export async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	timeoutMessage?: string,
): Promise<T> {
	return Promise.race([promise, createTimeout(timeoutMs, timeoutMessage)])
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay between retries
 * @returns Promise resolving to function result
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	baseDelay = 1000,
): Promise<T> {
	let lastError: Error

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error))

			if (attempt === maxRetries) {
				break
			}

			const delay = addJitter(calculateBackoff(attempt, baseDelay))
			debug(`Retry attempt ${attempt + 1}/${maxRetries + 1} failed, waiting ${delay}ms`, {
				error: sanitizeError(error),
			})

			await sleep(delay)
		}
	}

	throw lastError!
}

/**
 * Parse Server-Sent Events (SSE) data or complete JSON responses with improved fragment handling
 * @param chunk Raw chunk data
 * @returns Parsed data or null if invalid
 */
export function parseSSEChunk(chunk: string): any | null {
	// Skip empty or whitespace-only chunks
	const trimmedChunk = chunk.trim()
	if (!trimmedChunk) {
		return null
	}

	// First, try to detect if this is a complete JSON response (Flow Bedrock format)
	if (trimmedChunk.startsWith("{") && trimmedChunk.endsWith("}")) {
		try {
			const parsed = JSON.parse(trimmedChunk)
			return parsed
		} catch (error) {
			// Continue to SSE parsing if JSON parsing fails
		}
	}

	// Handle traditional SSE parsing with improved line processing
	const lines = chunk.split("\n")

	// Process each line looking for valid SSE data
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (line.startsWith("data: ")) {
			const data = line.slice(6).trim()

			if (data === "[DONE]") {
				return null
			}

			// Skip empty data lines
			if (!data) {
				continue
			}

			try {
				const parsed = JSON.parse(data)
				return parsed
			} catch (error) {
				debug("Failed to parse SSE chunk", { chunk: data, error: sanitizeError(error) })
				// Continue to next line instead of returning null immediately
				continue
			}
		}
	}

	return null
}

/**
 * Check if an error is a rate limit error
 * @param error Error to check
 * @returns boolean indicating if it's a rate limit error
 */
export function isRateLimitError(error: any): boolean {
	if (error?.status === 429) {
		return true
	}
	if (error?.message?.toLowerCase().includes("rate limit")) {
		return true
	}
	return false
}

/**
 * Check if an error is a temporary/retryable error
 * @param error Error to check
 * @returns boolean indicating if error is retryable
 */
export function isRetryableError(error: any): boolean {
	// Rate limit errors are retryable
	if (isRateLimitError(error)) {
		return true
	}

	// 5xx server errors are retryable
	if (error?.status >= 500 && error?.status < 600) {
		return true
	}

	// Network errors are retryable
	if (error?.code === "ECONNRESET" || error?.code === "ENOTFOUND" || error?.code === "ETIMEDOUT") {
		return true
	}

	return false
}
