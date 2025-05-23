/**
 * Utility functions for Flow provider
 */

/**
 * Debug logging function that only prints when process.env.DEBUG is 'true'
 * @param message Message to log
 * @param data Optional data to log
 */
export function debug(message: string, data?: any): void {
	if (process.env.DEBUG === "true") {
		console.log(`[Flow] ${message}`)
		if (data !== undefined) {
			console.log(data)
		}
	}
}
