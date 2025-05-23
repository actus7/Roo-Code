import { ChatCompletionResponse, ChatCompletionChunk } from "../providers/flow/types"

export interface FlowFormatOptions {
	preserveMetadata?: boolean
	includeUsage?: boolean
	includeSafety?: boolean
}

interface FlowFormattedResponse {
	content: string
	usage?: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
	safetyRatings?: {
		category: string
		probability: number
	}[]
	metadata?: Record<string, unknown>
}

interface BaseResponse {
	content?: string
	message?: {
		content: string
	}
	usage?: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
	metadata?: Record<string, unknown>
}

interface SafetyRating {
	category: string
	probability: number
}

interface ContentFilter {
	type: string
	score: number
}

interface ProviderResponse extends BaseResponse {
	provider?: string
	model?: string
	temperature?: number
	safety_ratings?: SafetyRating[]
	contentFilters?: ContentFilter[]
}

/**
 * Remove tags específicas do conteúdo (ex: tags think do DeepSeek)
 */
function cleanContent(content: string): string {
	return content
		.replace(/<think>.*?<\/think>/gs, "")
		.replace(/<\/?attempt_completion>/g, "")
		.trim()
}

/**
 * Extrai métricas de uso de tokens das diferentes respostas dos provedores
 */
function extractUsage(response: ProviderResponse): FlowFormattedResponse["usage"] {
	if (response.usage) {
		return {
			promptTokens: response.usage.promptTokens,
			completionTokens: response.usage.completionTokens,
			totalTokens: response.usage.totalTokens,
		}
	}
	return undefined
}

/**
 * Mapeia classificações de conteúdo/segurança dos diferentes provedores
 */
function extractSafetyRatings(response: ProviderResponse): FlowFormattedResponse["safetyRatings"] {
	if (response.safety_ratings) {
		return response.safety_ratings.map((rating) => ({
			category: rating.category,
			probability: rating.probability,
		}))
	}

	if (response.contentFilters) {
		return response.contentFilters.map((filter) => ({
			category: filter.type,
			probability: filter.score,
		}))
	}

	return undefined
}

/**
 * Formata uma resposta do Flow Provider para o formato padrão do VSCode Language Model
 */
export function formatFlowChatResponse(
	response: ChatCompletionResponse & ProviderResponse,
	options: FlowFormatOptions = {},
): FlowFormattedResponse {
	const formatted: FlowFormattedResponse = {
		content: cleanContent(response.content || response.message?.content || ""),
	}

	if (options.includeUsage) {
		formatted.usage = extractUsage(response)
	}

	if (options.includeSafety) {
		formatted.safetyRatings = extractSafetyRatings(response)
	}

	if (options.preserveMetadata) {
		formatted.metadata = {
			provider: response.provider,
			model: response.model,
			temperature: response.temperature,
			...response.metadata,
		}
	}

	return formatted
}

interface StreamDelta {
	content?: string
}

interface StreamChoice {
	delta?: StreamDelta
}

interface StreamResponse {
	delta?: StreamDelta
	choices?: StreamChoice[]
}

/**
 * Formata um chunk de streaming do Flow Provider para o formato padrão
 */
export function formatFlowChatChunk(chunk: ChatCompletionChunk & StreamResponse): string {
	if ("delta" in chunk && chunk.delta?.content) {
		return cleanContent(chunk.delta.content)
	}

	if ("choices" in chunk && chunk.choices?.[0]?.delta?.content) {
		return cleanContent(chunk.choices[0].delta.content)
	}

	return ""
}

/* Example usage:
const response = await flowProvider.createChatCompletion(...);
const formatted = formatFlowChatResponse(response, {
  includeUsage: true,
  includeSafety: true,
  preserveMetadata: true
});

// For streaming:
for await (const chunk of flowProvider.createChatCompletionStream(...)) {
  const formattedChunk = formatFlowChatChunk(chunk);
  // Process chunk...
}
*/
