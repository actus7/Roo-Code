import type {
	FlowProvider,
	FlowConfig,
	FlowChatCompletionOptions,
	AzureOpenAIPayload,
	GeminiPayload,
	BedrockPayload,
	FoundryPayload,
	ProviderPayload,
} from "./types"
import { debug } from "./utils"

/**
 * Generate provider-specific payload for chat completion
 * @param provider FlowProvider type
 * @param options Chat completion options
 * @param config Flow configuration
 * @returns Provider-specific payload
 */
export function generateProviderPayload(
	provider: FlowProvider,
	options: FlowChatCompletionOptions,
	config: FlowConfig,
): ProviderPayload {
	debug(`Generating payload for provider: ${provider}`, { model: options.model })

	switch (provider) {
		case "azure-openai":
			return generateAzureOpenAIPayload(options, config)
		case "google-gemini":
			return generateGeminiPayload(options, config)
		case "amazon-bedrock":
			return generateBedrockPayload(options, config)
		case "azure-foundry":
			return generateFoundryPayload(options, config)
		default:
			throw new Error(`Unsupported provider: ${provider}`)
	}
}

/**
 * Check if model is O1 or O3 family (requires special handling)
 */
function isO1OrO3Model(modelId: string): boolean {
	const o1o3Models = [
		"o1", "o1-preview", "o1-mini",
		"o3", "o3-mini", "o3-preview"
	]

	return o1o3Models.some(model => modelId === model || modelId.startsWith(model + "-"))
}

/**
 * Generate Azure OpenAI payload
 */
function generateAzureOpenAIPayload(options: FlowChatCompletionOptions, config: FlowConfig): AzureOpenAIPayload {
	const modelId = options.model || config.apiModelId || "gpt-4o-mini"
	const isO1Model = isO1OrO3Model(modelId)

	// Handle o1 models specially - they have different message format requirements
	let messages
	if (isO1Model) {
		// o1 models don't support system messages - merge system into first user message
		const systemMessages = options.messages.filter(msg => msg.role === "system")
		const nonSystemMessages = options.messages.filter(msg => msg.role !== "system")

		const systemContent = systemMessages
			.map(msg => typeof msg.content === "string" ? msg.content : msg.content[0]?.text || "")
			.join("\n\n")

		messages = nonSystemMessages.map((msg, index) => {
			let content = typeof msg.content === "string" ? msg.content : msg.content[0]?.text || ""

			// Prepend system content to first user message
			if (index === 0 && msg.role === "user" && systemContent) {
				content = `${systemContent}\n\n${content}`
			}

			return {
				role: msg.role,
				content,
			}
		})
	} else {
		// Standard message format for non-o1 models
		messages = options.messages.map((msg) => ({
			role: msg.role,
			content: typeof msg.content === "string" ? msg.content : msg.content[0]?.text || "",
		}))
	}

	const payload: AzureOpenAIPayload = {
		messages,
		max_tokens: options.maxTokens || config.modelMaxTokens,
		// o1/o3 models don't support temperature parameter
		...(isO1Model ? {} : { temperature: options.temperature ?? config.modelTemperature }),
		// o1/o3 models may not support streaming - remove stream parameter for now
		...(isO1Model ? {} : { stream: options.stream || false }),
		// o3 models support reasoning_effort parameter
		...(modelId.startsWith("o3") ? { reasoning_effort: "medium" } : {}),
	}

	// Use either specific model or allowedModels array
	if (options.model) {
		payload.model = options.model
	} else if (config.apiModelId) {
		payload.allowedModels = [config.apiModelId]
	}

	return payload
}

/**
 * Generate Google Gemini payload
 */
function generateGeminiPayload(options: FlowChatCompletionOptions, config: FlowConfig): GeminiPayload {
	// Transform messages to Gemini format
	// Note: Google Gemini doesn't support system messages directly, so we merge them with user messages
	const contents = []
	let systemMessage = ""

	// Extract system message first
	for (const msg of options.messages) {
		if (msg.role === "system") {
			systemMessage = typeof msg.content === "string" ? msg.content : msg.content[0]?.text || ""
		}
	}

	// Process non-system messages
	for (const msg of options.messages) {
		if (msg.role === "system") {
			continue // Skip system messages as they're handled separately
		}

		// Gemini uses "model" role instead of "assistant"
		const role: "user" | "model" = msg.role === "assistant" ? "model" : "user"
		let content = typeof msg.content === "string" ? msg.content : msg.content[0]?.text || ""

		// If this is the first user message and we have a system message, prepend it
		if (role === "user" && contents.length === 0 && systemMessage) {
			content = `${systemMessage}\n\n${content}`
		}

		contents.push({
			parts: [
				{
					text: content,
				},
			],
			role,
		})
	}

	const payload: GeminiPayload = {
		contents,
		generationConfig: {
			maxOutputTokens: options.maxTokens || config.modelMaxTokens,
			temperature: options.temperature ?? config.modelTemperature,
		},
		// Note: Google Gemini API does not support the 'stream' field
		// Streaming is handled at the HTTP level, not in the payload
	}

	// Use either specific model or allowedModels array
	if (options.model) {
		payload.model = options.model
	} else if (config.apiModelId) {
		payload.allowedModels = [config.apiModelId]
	}

	return payload
}

/**
 * Check if model is Amazon Nova family
 */
function isNovaModel(modelId: string): boolean {
	return modelId.startsWith("amazon.nova-")
}

/**
 * Generate Amazon Bedrock payload
 */
