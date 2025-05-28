import type { FlowConfig } from "./types"

/**
 * Default configuration values for Flow provider
 */
export const FLOW_DEFAULTS = {
	flowAppToAccess: "llm-api",
	flowAgent: "chat",
	modelTemperature: 0.7,
	flowRequestTimeout: 30000,
} as const

/**
 * Initialize Flow configuration with defaults
 * @param config Partial configuration object
 * @returns Complete FlowConfig with defaults applied
 */
export function initializeFlowConfig(config: Partial<FlowConfig>): FlowConfig {
	// Use environment variables as fallbacks for default values
	const defaultBaseUrl = process.env.FLOW_BASE_URL || "https://flow.ciandt.com"
	const defaultTenant = process.env.FLOW_TENANT || ""
	const defaultClientId = process.env.FLOW_CLIENT_ID || ""
	const defaultClientSecret = process.env.FLOW_CLIENT_SECRET || ""
	const defaultAppToAccess = process.env.FLOW_APP_TO_ACCESS || FLOW_DEFAULTS.flowAppToAccess

	return {
		flowBaseUrl: config.flowBaseUrl || defaultBaseUrl,
		flowAuthBaseUrl: config.flowAuthBaseUrl || config.flowBaseUrl || defaultBaseUrl,
		flowTenant: config.flowTenant || defaultTenant,
		flowClientId: config.flowClientId || defaultClientId,
		flowClientSecret: config.flowClientSecret || defaultClientSecret,
		flowAppToAccess: config.flowAppToAccess || defaultAppToAccess,
		flowAgent: config.flowAgent || FLOW_DEFAULTS.flowAgent,
		apiModelId: config.apiModelId,
		modelTemperature: config.modelTemperature ?? FLOW_DEFAULTS.modelTemperature,
		modelMaxTokens: config.modelMaxTokens,
		flowRequestTimeout: config.flowRequestTimeout ?? FLOW_DEFAULTS.flowRequestTimeout,
	}
}

/**
 * Validate required Flow configuration parameters
 * @param config FlowConfig to validate
 * @throws Error if required parameters are missing
 */
export function validateFlowConfig(config: FlowConfig): void {
	const requiredFields = ["flowBaseUrl", "flowTenant", "flowClientId", "flowClientSecret"] as const

	for (const field of requiredFields) {
		if (!config[field]) {
			throw new Error(`Flow Provider: Missing required configuration parameter: ${field}`)
		}
	}
}

/**
 * API endpoints for Flow services
 */
export const FLOW_ENDPOINTS = {
	auth: "/auth-engine-api/v1/api-key/token",
	models: "/ai-orchestration-api/v1/models",
	azureOpenAI: "/ai-orchestration-api/v1/openai/chat/completions",
	googleGemini: "/ai-orchestration-api/v1/google/generateContent",
	amazonBedrock: "/ai-orchestration-api/v1/bedrock/invoke",
	azureFoundry: "/ai-orchestration-api/v1/foundry/chat/completions",
	embeddings: "/ai-orchestration-api/v1/openai/embeddings",
} as const

/**
 * Provider-specific endpoint mapping
 */
export const PROVIDER_ENDPOINTS = {
	"azure-openai": FLOW_ENDPOINTS.azureOpenAI,
	"google-gemini": FLOW_ENDPOINTS.googleGemini,
	"amazon-bedrock": FLOW_ENDPOINTS.amazonBedrock,
	"azure-foundry": FLOW_ENDPOINTS.azureFoundry,
} as const

/**
 * Supported model capabilities by provider
 */
export const PROVIDER_CAPABILITIES = {
	"azure-openai": ["streaming", "system-instruction", "chat-conversation", "image-recognition", "embeddings"],
	"google-gemini": ["streaming", "chat-conversation", "image-recognition", "system-instruction"],
	"amazon-bedrock": ["chat-conversation", "image-recognition", "streaming"],
	"azure-foundry": ["chat-conversation"],
} as const

/**
 * Default models for each provider
 */
export const DEFAULT_MODELS = {
	"azure-openai": "gpt-4o-mini",
	"google-gemini": "gemini-2.0-flash",
	"amazon-bedrock": "anthropic.claude-3-sonnet",
	"azure-foundry": "DeepSeek-R1",
} as const

/**
 * Model to provider mapping
 */
export const MODEL_PROVIDER_MAP = {
	// Azure OpenAI models
	"gpt-4": "azure-openai",
	"gpt-4o": "azure-openai",
	"gpt-4o-mini": "azure-openai",
	"o3-mini": "azure-openai",
	"o1-mini": "azure-openai",
	"text-embedding-3-small": "azure-openai",
	"text-embedding-ada-002": "azure-openai",

	// Google Gemini models
	"gemini-2.0-flash": "google-gemini",
	"gemini-2.5-pro": "google-gemini",

	// Amazon Bedrock models
	"anthropic.claude-3-sonnet": "amazon-bedrock",
	"anthropic.claude-37-sonnet": "amazon-bedrock",
	"meta.llama3-70b-instruct": "amazon-bedrock",
	"amazon.nova-lite": "amazon-bedrock",
	"amazon.nova-micro": "amazon-bedrock",
	"amazon.nova-pro": "amazon-bedrock",

	// Azure Foundry models
	"DeepSeek-R1": "azure-foundry",
} as const

/**
 * HTTP headers required for Flow API requests
 */
export const FLOW_HEADERS = {
	"Content-Type": "application/json",
	"Accept": "application/json",
} as const
