/**
 * Debug logging utility for Flow provider
 * @param message Debug message
 * @param data Optional data to log
 */
export function debug(message: string, data?: any): void {
	if (process.env.DEBUG === "true" || process.env.FLOW_DEBUG === "true") {
		console.log(`[Flow] ${message}`, data || "")
	}
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
	console.log("🔍 [parseSSEChunk] Parsing chunk:", {
		chunkLength: chunk.length,
		chunkPreview: chunk.substring(0, 300) + (chunk.length > 300 ? "..." : ""),
		startsWithData: chunk.trim().startsWith("data:"),
		startsWithBrace: chunk.trim().startsWith("{"),
		containsDataLines: chunk.includes("data: "),
		hasNewlines: chunk.includes("\n"),
	})

	// Skip empty or whitespace-only chunks
	const trimmedChunk = chunk.trim()
	if (!trimmedChunk) {
		console.log("⚠️ [parseSSEChunk] Empty chunk, skipping")
		return null
	}

	// First, try to detect if this is a complete JSON response (Flow Bedrock format)
	if (trimmedChunk.startsWith("{") && trimmedChunk.endsWith("}")) {
		console.log("🎯 [parseSSEChunk] Detected complete JSON response format")
		try {
			const parsed = JSON.parse(trimmedChunk)
			console.log("✅ [parseSSEChunk] Successfully parsed complete JSON:", {
				parsedKeys: Object.keys(parsed),
				parsedType: typeof parsed,
				hasType: !!parsed.type,
				hasContent: !!parsed.content,
				hasDelta: !!parsed.delta,
			})
			return parsed
		} catch (error) {
			console.error("❌ [parseSSEChunk] Failed to parse complete JSON:", {
				chunk: trimmedChunk.substring(0, 200) + "...",
				error: sanitizeError(error),
			})
		}
	}

	// Handle traditional SSE parsing with improved line processing
	const lines = chunk.split("\n")

	console.log("📋 [parseSSEChunk] Lines found for SSE parsing:", {
		lineCount: lines.length,
		lines: lines.map((line, index) => ({
			index,
			length: line.length,
			preview: line.substring(0, 100) + (line.length > 100 ? "..." : ""),
			startsWithData: line.startsWith("data: "),
			isEmpty: line.trim() === "",
		})),
	})

	// Process each line looking for valid SSE data
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (line.startsWith("data: ")) {
			const data = line.slice(6).trim()
			console.log("📦 [parseSSEChunk] SSE data line found:", {
				lineIndex: i,
				dataLength: data.length,
				dataPreview: data.substring(0, 200) + (data.length > 200 ? "..." : ""),
				isDone: data === "[DONE]",
				isJson: data.startsWith("{") && data.endsWith("}"),
			})

			if (data === "[DONE]") {
				console.log("🏁 [parseSSEChunk] DONE marker found")
				return null
			}

			// Skip empty data lines
			if (!data) {
				console.log("⚠️ [parseSSEChunk] Empty data line, skipping")
				continue
			}

			try {
				const parsed = JSON.parse(data)
				console.log("✅ [parseSSEChunk] Successfully parsed SSE JSON:", {
					parsedKeys: Object.keys(parsed),
					parsedType: typeof parsed,
					hasChoices: !!parsed.choices,
					choicesCount: parsed.choices?.length || 0,
				})
				return parsed
			} catch (error) {
				console.error("❌ [parseSSEChunk] Failed to parse SSE JSON:", {
					lineIndex: i,
					data: data.substring(0, 200) + "...",
					error: sanitizeError(error),
				})
				debug("Failed to parse SSE chunk", { chunk: data, error: sanitizeError(error) })
				// Continue to next line instead of returning null immediately
				continue
			}
		}
	}

	// Check if this might be a fragment of a larger chunk
	if (trimmedChunk.length > 0 && !trimmedChunk.includes("data: ") && !trimmedChunk.startsWith("{")) {
		console.log("🔄 [parseSSEChunk] Possible chunk fragment detected:", {
			chunkLength: trimmedChunk.length,
			chunkContent: trimmedChunk,
			suggestion: "This might be part of a larger SSE message",
		})
	}

	console.log("⚠️ [parseSSEChunk] No valid data found in chunk")
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
