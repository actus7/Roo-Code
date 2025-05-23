import type { Anthropic } from "@anthropic-ai/sdk"
import type { ApiStreamChunk } from "../transform/stream"
import type { ModelInfo } from "../../shared/api"
import { BaseProvider } from "./base-provider"
import { flowModels } from "../../shared/api/models"

import type {
	FlowConfig,
	Model,
	Message,
	FlowRequestOptions,
	FlowChatCompletionOptions,
	ChatCompletionResponse,
	ChatCompletionChunk,
	FlowEmbeddingOptions,
	EmbeddingResponse,
} from "./flow/types"
import { initializeFlowConfig } from "./flow/config"
import { authenticate } from "./flow/auth"
import { makeRequestWithRetry } from "./flow/request-utils"
import { generateProviderPayload } from "./flow/payload-generator"
import {
	determineProvider,
	getProviderEndpoint,
	transformModelData,
	transformChatResponse,
	transformStreamChunk,
} from "./flow/model-utils"
import { debug } from "./flow/utils"

export class FlowHandler extends BaseProvider {
	private config: FlowConfig
	private token: string | null = null
	private tokenExpiry: number = 0

	constructor(config: Partial<FlowConfig>) {
		super()

		const fullConfig = initializeFlowConfig(config)
		if (!fullConfig.flowTenant || !fullConfig.flowClientId || !fullConfig.flowClientSecret) {
			throw new Error(
				"FlowProvider: Missing required configuration parameters (flowTenant, flowClientId, or flowClientSecret)",
			)
		}
		this.config = fullConfig as FlowConfig
	}

	private async ensureValidToken(): Promise<string> {
		if (!this.token || Date.now() >= this.tokenExpiry - 60000) {
			await this.authenticateInternal()
		}
		return this.token!
	}

	private async authenticateInternal(): Promise<void> {
		const authResponse = await authenticate(this.config)
		this.token = authResponse.token
		this.tokenExpiry = Date.now() + authResponse.expiresIn * 1000
		debug("Flow authentication successful")
	}

	async listModels(options?: FlowRequestOptions): Promise<Model[]> {
		const token = await this.ensureValidToken()

		const url = `${this.config.apiUrl}/ai-orchestration-api/v1/models/${options?.providerName || "azure-openai"}`
		const params = options?.capabilities ? `?capabilities=${options.capabilities.join(",")}` : ""

		const response = await makeRequestWithRetry(`${url}${params}`, {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${token}`,
				FlowTenant: this.config.flowTenant,
			} as HeadersInit,
		})

		if (!response.ok) {
			throw new Error(`Failed to list models: ${response.statusText}`)
		}

		const data = await response.json()
		return data.map(transformModelData)
	}

	async createChatCompletion(options: FlowChatCompletionOptions): Promise<ChatCompletionResponse> {
		const token = await this.ensureValidToken()

		const provider = determineProvider(options.model || this.config.apiModelId!)
		const endpoint = getProviderEndpoint(provider)
		const payload = generateProviderPayload(provider, options, this.config)

		const response = await makeRequestWithRetry(`${this.config.apiUrl}${endpoint}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: `Bearer ${token}`,
				FlowTenant: this.config.flowTenant,
				FlowAgent: this.config.flowAgent,
			} as HeadersInit,
			body: JSON.stringify(payload),
			timeout: this.config.flowRequestTimeout,
		})

		if (!response.ok) {
			throw new Error(`Chat completion failed: ${response.statusText}`)
		}

