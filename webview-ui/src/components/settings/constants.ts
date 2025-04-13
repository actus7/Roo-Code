import {
	ApiProvider,
	ModelInfo,
	anthropicModels,
	bedrockModels,
	deepSeekModels,
	geminiModels,
	mistralModels,
	openAiNativeModels,
	vertexModels,
	flowModels,
} from "../../../../src/shared/api"

export const MODELS_BY_PROVIDER: Partial<Record<ApiProvider, Record<string, ModelInfo>>> = {
	anthropic: anthropicModels,
	bedrock: bedrockModels,
	deepseek: deepSeekModels,
	gemini: geminiModels,
	mistral: mistralModels,
	"openai-native": openAiNativeModels,
	vertex: vertexModels,
	flow: flowModels,
}

export const FLOW_MODEL_TYPES = [
	{ value: "openai", label: "OpenAI (GPT-4)" },
	{ value: "anthropic", label: "Anthropic (Claude)" },
	{ value: "bedrock", label: "AWS Bedrock" },
	{ value: "meta", label: "Meta (Llama)" },
	{ value: "amazon", label: "Amazon (Nova)" },
]

export const FLOW_CONFIG = {
	apiEndpoints: {
		auth: "/auth-engine-api/v1/api-key/token",
		modelsAzure: "/ai-orchestration-api/v1/models/azure-openai",
		modelsBedrock: "/ai-orchestration-api/v1/models/amazon-bedrock",
		openai: "/ai-orchestration-api/v1/openai/chat/completions",
		google: "/ai-orchestration-api/v1/google/generateContent",
		bedrock: "/ai-orchestration-api/v1/bedrock/invoke",
	},
	defaultTenant: "cit",
	defaultBaseUrl: "https://flow.ciandt.com",
	defaultAppToAccess: "llm-api",
}

export const PROVIDERS = [
	{ value: "flow", label: "CI&T Flow" },
	{ value: "openrouter", label: "OpenRouter" },
	{ value: "anthropic", label: "Anthropic" },
	{ value: "gemini", label: "Google Gemini" },
	{ value: "deepseek", label: "DeepSeek" },
	{ value: "openai-native", label: "OpenAI" },
	{ value: "openai", label: "OpenAI Compatible" },
	{ value: "vertex", label: "GCP Vertex AI" },
	{ value: "bedrock", label: "Amazon Bedrock" },
	{ value: "glama", label: "Glama" },
	{ value: "vscode-lm", label: "VS Code LM API" },
	{ value: "github-copilot", label: "GitHub Copilot" },
	{ value: "mistral", label: "Mistral" },
	{ value: "lmstudio", label: "LM Studio" },
	{ value: "ollama", label: "Ollama" },
	{ value: "unbound", label: "Unbound" },
	{ value: "requesty", label: "Requesty" },
	{ value: "human-relay", label: "Human Relay" },
].sort((a, b) => a.label.localeCompare(b.label))

export const VERTEX_REGIONS = [
	{ value: "us-east5", label: "us-east5" },
	{ value: "us-central1", label: "us-central1" },
	{ value: "europe-west1", label: "europe-west1" },
	{ value: "europe-west4", label: "europe-west4" },
	{ value: "asia-southeast1", label: "asia-southeast1" },
]
