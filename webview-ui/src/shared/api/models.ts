export type ProviderName =
	| "openrouter"
	| "anthropic"
	| "gemini"
	| "deepseek"
	| "openai-native"
	| "openai"
	| "vertex"
	| "bedrock"
	| "flow"
	| "glama"
	| "vscode-lm"
	| "mistral"
	| "lmstudio"
	| "ollama"
	| "unbound"
	| "requesty"
	| "human-relay"
	| "xai"
	| "groq"
	| "chutes"
	| "litellm"
	| "flow"

export interface ModelInfo {
	contextSize: number
	capabilities: string[]
}

export const anthropicModels: Record<string, ModelInfo> = {
	"claude-3-opus": {
		contextSize: 200000,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const bedrockModels: Record<string, ModelInfo> = {
	"anthropic.claude-3-sonnet": {
		contextSize: 200000,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const deepSeekModels: Record<string, ModelInfo> = {
	"deepseek-chat": {
		contextSize: 32000,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const geminiModels: Record<string, ModelInfo> = {
	"gemini-pro": {
		contextSize: 32000,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const mistralModels: Record<string, ModelInfo> = {
	"mistral-large": {
		contextSize: 32000,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const openAiNativeModels: Record<string, ModelInfo> = {
	"gpt-4": {
		contextSize: 8192,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const vertexModels: Record<string, ModelInfo> = {
	"chat-bison": {
		contextSize: 8192,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const xaiModels: Record<string, ModelInfo> = {
	"grok-1": {
		contextSize: 8192,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const groqModels: Record<string, ModelInfo> = {
	"mixtral-8x7b": {
		contextSize: 32000,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const chutesModels: Record<string, ModelInfo> = {
	"chutes-3": {
		contextSize: 16000,
		capabilities: ["streaming", "system-instruction", "chat-conversation"],
	},
}

export const flowModels: Record<string, ModelInfo> = {
	"gpt-4o": {
		contextSize: 128000,
		capabilities: ["streaming", "system-instruction", "chat-conversation", "image-recognition"],
	},
	"gpt-4o-mini": {
		contextSize: 128000,
		capabilities: ["streaming", "system-instruction", "chat-conversation", "image-recognition"],
	},
}

// Modelos especiais que suportam raciocínio
export const REASONING_MODELS = ["gpt-4", "claude-3-opus", "gemini-pro"]

// Modelos que suportam cache de prompts
export const PROMPT_CACHING_MODELS = ["gpt-4o", "gpt-4o-mini"]