		const data = await response.json()
		return transformChatResponse(provider, data)
	}

	async createEmbedding(options: FlowEmbeddingOptions): Promise<EmbeddingResponse> {
		const token = await this.ensureValidToken()

		const model = options.model || this.config.apiModelId || "text-embedding-3-small"
		const endpoint = `${this.config.apiUrl}/ai-orchestration-api/v1/openai/embeddings`
		const payload = {
			input: options.input,
			user: options.user || "flow",
			allowedModels: [model],
		}

		const response = await makeRequestWithRetry(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: `Bearer ${token}`,
				FlowTenant: this.config.flowTenant,
				FlowAgent: this.config.flowAgent,
				"x-ms-model-mesh-model-name": model,
			} as HeadersInit,
			body: JSON.stringify(payload),
			timeout: this.config.flowRequestTimeout,
		})

		if (!response.ok) {
			throw new Error(`Embedding generation failed: ${response.statusText}`)
		}

		return response.json()
	}

	async *streamChatCompletion(options: FlowChatCompletionOptions): AsyncIterableIterator<ChatCompletionChunk> {
		const token = await this.ensureValidToken()

		const provider = determineProvider(options.model || this.config.apiModelId!)
		const endpoint = getProviderEndpoint(provider)
		const payload = generateProviderPayload(provider, { ...options, stream: true }, this.config)

		const response = await makeRequestWithRetry(`${this.config.apiUrl}${endpoint}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: `Bearer ${token}`,
				FlowTenant: this.config.flowTenant,
				FlowAgent: this.config.flowAgent,
			} as HeadersInit,
			body: JSON.stringify(payload),
			timeout: this.config.flowRequestTimeout,
		})

		if (!response.ok || !response.body) {
			throw new Error(`Stream chat completion failed: ${response.statusText}`)
		}

		const reader = response.body.getReader()
		const decoder = new TextDecoder()

		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				const chunk = decoder.decode(value)
				const lines = chunk.split("\n").filter((line) => line.trim() !== "")

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6)
						if (data === "[DONE]") continue

						try {
							const parsedChunk = JSON.parse(data)
							yield transformStreamChunk(provider, parsedChunk)
						} catch (error) {
							debug(`Error parsing stream chunk: ${error.message}`)
						}
					}
				}
			}
		} finally {
			reader.releaseLock()
		}
	}

	// Implementações da BaseProvider
	getModel(): { id: string; info: ModelInfo } {
		const modelId = this.config.apiModelId || "gpt-4"

		// Verificar se o modelo existe no dicionário de modelos
		if (flowModels[modelId]) {
			return {
				id: modelId,
				info: flowModels[modelId],
			}
		}

		// Se o modelo não existir, usar gpt-4 como fallback
		const fallbackModelId = "gpt-4"
		return {
			id: fallbackModelId,
			info: flowModels[fallbackModelId] || {
				maxTokens: 8192,
				contextWindow: 8192,
				supportsImages: false,
				supportsPromptCache: false,
				supportsComputerUse: false,
			},
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): AsyncGenerator<ApiStreamChunk> {
		type ValidRole = "system" | "assistant" | "function" | "user"
		const isValidRole = (role: string): role is ValidRole =>
			["system", "assistant", "function", "user"].includes(role)

		/**
		 * Extrai o conteúdo textual de forma mais robusta a partir de diferentes formatos de mensagem
		 */
		const normalizeContent = (content: string | Anthropic.Messages.ContentBlockParam[]): string => {
			if (typeof content === "string") return content
			if (!Array.isArray(content) || content.length === 0) return ""

			// Processa todos os blocos de conteúdo e concatena texto
			return content
				.filter((block) => "type" in block && block.type === "text")
				.map((block) => ("text" in block ? block.text : ""))
				.join("\n")
				.trim()
		}

		const mapToFlowMessage = (msg: Anthropic.Messages.MessageParam): Message => ({
			role: isValidRole(msg.role) ? msg.role : "user",
			content: normalizeContent(msg.content),
		})

		const flowMessages: Message[] = messages.map(mapToFlowMessage)

		flowMessages.unshift({ role: "system", content: systemPrompt })

		const flowOptions: FlowChatCompletionOptions = {
			model: this.config.apiModelId || "gpt-4",
			messages: flowMessages,
			stream: true,
		}

		const stream = this.streamChatCompletion(flowOptions)

		try {
			// Estimativa mais precisa de tokens de entrada usando uma heurística básica
			const estimateInputTokens = (message: Message): number => {
				// Aproximadamente 1 token para cada 4 caracteres em inglês, ajustando para outras línguas
				return Math.ceil(message.content.length / 3)
			}

			let totalInputTokens = flowMessages.reduce((acc, msg) => acc + estimateInputTokens(msg), 0)
			let totalOutputTokens = 0
			let _totalChunks = 0

			for await (const chunk of stream) {
				const content = chunk.choices?.[0]?.delta?.content
				if (typeof content === "string" && content.length > 0) {
					totalOutputTokens += Math.ceil(content.length / 3) // Estimativa de tokens
					_totalChunks++
					yield { type: "text", text: content }
				}
			}

			// Calcular tokens de raciocínio baseado no modelo usado
			let reasoningTokensEstimate: number
			const modelId = this.config.apiModelId || "gpt-4"

			// Diferentes modelos têm diferentes proporções de tokens de raciocínio
			if (modelId.includes("gpt-4")) {
				reasoningTokensEstimate = Math.round(totalOutputTokens * 0.25) // ~25% para GPT-4
			} else if (modelId.includes("claude")) {
				reasoningTokensEstimate = Math.round(totalOutputTokens * 0.2) // ~20% para Claude
			} else {
				reasoningTokensEstimate = Math.round(totalOutputTokens * 0.15) // ~15% para outros modelos
			}

			// Emitir informações de uso
			const usageChunk: ApiStreamChunk = {
				type: "usage",
				inputTokens: totalInputTokens,
				outputTokens: totalOutputTokens,
				reasoningTokens: reasoningTokensEstimate,
			}

			yield usageChunk
		} catch (error) {
			debug(`Error in FlowHandler.createMessage: ${error}`)
			throw new Error(`Flow API error: ${error}`)
		}
	}
}
