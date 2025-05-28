import type { RequestOptions } from "./types"
import { debug, retryWithBackoff, isRetryableError, withTimeout, sanitizeError } from "./utils"

/**
 * Make an HTTP request with retry logic and timeout
 * @param url Request URL
 * @param options Request options
 * @param maxRetries Maximum number of retries (default: 3)
 * @returns Promise resolving to Response object
 */
export async function makeRequestWithRetry(
	url: string,
	options: RequestOptions,
	maxRetries = 3,
): Promise<Response> {
	const { timeout = 30000, ...fetchOptions } = options

	return retryWithBackoff(
		async () => {
			debug(`Making request to ${url}`, { method: options.method, headers: options.headers })

			const response = await withTimeout(
				fetch(url, fetchOptions),
				timeout,
				`Request to ${url} timed out after ${timeout}ms`,
			)

			// Handle rate limiting with Retry-After header
			if (response.status === 429) {
				const retryAfter = response.headers.get("Retry-After")
				const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000

				debug(`Rate limited, waiting ${waitTime}ms before retry`)
				await new Promise((resolve) => setTimeout(resolve, waitTime))

				throw new Error(`Rate limited: ${response.status} ${response.statusText}`)
			}

			// Check for other HTTP errors
			if (!response.ok) {
				const errorText = await response.text().catch(() => "Unknown error")
				const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
				;(error as any).status = response.status
				;(error as any).statusText = response.statusText

				// Only retry if it's a retryable error
				if (isRetryableError(error)) {
					throw error
				}

				// For non-retryable errors, throw immediately without retry
				throw new Error(`Non-retryable error: ${error.message}`)
			}

			debug(`Request successful`, { status: response.status, statusText: response.statusText })
			return response
		},
		maxRetries,
		1000, // Base delay of 1 second
	)
}

/**
 * Make a JSON request and parse the response
 * @param url Request URL
 * @param options Request options
 * @param maxRetries Maximum number of retries
 * @returns Promise resolving to parsed JSON response
 */
export async function makeJsonRequest<T = any>(
	url: string,
	options: RequestOptions,
	maxRetries = 3,
): Promise<T> {
	const response = await makeRequestWithRetry(url, options, maxRetries)

	try {
		const data = await response.json()
		debug(`JSON response parsed successfully`, { url, dataKeys: Object.keys(data) })
		return data
	} catch (error) {
		const errorMessage = `Failed to parse JSON response from ${url}: ${sanitizeError(error)}`
		debug(errorMessage)
		throw new Error(errorMessage)
	}
}

/**
 * Make a streaming request and return a readable stream
 * @param url Request URL
 * @param options Request options
 * @param maxRetries Maximum number of retries
 * @returns Promise resolving to ReadableStream
 */
export async function makeStreamingRequest(
	url: string,
	options: RequestOptions,
	maxRetries = 3,
): Promise<ReadableStream<Uint8Array>> {
	const response = await makeRequestWithRetry(url, options, maxRetries)

	if (!response.body) {
		throw new Error("Response body is null - streaming not supported")
	}

	debug(`Streaming request successful`, { url, status: response.status })
	return response.body
}

/**
 * Create standard headers for Flow API requests
 * @param token Access token
 * @param tenant Flow tenant
 * @param agent Flow agent identifier
 * @param additionalHeaders Additional headers to include
 * @returns Headers object
 */
export function createFlowHeaders(
	token: string,
	tenant: string,
	agent: string,
	additionalHeaders: Record<string, string> = {},
	isStreaming = false,
): Record<string, string> {
	return {
		"Content-Type": "application/json",
		Accept: isStreaming ? "text/event-stream" : "application/json",
		Authorization: `Bearer ${token}`,
		FlowTenant: tenant,
		FlowAgent: agent,
		...additionalHeaders,
	}
}

/**
 * Handle common HTTP errors and provide meaningful error messages
 * @param error Error object
 * @param context Additional context for the error
 * @returns Enhanced error with better messaging
 */
export function handleHttpError(error: any, context: string): Error {
	if (error.status) {
		switch (error.status) {
			case 401:
				return new Error(`${context}: Authentication failed - check credentials`)
			case 403:
				return new Error(`${context}: Access denied - check permissions`)
			case 404:
				return new Error(`${context}: Resource not found`)
			case 429:
				return new Error(`${context}: Rate limit exceeded - please retry later`)
			case 500:
				return new Error(`${context}: Internal server error`)
			case 502:
				return new Error(`${context}: Bad gateway - service temporarily unavailable`)
			case 503:
				return new Error(`${context}: Service unavailable`)
			case 504:
				return new Error(`${context}: Gateway timeout`)
			default:
				return new Error(`${context}: HTTP ${error.status} - ${error.message}`)
		}
	}

	if (error.code) {
		switch (error.code) {
			case "ECONNRESET":
				return new Error(`${context}: Connection reset by server`)
			case "ENOTFOUND":
				return new Error(`${context}: DNS lookup failed`)
			case "ETIMEDOUT":
				return new Error(`${context}: Request timed out`)
			case "ECONNREFUSED":
				return new Error(`${context}: Connection refused`)
			default:
				return new Error(`${context}: Network error - ${error.code}`)
		}
	}

	return new Error(`${context}: ${sanitizeError(error)}`)
}
