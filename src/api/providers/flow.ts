import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import type { ApiHandlerCreateMessageMetadata } from "../index"

import { BaseProvider } from "./base-provider"
import { TokenManager } from "./flow/auth"
import { initializeFlowConfig, validateFlowConfig, FLOW_ENDPOINTS } from "./flow/config"
import { makeJsonRequest, makeStreamingRequest, createFlowHeaders, handleHttpError } from "./flow/request-utils"
import { generateProviderPayload, generateEmbeddingPayload, validatePayload } from "./flow/payload-generator"
import {
	determineProvider,
	getProviderEndpoint,
	transformModelData,
	transformChatResponse,
	transformStreamChunk,
} from "./flow/model-utils"
import { debug, parseSSEChunk } from "./flow/utils"
import type {
	FlowConfig,
	FlowChatCompletionOptions,
	FlowEmbeddingOptions,
	FlowRequestOptions,
	Model,
	ChatCompletionResponse,
	EmbeddingResponse,
	ChatCompletionChunk,
} from "./flow/types"

/**
 * Flow Provider Handler
 *
 * Provides unified access to multiple LLM providers through Flow API:
 * - Azure OpenAI (GPT-4, GPT-4O, embeddings)
 * - Google Gemini (2.0 Flash, 2.5 Pro)
 * - Amazon Bedrock (Claude, Nova, Llama)
 * - Azure Foundry (DeepSeek-R1)
 */
export class FlowHandler extends BaseProvider {
	private config: FlowConfig
	private tokenManager: TokenManager

	constructor(options: ApiHandlerOptions) {
		super()

		console.log("🔧 [FlowHandler] Constructor iniciado com options:", {
			flowBaseUrl: options.flowBaseUrl,
			flowTenant: options.flowTenant,
			flowClientId: options.flowClientId,
			hasFlowClientSecret: !!options.flowClientSecret,
			flowAppToAccess: options.flowAppToAccess,
			flowAgent: options.flowAgent,
			apiModelId: options.apiModelId,
		})

		// Initialize configuration with defaults
		const partialConfig: Partial<FlowConfig> = {
			flowBaseUrl: options.flowBaseUrl,
			flowAuthBaseUrl: options.flowAuthBaseUrl,
			flowTenant: options.flowTenant,
			flowClientId: options.flowClientId,
			flowClientSecret: options.flowClientSecret,
			flowAppToAccess: options.flowAppToAccess,
			flowAgent: options.flowAgent,
			apiModelId: options.apiModelId,
			modelTemperature: options.modelTemperature,
			modelMaxTokens: options.modelMaxTokens,
			flowRequestTimeout: options.flowRequestTimeout,
		}

		console.log("⚙️ [FlowHandler] Inicializando configuração...")
		this.config = initializeFlowConfig(partialConfig)
		validateFlowConfig(this.config)

		console.log("🔑 [FlowHandler] Criando TokenManager...")
		this.tokenManager = new TokenManager(this.config)

		console.log("✅ [FlowHandler] Inicialização completa:", {
			baseUrl: this.config.flowBaseUrl,
			tenant: this.config.flowTenant,
			agent: this.config.flowAgent,
			modelId: this.config.apiModelId,
			hasClientId: !!this.config.flowClientId,
			hasClientSecret: !!this.config.flowClientSecret,
		})

		debug("FlowHandler initialized", {
			baseUrl: this.config.flowBaseUrl,
			tenant: this.config.flowTenant,
			agent: this.config.flowAgent,
			modelId: this.config.apiModelId,
		})

		// Log configuration for debugging
		debug("FlowHandler configuration", {
			baseUrl: this.config.flowBaseUrl,
			tenant: this.config.flowTenant,
			agent: this.config.flowAgent,
			modelId: this.config.apiModelId,
			hasClientId: !!this.config.flowClientId,
			hasClientSecret: !!this.config.flowClientSecret,
		})
	}