function generateBedrockPayload(options: FlowChatCompletionOptions, config: FlowConfig): BedrockPayload {
	const modelId = options.model || config.apiModelId || "anthropic.claude-3-sonnet"
	const isNova = isNovaModel(modelId)

	// Extract system message if present
	let systemMessage = ""
	const userMessages = []

	for (const msg of options.messages) {
		if (msg.role === "system") {
			systemMessage = typeof msg.content === "string" ? msg.content : msg.content[0]?.text || ""
		} else {
			userMessages.push({
				role: msg.role === "assistant" ? "assistant" as const : "user" as const,
				content: [
					{
						type: "text" as const,
						text: typeof msg.content === "string" ? msg.content : msg.content[0]?.text || "",
					},
				],
			})
		}
	}

	const payload: BedrockPayload = {
		allowedModels: [modelId],
		messages: userMessages,
		// Only add anthropic_version for Anthropic models, not for Nova
		...(isNova ? {} : { anthropic_version: "bedrock-2023-05-31" }),
		max_tokens: options.maxTokens || config.modelMaxTokens || 8192,
		temperature: options.temperature ?? config.modelTemperature,
		// Note: Amazon Bedrock API may not support the 'stream' field in the payload
		// Streaming is handled at the HTTP level, not in the payload
		// stream: options.stream || false,
	}

	// Add system message if present (for both Anthropic and Nova models)
	if (systemMessage) {
		payload.system = systemMessage
	}

	return payload
}

/**
 * Generate Azure Foundry payload (DeepSeek-R1)
 */
function generateFoundryPayload(options: FlowChatCompletionOptions, config: FlowConfig): FoundryPayload {
	// DeepSeek-R1 requires specific format with instruction markers
	const messages = []

	for (const msg of options.messages) {
		let content = typeof msg.content === "string" ? msg.content : msg.content[0]?.text || ""

		// For DeepSeek-R1, format the content with instruction markers
		if (msg.role === "system" || msg.role === "user") {
			// Combine system and user messages into a single formatted message
			if (msg.role === "system") {
				content = `You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and your role is to assist with questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will not answer.\n### Instruction:\n${content}\n### Response:\n`
			} else {
				// If there's already a system message, append to it; otherwise create new instruction format
				const lastMessage = messages[messages.length - 1]
				if (lastMessage && lastMessage.content.includes("### Instruction:")) {
					// Append to existing instruction
					lastMessage.content = lastMessage.content.replace(
						"### Response:\n",
						`${content}\n### Response:\n`,
					)
					continue
				} else {
					content = `You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and your role is to assist with questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will not answer.\n### Instruction:\n${content}\n### Response:\n`
				}
			}
		}

		messages.push({
			role: msg.role === "system" ? "user" : msg.role,
			content,
		})
	}

	const payload: FoundryPayload = {
		model: options.model || config.apiModelId || "DeepSeek-R1",
		messages,
		max_tokens: options.maxTokens || config.modelMaxTokens,
		temperature: options.temperature ?? config.modelTemperature,
		stream: options.stream || false,
	}

	return payload
}

/**
 * Generate embedding payload for Azure OpenAI
 * @param input Text input for embedding
 * @param model Embedding model to use
 * @param user User identifier
 * @returns Embedding payload
 */
export function generateEmbeddingPayload(
	input: string | string[],
	model = "text-embedding-3-small",
	user = "flow",
): any {
	return {
		input,
		user,
		allowedModels: [model],
	}
}

/**
 * Validate payload before sending to API
 * @param provider FlowProvider type
 * @param payload Provider payload
 * @throws Error if payload is invalid
 */
export function validatePayload(provider: FlowProvider, payload: ProviderPayload): void {
	switch (provider) {
		case "azure-openai":
			validateAzureOpenAIPayload(payload as AzureOpenAIPayload)
			break
		case "google-gemini":
			validateGeminiPayload(payload as GeminiPayload)
			break
		case "amazon-bedrock":
			validateBedrockPayload(payload as BedrockPayload)
			break
		case "azure-foundry":
			validateFoundryPayload(payload as FoundryPayload)
			break
		default:
			throw new Error(`Unknown provider for validation: ${provider}`)
	}
}

function validateAzureOpenAIPayload(payload: AzureOpenAIPayload): void {
	if (!payload.messages || payload.messages.length === 0) {
		throw new Error("Azure OpenAI payload must have at least one message")
	}
	if (!payload.model && !payload.allowedModels) {
		throw new Error("Azure OpenAI payload must specify either model or allowedModels")
	}
}

function validateGeminiPayload(payload: GeminiPayload): void {
	if (!payload.contents || payload.contents.length === 0) {
		throw new Error("Gemini payload must have at least one content item")
	}
	if (!payload.model && !payload.allowedModels) {
		throw new Error("Gemini payload must specify either model or allowedModels")
	}
}

function validateBedrockPayload(payload: BedrockPayload): void {
	if (!payload.messages || payload.messages.length === 0) {
		throw new Error("Bedrock payload must have at least one message")
	}
	if (!payload.allowedModels || payload.allowedModels.length === 0) {
		throw new Error("Bedrock payload must specify allowedModels")
	}
	// anthropic_version is optional - only required for Anthropic models, not for Nova
	// if (!payload.anthropic_version) {
	//     throw new Error("Bedrock payload must specify anthropic_version")
	// }
}

function validateFoundryPayload(payload: FoundryPayload): void {
	if (!payload.messages || payload.messages.length === 0) {
		throw new Error("Foundry payload must have at least one message")
	}
	if (!payload.model) {
		throw new Error("Foundry payload must specify model")
	}
}
