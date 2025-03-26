export const FlowConfig = {
  DEFAULT_BASE_URL: "https://flow.ciandt.com",
  AUTH_PATH: "/auth-engine-api/v1/api-key/token",
  API_PATH: "/ai-orchestration-api/v1",
  TOKEN_EXPIRY_MINUTES: 55,
  MAX_AUTH_RETRIES: 50,
  RETRY_DELAY_MS: 100,
  DEFAULT_TIMEOUT: 30000,
} as const