	/**
	 * Create a chat message with streaming support
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		console.log("🚀 [FlowHandler] createMessage iniciado", {
			systemPromptLength: systemPrompt.length,
			systemPromptPreview: systemPrompt.substring(0, 200) + "...",
			messagesCount: messages.length,
			metadata,
		})

		try {
			const flowMessages = this.convertAnthropicMessages(systemPrompt, messages)
			const model = this.config.apiModelId || "gpt-4o-mini"
			const isO1Model = this.isO1OrO3Model(model)

			console.log("📝 [FlowHandler] Configuração preparada", {
				model,
				isO1Model,
				flowMessagesCount: flowMessages.length,
				config: {
					baseUrl: this.config.flowBaseUrl,
					tenant: this.config.flowTenant,
					agent: this.config.flowAgent,
					hasClientId: !!this.config.flowClientId,
					hasClientSecret: !!this.config.flowClientSecret,
				},
			})

			const options: FlowChatCompletionOptions = {
				model,
				messages: flowMessages,
				maxTokens: this.config.modelMaxTokens,
				// o1 models don't support temperature
				...(isO1Model ? {} : { temperature: this.config.modelTemperature }),
				// Try streaming for o1 models, but be prepared to fallback
				stream: true,
			}

			const provider = determineProvider(model)
			const endpoint = getProviderEndpoint(provider)
			const payload = generateProviderPayload(provider, options, this.config)

			console.log("🔧 [FlowHandler] Payload gerado", {
				provider,
				endpoint,
				payloadKeys: Object.keys(payload),
				url: `${this.config.flowBaseUrl}${endpoint}`,
				payloadPreview: {
					...payload,
					messages: payload.messages?.map((msg: any) => ({
						...msg,
						content: typeof msg.content === 'string'
							? msg.content.substring(0, 200) + '...'
							: msg.content
					}))
				}
			})

			validatePayload(provider, payload)

			console.log("🔑 [FlowHandler] Obtendo token...")
			const token = await this.tokenManager.getValidToken()
			console.log("✅ [FlowHandler] Token obtido com sucesso")

			const headers = createFlowHeaders(token, this.config.flowTenant, this.config.flowAgent, {
				// Additional headers to ensure streaming
				"Cache-Control": "no-cache",
				"Connection": "keep-alive",
			}, true)

			console.log("📡 [FlowHandler] Fazendo requisição streaming", {
				url: `${this.config.flowBaseUrl}${endpoint}`,
				headers: { ...headers, Authorization: "Bearer [REDACTED]" },
				payloadSize: JSON.stringify(payload).length,
				isStreamingRequest: true,
				acceptHeader: headers.Accept,
			})

			debug("Flow request", {
				provider,
				endpoint,
				model,
				url: `${this.config.flowBaseUrl}${endpoint}`,
			})

			const stream = await makeStreamingRequest(
				`${this.config.flowBaseUrl}${endpoint}`,
				{
					method: "POST",
					headers,
					body: JSON.stringify(payload),
					timeout: this.config.flowRequestTimeout,
				},
			)

			console.log("🌊 [FlowHandler] Stream obtido, processando resposta...")
			yield* this.processStreamingResponse(stream, provider)
		} catch (error) {
			console.error("❌ [FlowHandler] Erro no createMessage:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})

			const enhancedError = handleHttpError(error, "Flow chat completion")
			debug("Chat completion error", { error: enhancedError.message })
			throw enhancedError
		}
	}

	/**
	 * Get model information
	 */
	override getModel(): { id: string; info: ModelInfo } {
		const id = this.config.apiModelId || "gpt-4o-mini"

		// Basic model info - in a real implementation, this would come from the models API
		const info: ModelInfo = {
			maxTokens: this.config.modelMaxTokens || 4096,
			contextWindow: 128000,
			supportsImages: true,
			supportsPromptCache: false,
			inputPrice: 0.15,
			outputPrice: 0.6,
		}

		return { id, info }
	}

	/**
	 * List available models for a specific provider
	 */
	async listModels(options?: FlowRequestOptions): Promise<Model[]> {
		try {
			const provider = options?.provider || "azure-openai"
			const capabilities = options?.capabilities || ["chat-conversation"]

			const token = await this.tokenManager.getValidToken()
			const headers = createFlowHeaders(token, this.config.flowTenant, this.config.flowAgent)

			const capabilitiesParam = capabilities.length > 0 ? `?capabilities=${capabilities.join(",")}` : ""
			const url = `${this.config.flowBaseUrl}${FLOW_ENDPOINTS.models}/${provider}${capabilitiesParam}`

			const response = await makeJsonRequest(url, {
				method: "GET",
				headers,
				timeout: this.config.flowRequestTimeout,
			})

			return response.map(transformModelData)
		} catch (error) {
			const enhancedError = handleHttpError(error, "Flow model listing")
			debug("Model listing error", { error: enhancedError.message })
			throw enhancedError
		}
	}

