import { Model, ChatCompletionResponse, ChatCompletionChunk, Message } from "./types"

/**
 * Determina o provedor baseado no ID do modelo
 * @param modelId ID do modelo
 * @returns Nome do provedor
 */
export function determineProvider(modelId: string): string {
	// Azure OpenAI models
	if (modelId.startsWith("gpt-") || modelId.startsWith("o3-")) {
		return "azure-openai"
	}

	// Google Gemini models
	if (modelId.startsWith("gemini-")) {
		return "google-gemini"
	}

	// Amazon Bedrock models
	if (modelId.startsWith("anthropic.") || modelId.startsWith("amazon.") || modelId.startsWith("meta.llama")) {
		return "amazon-bedrock"
	}

	// Azure Foundry models
	if (modelId.startsWith("DeepSeek-")) {
		return "azure-foundry"
	}

	// Default to azure-openai if no match
	return "azure-openai"
}

/**
 * Retorna o endpoint da API de chat completions para o provedor especificado
 * @param provider Nome do provedor
 * @returns Endpoint da API
 */
export function getProviderEndpoint(provider: string): string {
	switch (provider) {
		case "azure-openai":
			return "/ai-orchestration-api/v1/openai/chat/completions"
		case "google-gemini":
			return "/ai-orchestration-api/v1/google/generateContent"
		case "amazon-bedrock":
			return "/ai-orchestration-api/v1/bedrock/invoke"
		case "azure-foundry":
			return "/ai-orchestration-api/v1/foundry/chat/completions"
		default:
			throw new Error(`Provider não suportado: ${provider}`)
	}
}

/**
 * Transforma dados brutos do modelo em um objeto Model
 * @param apiModelData Dados brutos do modelo da API
 * @returns Objeto Model formatado
 */
export function transformModelData(apiModelData: any): Model {
	return {
		id: apiModelData.id,
		provider: determineProvider(apiModelData.id),
		inputTokens: apiModelData.contextLength || apiModelData.inputTokens || 0,
		capabilities: apiModelData.capabilities || [],
		deprecated: apiModelData.deprecated || false,
	}
}

/**
 * Transforma uma mensagem para o formato esperado pelo Azure OpenAI
 * @param message Mensagem a ser transformada
 * @returns Objeto com role e content
 */
export function transformMessage(message: Message): { role: string; content: string } {
	// Se for a primeira mensagem e for system, pode usar assistant
	if (message.role === "system") {
		return {
			role: "assistant",
			content: message.content,
		}
	}

	return {
		role: message.role,
		content: message.content,
	}
}

/**
 * Transforma array de mensagens para o formato do Gemini
 * @param messages Array de mensagens
 * @returns Array no formato do Gemini
 */
export function transformMessagesToGeminiFormat(messages: Message[]): any[] {
	return messages.map((message) => ({
		parts: [{ text: message.content }],
		role: "user", // Gemini usa "user" para todas as mensagens
	}))
}

/**
 * Transforma array de mensagens para o formato do Bedrock
 * @param messages Array de mensagens
 * @returns Array no formato do Bedrock
 */
export function transformMessagesToBedrockFormat(messages: Message[]): any[] {
	return messages
		.filter((message) => message.role !== "system") // Remove system messages
		.map((message) => ({
			role: message.role,
			content: [{ type: "text", text: message.content }],
		}))
}

/**
 * Extrai a mensagem de sistema do array de mensagens
 * @param messages Array de mensagens
 * @returns Conteúdo da mensagem de sistema ou undefined
 */
export function extractSystemMessage(messages: Message[]): string | undefined {
	const systemMessage = messages.find((msg) => msg.role === "system")
	return systemMessage?.content
}

/**
 * Transforma a resposta da API do provedor em um formato padronizado
 * @param provider Nome do provedor
 * @param apiResponseData Dados da resposta da API
 * @returns Resposta padronizada
 */
