import type { FlowProvider, Model, ChatCompletionResponse, ChatCompletionChunk } from "./types"
import { MODEL_PROVIDER_MAP, PROVIDER_ENDPOINTS, DEFAULT_MODELS } from "./config"
import { debug } from "./utils"

/**
 * Determine the provider for a given model ID
 * @param modelId Model identifier
 * @returns FlowProvider type
 */
export function determineProvider(modelId: string): FlowProvider {
	const provider = MODEL_PROVIDER_MAP[modelId as keyof typeof MODEL_PROVIDER_MAP]

	if (!provider) {
		debug(`Unknown model ${modelId}, defaulting to azure-openai`)
		return "azure-openai"
	}

	return provider as FlowProvider
}

/**
 * Get the API endpoint for a specific provider
 * @param provider FlowProvider type
 * @returns API endpoint path
 */
export function getProviderEndpoint(provider: FlowProvider): string {
	return PROVIDER_ENDPOINTS[provider]
}

/**
 * Get the default model for a provider
 * @param provider FlowProvider type
 * @returns Default model ID
 */
export function getDefaultModel(provider: FlowProvider): string {
	return DEFAULT_MODELS[provider]
}

/**
 * Transform Flow API model data to standard format
 * @param modelData Raw model data from Flow API
 * @returns Transformed Model object
 */
export function transformModelData(modelData: any): Model {
	return {
		id: modelData.id || modelData.name,
		name: modelData.name || modelData.id,
		provider: modelData.provider || "unknown",
		capabilities: modelData.capabilities || [],
		inputTokens: modelData.inputTokens || modelData.contextWindow,
		outputTokens: modelData.outputTokens || modelData.maxTokens,
		contextWindow: modelData.contextWindow || modelData.inputTokens,
		description: modelData.description,
	}
}

/**
 * Transform provider-specific chat response to standard format
 * @param provider FlowProvider type
 * @param response Raw response from provider
 * @returns Standardized ChatCompletionResponse
 */
export function transformChatResponse(provider: FlowProvider, response: any): ChatCompletionResponse {
	switch (provider) {
		case "azure-openai":
			return transformAzureOpenAIResponse(response)
		case "google-gemini":
			return transformGeminiResponse(response)
		case "amazon-bedrock":
			return transformBedrockResponse(response)
		case "azure-foundry":
			return transformFoundryResponse(response)
		default:
			throw new Error(`Unsupported provider for response transformation: ${provider}`)
	}
}

/**
 * Transform Azure OpenAI response to standard format
 */
function transformAzureOpenAIResponse(response: any): ChatCompletionResponse {
	return {
		id: response.id,
		object: response.object || "chat.completion",
		created: response.created || Date.now(),
		model: response.model,
		choices: response.choices.map((choice: any) => ({
			index: choice.index,
			message: {
				role: choice.message.role,
				content: choice.message.content,
			},
			finish_reason: choice.finish_reason,
		})),
		usage: response.usage,
	}
}

/**
 * Transform Google Gemini response to standard format
 */
function transformGeminiResponse(response: any): ChatCompletionResponse {
	const content = response.candidates?.[0]?.content?.parts?.[0]?.text || ""

	return {
		id: response.responseId || `gemini-${Date.now()}`,
		object: "chat.completion",
		created: response.createTime ? new Date(response.createTime).getTime() : Date.now(),
		model: response.modelVersion || "gemini-2.0-flash",
		choices: [
			{
				index: 0,
				message: {
					role: "assistant",
					content,
				},
				finish_reason: response.candidates?.[0]?.finishReason === "STOP" ? "stop" : "length",
			},
		],
		usage: response.usageMetadata ? {
			prompt_tokens: response.usageMetadata.promptTokenCount,
			completion_tokens: response.usageMetadata.candidatesTokenCount,
			total_tokens: response.usageMetadata.totalTokenCount,
		} : undefined,
	}
}

/**
 * Transform Amazon Bedrock response to standard format
 */
function transformBedrockResponse(response: any): ChatCompletionResponse {
	const content = response.content?.[0]?.text || ""

	return {
		id: response.id || `bedrock-${Date.now()}`,
		object: "chat.completion",
		created: Date.now(),
		model: response.model || "anthropic.claude-3-sonnet",
		choices: [
			{
				index: 0,
				message: {
					role: "assistant",
					content,
				},
				finish_reason: response.stop_reason === "end_turn" ? "stop" : "length",
			},
		],
		usage: response.usage ? {
			prompt_tokens: response.usage.input_tokens,
			completion_tokens: response.usage.output_tokens,
			total_tokens: response.usage.input_tokens + response.usage.output_tokens,
		} : undefined,
	}
}