	/**
	 * Create chat completion (non-streaming)
	 */
	async createChatCompletion(options: FlowChatCompletionOptions): Promise<ChatCompletionResponse> {
		try {
			const provider = determineProvider(options.model || this.config.apiModelId || "gpt-4o-mini")
			const endpoint = getProviderEndpoint(provider)
			const payload = generateProviderPayload(provider, { ...options, stream: false }, this.config)

			validatePayload(provider, payload)

			const token = await this.tokenManager.getValidToken()
			const headers = createFlowHeaders(token, this.config.flowTenant, this.config.flowAgent)

			const response = await makeJsonRequest(
				`${this.config.flowBaseUrl}${endpoint}`,
				{
					method: "POST",
					headers,
					body: JSON.stringify(payload),
					timeout: this.config.flowRequestTimeout,
				},
			)

			return transformChatResponse(provider, response)
		} catch (error) {
			const enhancedError = handleHttpError(error, "Flow chat completion")
			debug("Chat completion error", { error: enhancedError.message })
			throw enhancedError
		}
	}

	/**
	 * Create embeddings
	 */
	async createEmbedding(options: FlowEmbeddingOptions): Promise<EmbeddingResponse> {
		try {
			const model = options.model || "text-embedding-3-small"
			const payload = generateEmbeddingPayload(options.input, model, options.user)

			const token = await this.tokenManager.getValidToken()
			const headers = createFlowHeaders(token, this.config.flowTenant, this.config.flowAgent, {
				"x-ms-model-mesh-model-name": model,
			})

			const response = await makeJsonRequest(
				`${this.config.flowBaseUrl}${FLOW_ENDPOINTS.embeddings}`,
				{
					method: "POST",
					headers,
					body: JSON.stringify(payload),
					timeout: this.config.flowRequestTimeout,
				},
			)

			return response
		} catch (error) {
			const enhancedError = handleHttpError(error, "Flow embedding creation")
			debug("Embedding creation error", { error: enhancedError.message })
			throw enhancedError
		}
	}

	/**
	 * Convert Anthropic messages to Flow format
	 */
	private convertAnthropicMessages(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): FlowChatCompletionOptions["messages"] {
		const flowMessages: FlowChatCompletionOptions["messages"] = []

		// Add system message if provided
		if (systemPrompt) {
			flowMessages.push({
				role: "system",
				content: systemPrompt,
			})
		}

		// Convert Anthropic messages
		for (const message of messages) {
			const content = Array.isArray(message.content)
				? message.content.map((block) => {
						if (block.type === "text") {
							return block.text
						}
						// Handle other content types as needed
						return ""
				  }).join("")
				: message.content

			flowMessages.push({
				role: message.role as "user" | "assistant",
				content,
			})
		}

		return flowMessages
	}

	/**
	 * Check if model is O1 or O3 family (requires special handling)
	 */
	private isO1OrO3Model(modelId: string): boolean {
		const o1o3Models = [
			"o1", "o1-preview", "o1-mini",
			"o3", "o3-mini", "o3-preview"
		]

		return o1o3Models.some(model => modelId === model || modelId.startsWith(model + "-"))
	}

	/**
	 * Process streaming response from Flow API with improved chunk handling
	 */
	private async *processStreamingResponse(
		stream: ReadableStream<Uint8Array>,
		provider: string,
	): AsyncIterableIterator<any> {
		console.log("🌊 [processStreamingResponse] Iniciando processamento do stream para provider:", provider)

		const reader = stream.getReader()
		const decoder = new TextDecoder()
		let chunkCount = 0
		let totalContent = ""
		let buffer = "" // Buffer para chunks fragmentados

		try {
			while (true) {
				const { done, value } = await reader.read()
				if (done) {
					console.log("🏁 [processStreamingResponse] Stream finalizado:", {
						chunkCount,
						totalContentLength: totalContent.length,
						hasContent: totalContent.length > 0,
						bufferRemaining: buffer.length,
					})

					// Processar qualquer conteúdo restante no buffer
					if (buffer.trim()) {
						console.log("🔄 [processStreamingResponse] Processando buffer final:", {
							bufferLength: buffer.length,
							bufferPreview: buffer.substring(0, 200) + "...",
						})

						// Process buffer and yield any content found
						for await (const chunk of this.processBufferedChunks(buffer, provider)) {
							totalContent += chunk.text || ""
							yield chunk
						}
					}
					break
				}

				chunkCount++
				const chunk = decoder.decode(value, { stream: true }) // Use stream: true para chunks fragmentados
				buffer += chunk

				console.log("📦 [processStreamingResponse] Chunk recebido:", {
					chunkNumber: chunkCount,
					chunkLength: chunk.length,
					chunkPreview: chunk.substring(0, 200) + (chunk.length > 200 ? "..." : ""),
					bufferLength: buffer.length,
				})

				// Processar chunks completos do buffer
				const { processedChunks, remainingBuffer } = this.extractCompleteChunks(buffer)
				buffer = remainingBuffer

				console.log("🔍 [processStreamingResponse] Chunks extraídos:", {
					chunkNumber: chunkCount,
					processedCount: processedChunks.length,
					remainingBufferLength: buffer.length,
				})

				// Processar cada chunk completo
				for (const completeChunk of processedChunks) {
					const parsed = parseSSEChunk(completeChunk)

					console.log("🔍 [processStreamingResponse] Chunk parseado:", {
						chunkNumber: chunkCount,
						hasParsed: !!parsed,
						parsedKeys: parsed ? Object.keys(parsed) : [],
						parsedPreview: parsed ? JSON.stringify(parsed).substring(0, 300) + "..." : null,
					})

					if (parsed) {
						const transformed = transformStreamChunk(provider as any, parsed)
						const content = transformed.choices[0]?.delta?.content || ""
						totalContent += content

						console.log("✨ [processStreamingResponse] Chunk transformado:", {
							chunkNumber: chunkCount,
							hasTransformed: !!transformed,
							transformedKeys: transformed ? Object.keys(transformed) : [],
							choicesCount: transformed.choices?.length || 0,
							content: content,
							contentLength: content.length,
						})

						if (content) {
							yield {
								type: "text",
								text: content,
							}
						}
					}
				}
			}
		} catch (error) {
			console.error("❌ [processStreamingResponse] Erro no processamento:", {
				error: error instanceof Error ? error.message : String(error),
				chunkCount,
				totalContentLength: totalContent.length,
				bufferLength: buffer.length,
			})
			throw error
		} finally {
			reader.releaseLock()
			console.log("🔒 [processStreamingResponse] Reader liberado")
		}
	}