export function transformChatResponse(provider: string, apiResponseData: any): ChatCompletionResponse {
	switch (provider) {
		case "azure-openai":
			return {
				id: apiResponseData.id,
				object: apiResponseData.object,
				created: apiResponseData.created,
				model: apiResponseData.model,
				choices: apiResponseData.choices.map((choice: any) => ({
					index: choice.index,
					message: choice.message,
					finishReason: choice.finish_reason,
				})),
				usage: {
					promptTokens: apiResponseData.usage.prompt_tokens,
					completionTokens: apiResponseData.usage.completion_tokens,
					totalTokens: apiResponseData.usage.total_tokens,
				},
				systemFingerprint: apiResponseData.system_fingerprint,
			}

		case "azure-foundry":
			return {
				id: apiResponseData.id,
				object: apiResponseData.object,
				created: apiResponseData.created,
				model: apiResponseData.model,
				choices: apiResponseData.choices.map((choice: any) => {
					// Limpa as tags think do conteúdo da mensagem
					const message = { ...choice.message }
					if (message.content && typeof message.content === "string") {
						message.content = message.content.replace(/<think>[\s\S]*?<\/think>\n*/g, "").trim()
					}
					return {
						index: choice.index,
						message,
						finishReason: choice.finish_reason,
					}
				}),
				usage: {
					promptTokens: apiResponseData.usage.prompt_tokens,
					completionTokens: apiResponseData.usage.completion_tokens,
					totalTokens: apiResponseData.usage.total_tokens,
				},
				systemFingerprint: apiResponseData.system_fingerprint,
			}

		case "google-gemini":
			return {
				id: apiResponseData.responseId,
				object: "chat.completion",
				created: new Date(apiResponseData.createTime).getTime(),
				model: apiResponseData.modelVersion,
				choices: apiResponseData.candidates.map((candidate: any, index: number) => ({
					index,
					message: {
						role: "assistant",
						content: candidate.content.parts[0].text,
					},
					finishReason: candidate.finishReason.toLowerCase(),
				})),
				usage: {
					promptTokens: apiResponseData.usageMetadata.promptTokenCount,
					completionTokens: apiResponseData.usageMetadata.candidatesTokenCount,
					totalTokens: apiResponseData.usageMetadata.totalTokenCount,
				},
			}

		case "amazon-bedrock":
			return {
				id: apiResponseData.id,
				object: "chat.completion",
				created: new Date().getTime(),
				model: apiResponseData.model,
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: apiResponseData.content[0].text,
						},
						finishReason: apiResponseData.stop_reason === "end_turn" ? "stop" : apiResponseData.stop_reason,
					},
				],
				usage: {
					promptTokens: apiResponseData.usage.input_tokens,
					completionTokens: apiResponseData.usage.output_tokens,
					totalTokens: apiResponseData.usage.input_tokens + apiResponseData.usage.output_tokens,
				},
			}

		default:
			throw new Error(`Provider não suportado: ${provider}`)
	}
}

/**
 * Transforma um chunk de streaming em um formato padronizado
 * @param provider Nome do provedor
 * @param apiChunkData Dados do chunk
 * @returns Chunk padronizado
 */
export function transformStreamChunk(provider: string, apiChunkData: any): ChatCompletionChunk {
	switch (provider) {
		case "azure-openai":
			return {
				id: apiChunkData.id,
				object: apiChunkData.object,
				created: apiChunkData.created,
				model: apiChunkData.model,
				choices: apiChunkData.choices.map((choice: any) => ({
					index: choice.index,
					delta: choice.delta,
					finishReason: choice.finish_reason,
				})),
			}

		case "azure-foundry":
			return {
				id: apiChunkData.id,
				object: apiChunkData.object,
				created: apiChunkData.created,
				model: apiChunkData.model,
				choices: apiChunkData.choices.map((choice: any) => {
					// Limpa as tags think do conteúdo do delta
					const delta = { ...choice.delta }
					if (delta.content && typeof delta.content === "string") {
						delta.content = delta.content.replace(/<think>[\s\S]*?<\/think>\n*/g, "").trim()
					}
					return {
						index: choice.index,
						delta,
						finishReason: choice.finish_reason,
					}
				}),
			}

		case "google-gemini":
			return {
				id: apiChunkData.responseId,
				object: "chat.completion.chunk",
				created: new Date().getTime(),
				model: apiChunkData.modelVersion,
				choices: [
					{
						index: 0,
						delta: {
							content: apiChunkData.candidates[0]?.content?.parts[0]?.text,
						},
						finishReason: apiChunkData.candidates[0]?.finishReason?.toLowerCase() || null,
					},
				],
			}

		case "amazon-bedrock":
			return {
				id: apiChunkData.id,
				object: "chat.completion.chunk",
				created: new Date().getTime(),
				model: apiChunkData.model,
				choices: [
					{
						index: 0,
						delta: {
							content: apiChunkData.content[0]?.text,
						},
						finishReason: apiChunkData.stop_reason === "end_turn" ? "stop" : apiChunkData.stop_reason,
					},
				],
			}

		default:
			throw new Error(`Provider não suportado: ${provider}`)
	}
}