/**
 * Transform Azure Foundry response to standard format
 */
function transformFoundryResponse(response: any): ChatCompletionResponse {
	// Handle DeepSeek-R1 specific format with <think> tags
	let content = response.choices?.[0]?.message?.content || ""

	// Remove <think></think> tags for user display
	content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim()

	return {
		id: response.id,
		object: response.object || "chat.completion",
		created: response.created || Date.now(),
		model: response.model,
		choices: response.choices.map((choice: any) => ({
			index: choice.index,
			message: {
				role: choice.message.role,
				content,
			},
			finish_reason: choice.finish_reason,
		})),
		usage: response.usage,
	}
}

/**
 * Transform provider-specific streaming chunk to standard format
 * @param provider FlowProvider type
 * @param chunk Raw streaming chunk from provider
 * @returns Standardized ChatCompletionChunk
 */
export function transformStreamChunk(provider: FlowProvider, chunk: any): ChatCompletionChunk {
	switch (provider) {
		case "azure-openai":
		case "azure-foundry":
			return transformOpenAIStreamChunk(chunk)
		case "google-gemini":
			return transformGeminiStreamChunk(chunk)
		case "amazon-bedrock":
			return transformBedrockStreamChunk(chunk)
		default:
			throw new Error(`Unsupported provider for stream transformation: ${provider}`)
	}
}

/**
 * Transform OpenAI-compatible streaming chunk
 */
function transformOpenAIStreamChunk(chunk: any): ChatCompletionChunk {
	// Handle different OpenAI response formats
	let choices = []

	if (chunk.choices && Array.isArray(chunk.choices)) {
		choices = chunk.choices.map((choice: any) => {
			let content = ""
			let finishReason = choice.finish_reason

			// Standard streaming format
			if (choice.delta?.content) {
				content = choice.delta.content
			}

			// Complete response format (non-streaming)
			if (choice.message?.content) {
				content = choice.message.content
			}

			return {
				index: choice.index || 0,
				delta: {
					role: choice.delta?.role,
					content,
				},
				finish_reason: finishReason,
			}
		})
	} else {
		choices = [{
			index: 0,
			delta: {
				content: "",
			},
			finish_reason: null,
		}]
	}

	const result = {
		id: chunk.id || `openai-${Date.now()}`,
		object: chunk.object || "chat.completion.chunk",
		created: chunk.created || Date.now(),
		model: chunk.model || "gpt-4o-mini",
		choices,
	}

	return result
}

/**
 * Transform Gemini streaming chunk
 */
function transformGeminiStreamChunk(chunk: any): ChatCompletionChunk {
	const content = chunk.candidates?.[0]?.content?.parts?.[0]?.text || ""

	return {
		id: `gemini-${Date.now()}`,
		object: "chat.completion.chunk",
		created: Date.now(),
		model: "gemini-2.0-flash",
		choices: [
			{
				index: 0,
				delta: {
					content,
				},
				finish_reason: chunk.candidates?.[0]?.finishReason === "STOP" ? "stop" : undefined,
			},
		],
	}
}

/**
 * Transform Bedrock streaming chunk
 */
function transformBedrockStreamChunk(chunk: any): ChatCompletionChunk {
	// Try different possible content paths for Bedrock
	let content = ""
	let finishReason: string | undefined = undefined

	// Handle different Bedrock response formats
	if (chunk.type === "content_block_delta" && chunk.delta?.text) {
		// Standard Anthropic streaming format
		content = chunk.delta.text
	} else if (chunk.type === "message_delta" && chunk.delta?.stop_reason) {
		// Message completion
		finishReason = chunk.delta.stop_reason === "end_turn" ? "stop" : chunk.delta.stop_reason
	} else if (chunk.delta?.text) {
		// Generic delta format
		content = chunk.delta.text
	} else if (chunk.content?.[0]?.text) {
		// Content array format
		content = chunk.content[0].text
	} else if (chunk.text) {
		// Direct text format
		content = chunk.text
	} else if (chunk.type === "message_stop") {
		// Message stop - final chunk
		finishReason = "stop"
	}

	// Use existing stop_reason if no finishReason was set
	if (!finishReason && chunk.stop_reason) {
		finishReason = chunk.stop_reason === "end_turn" ? "stop" : chunk.stop_reason
	}

	const result = {
		id: `bedrock-${Date.now()}`,
		object: "chat.completion.chunk",
		created: Date.now(),
		model: "anthropic.claude-3-sonnet",
		choices: [
			{
				index: 0,
				delta: {
					content,
				},
				finish_reason: finishReason,
			},
		],
	}

	return result
}