	/**
	 * Extract complete SSE chunks from buffer
	 */
	private extractCompleteChunks(buffer: string): { processedChunks: string[], remainingBuffer: string } {
		const chunks: string[] = []
		let remaining = buffer

		// Procurar por padrões SSE completos
		const ssePattern = /data: .*?\n\n/gs
		let match
		let lastIndex = 0

		while ((match = ssePattern.exec(buffer)) !== null) {
			chunks.push(match[0])
			lastIndex = match.index + match[0].length
		}

		// Se encontramos chunks completos, remover do buffer
		if (chunks.length > 0) {
			remaining = buffer.substring(lastIndex)
		}

		// Se não há padrão SSE, procurar por linhas completas
		if (chunks.length === 0) {
			const lines = buffer.split('\n')
			if (lines.length > 1) {
				// Manter a última linha no buffer (pode estar incompleta)
				const completeLines = lines.slice(0, -1)
				remaining = lines[lines.length - 1]

				// Agrupar linhas em chunks
				let currentChunk = ""
				for (const line of completeLines) {
					currentChunk += line + '\n'
					if (line.trim() === "" || line.startsWith("data: ")) {
						if (currentChunk.trim()) {
							chunks.push(currentChunk)
						}
						currentChunk = ""
					}
				}

				// Adicionar chunk restante se houver
				if (currentChunk.trim()) {
					chunks.push(currentChunk)
				}
			}
		}

		console.log("🔧 [extractCompleteChunks] Extração completa:", {
			inputLength: buffer.length,
			chunksFound: chunks.length,
			remainingLength: remaining.length,
			chunkLengths: chunks.map(c => c.length),
		})

		return { processedChunks: chunks, remainingBuffer: remaining }
	}

	/**
	 * Process any remaining buffered content and yield results
	 */
	private async *processBufferedChunks(buffer: string, provider: string): AsyncIterableIterator<any> {
		try {
			const parsed = parseSSEChunk(buffer)
			if (parsed) {
				console.log("🔄 [processBufferedChunks] Buffer final processado com sucesso:", {
					parsedKeys: Object.keys(parsed),
					hasChoices: !!parsed.choices,
					choicesCount: parsed.choices?.length || 0,
				})

				// Transform the complete response to stream format
				const transformed = transformStreamChunk(provider as any, parsed)
				const content = transformed.choices[0]?.delta?.content || ""

				console.log("✨ [processBufferedChunks] Conteúdo extraído do buffer:", {
					hasTransformed: !!transformed,
					transformedKeys: transformed ? Object.keys(transformed) : [],
					choicesCount: transformed.choices?.length || 0,
					content: content,
					contentLength: content.length,
				})

				if (content) {
					yield {
						type: "text",
						text: content,
					}
				}
			}
		} catch (error) {
			console.warn("⚠️ [processBufferedChunks] Erro ao processar buffer final:", {
				error: error instanceof Error ? error.message : String(error),
				bufferLength: buffer.length,
			})
		}
	}
}