/**
 * Interface para os requisitos de seleção de modelo
 */
interface ModelSelectionRequirements {
	maxContextLength?: number
	capabilities?: string[]
	preferredProvider?: string
	priority?: "speed" | "quality" | "cost"
}

/**
 * Ordena modelos por velocidade (prioriza modelos mais rápidos)
 */
function sortModelsBySpeed(models: Model[]): Model[] {
	return models.sort((a, b) => {
		const aSpeed = a.id.toLowerCase().includes("flash") || a.id.toLowerCase().includes("mini") ? 1 : 0
		const bSpeed = b.id.toLowerCase().includes("flash") || b.id.toLowerCase().includes("mini") ? 1 : 0
		return bSpeed - aSpeed
	})
}

/**
 * Ordena modelos por qualidade (prioriza modelos mais avançados)
 */
function sortModelsByQuality(models: Model[]): Model[] {
	return models.sort((a, b) => {
		const qualityScore = (id: string) => {
			if (id.includes("gpt-4")) return 4
			if (id.includes("claude-3")) return 3
			if (id.includes("gemini-2.5-pro")) return 2
			return 1
		}
		return qualityScore(b.id) - qualityScore(a.id)
	})
}

/**
 * Ordena modelos por custo (prioriza modelos mais econômicos)
 */
function sortModelsByCost(models: Model[]): Model[] {
	return models.sort((a, b) => {
		const costScore = (id: string) => {
			if (id.toLowerCase().includes("mini") || id.toLowerCase().includes("flash")) return 0
			if (id.includes("gpt-4")) return 3
			if (id.includes("claude-3")) return 2
			return 1
		}
		return costScore(a.id) - costScore(b.id)
	})
}

/**
 * Seleciona o modelo mais adequado com base nos requisitos fornecidos
 * @param requirements Requisitos para seleção do modelo
 * @param availableModels Lista de modelos disponíveis
 * @returns O modelo mais adequado ou null se nenhum modelo atender aos requisitos
 */
export function selectOptimalModel(requirements: ModelSelectionRequirements, availableModels: Model[]): Model | null {
	// Filtra modelos com base nos requisitos
	let candidates = [...availableModels]

	// Filtra por capabilities se especificado
	if (requirements.capabilities && requirements.capabilities.length > 0) {
		candidates = candidates.filter((model) =>
			requirements.capabilities!.every((cap) => model.capabilities.includes(cap)),
		)
	}

	// Filtra por maxContextLength se especificado
	if (requirements.maxContextLength) {
		candidates = candidates.filter((model) => model.inputTokens >= requirements.maxContextLength!)
	}

	// Filtra por provedor preferido se especificado
	if (requirements.preferredProvider) {
		candidates = candidates.filter((model) => model.provider === requirements.preferredProvider)
	}

	// Se não houver candidatos após os filtros, retorna null
	if (candidates.length === 0) {
		return null
	}

	// Ordena modelos com base na prioridade
	switch (requirements.priority) {
		case "speed":
			return sortModelsBySpeed(candidates)[0]
		case "quality":
			return sortModelsByQuality(candidates)[0]
		case "cost":
			return sortModelsByCost(candidates)[0]
		default:
			return candidates[0] // Retorna o primeiro modelo se não houver prioridade
	}
}
