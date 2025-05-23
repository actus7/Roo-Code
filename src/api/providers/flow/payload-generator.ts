import { FlowConfig, FlowChatCompletionOptions } from "./types"
import {
	transformMessage,
	transformMessagesToGeminiFormat,
	transformMessagesToBedrockFormat,
	extractSystemMessage,
} from "./model-utils"

// Valores padrão para tokens e temperatura
const DEFAULT_MAX_TOKENS = 2048
const DEFAULT_TEMPERATURE = 0.7

// Funções de otimização específicas para cada provedor
function enhanceAzureOpenAIPayload(payload: any, options: FlowChatCompletionOptions) {
	if (options.functions) {
		payload.functions = options.functions
	}
	if (options.functionCall) {
		payload.function_call = options.functionCall
	}
	if (options.responseFormat) {
		payload.response_format = options.responseFormat
	}
	return payload
}

function enhanceBedrockClaudePayload(payload: any, options: FlowChatCompletionOptions) {
	if (options.topK) {
		payload.top_k = options.topK
	}
	if (options.topP) {
		payload.top_p = options.topP
	}
	return payload
}

// Geradores de payload específicos para cada provedor
export function generateAzureOpenAIPayload(options: FlowChatCompletionOptions, _config: FlowConfig) {
	const payload = {
		messages: options.messages.map(transformMessage),
		model: options.model,
		max_tokens: options.maxTokens || DEFAULT_MAX_TOKENS,
		temperature: options.temperature || DEFAULT_TEMPERATURE,
		stream: options.stream || false,
	}
	return enhanceAzureOpenAIPayload(payload, options)
}

export function generateGeminiPayload(options: FlowChatCompletionOptions, _config: FlowConfig) {
	return {
		model: options.model,
		contents: transformMessagesToGeminiFormat(options.messages),
		generationConfig: {
			maxOutputTokens: options.maxTokens || DEFAULT_MAX_TOKENS,
			temperature: options.temperature || DEFAULT_TEMPERATURE,
		},
		stream: options.stream || false,
	}
}

export function generateBedrockPayload(options: FlowChatCompletionOptions, _config: FlowConfig) {
	const payload = {
		allowedModels: [options.model],
		messages: transformMessagesToBedrockFormat(options.messages.filter((msg) => msg.role !== "system")),
		system: extractSystemMessage(options.messages),
		anthropic_version: "bedrock-2023-05-31",
		max_tokens: options.maxTokens || DEFAULT_MAX_TOKENS,
		temperature: options.temperature || DEFAULT_TEMPERATURE,
		stream: options.stream || false,
	}
	return enhanceBedrockClaudePayload(payload, options)
}

export function generateAzureFoundryPayload(options: FlowChatCompletionOptions) {
	return {
		model: options.model,
		messages: [
			{
				content: `You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and your role is to assist with questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will not answer.\n### Instruction:\n${options.messages
					.map((m) => m.content)
					.join("\n")}\n### Response:\n`,
				role: "user",
			},
		],
	}
}

// Função principal para gerar payload baseado no provedor
export function generateProviderPayload(provider: string, options: FlowChatCompletionOptions, config: FlowConfig) {
	switch (provider) {
		case "azure-openai":
			return generateAzureOpenAIPayload(options, config)
		case "google-gemini":
			return generateGeminiPayload(options, config)
		case "amazon-bedrock":
			return generateBedrockPayload(options, config)
		case "azure-foundry":
			return generateAzureFoundryPayload(options)
		default:
			throw new Error(`Unsupported provider for payload generation: ${provider}`)
	}
}
