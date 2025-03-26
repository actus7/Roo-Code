/**
 * Configuration constants for the Flow API service.
 */
export const FlowConfig = {
  /** Base URL for the Flow API */
  DEFAULT_BASE_URL: "https://flow.ciandt.com",
  /** Authentication endpoint path */
  AUTH_PATH: "/auth-engine-api/v1/api-key/token",
  /** Main API endpoint path */
  API_PATH: "/ai-orchestration-api/v1",
  /** Token expiration time in minutes */
  TOKEN_EXPIRY_MINUTES: 55,
  /** Maximum number of authentication retry attempts */
  MAX_AUTH_RETRIES: 50,
  /** Delay between retry attempts in milliseconds */
  RETRY_DELAY_MS: 100,
  /** Default timeout for API requests in milliseconds */
  DEFAULT_TIMEOUT: 30000,
} as const
