import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler } from ".."
import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import axios, { AxiosInstance, ResponseType } from "axios"

const DEFAULT_BASE_URL = "https://flow.ciandt.com"
const AUTH_PATH = "/auth-engine-api/v1/api-key/token"
const API_PATH = "/ai-orchestration-api/v1"

interface FlowModel {
	id: string
	maxTokens?: number
	contextWindow?: number
	supportsImages?: boolean
	supportsComputerUse?: boolean
	description?: string
}

export class FlowHandler extends BaseProvider implements ApiHandler {
	private options: ApiHandlerOptions
	private axiosInstance: AxiosInstance
	private token: string | null = null
	private tokenExpirationTime: number | null = null
	private tokenRefreshInProgress = false

	private getValidToken(): string | null {
		if (!this.token || !this.tokenExpirationTime || Date.now() >= this.tokenExpirationTime) {
			return null
		}
		return this.token
	}

	private ensureValidToken(token: string | null): string {
		if (!token) {
			throw new Error("No valid token available")
		}
		return token
	}
	private availableModels: Record<string, ModelInfo> = {}
	private hasInitializedModels = false
	private defaultModel = {
		id: "gpt-4o",
		info: {
			maxTokens: 8192,
			contextWindow: 128000,
			supportsImages: true,
			supportsComputerUse: true,
			supportsPromptCache: false,
		},
	}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		console.log("[FlowHandler] Initializing with options:", {
			baseUrl: options.flowBaseUrl,
			authBaseUrl: options.flowAuthBaseUrl,
			tenant: options.flowTenant,
			appToAccess: options.flowAppToAccess,
			agent: options.flowAgent,
		})
		this.validateOptions()
		this.axiosInstance = axios.create({
			baseURL: options.flowBaseUrl || DEFAULT_BASE_URL,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				flowTenant: options.flowTenant,
			},
		})
		console.log("[FlowHandler] Created axios instance with headers:", {
			flowTenant: options.flowTenant,
			baseURL: options.flowBaseUrl || DEFAULT_BASE_URL,
		})
		this.setupAuthInterceptor()

		// Inicializa os modelos disponíveis durante a construção
		this.initializeModels().catch((error) => {
			console.error("[FlowHandler] Error initializing models:", error)
		})
	}

	private async initializeModels() {
		try {
			await this.getAvailableModels()
		} catch (error) {
			console.error("[FlowHandler] Failed to initialize models:", error)
			// Define um modelo padrão para evitar erros
			this.availableModels = {
				"gpt-4o": {
					maxTokens: 8192,
					contextWindow: 128000,
					supportsImages: true,
					supportsComputerUse: true,
					supportsPromptCache: false,
				},
			}
		}
	}

	private validateOptions() {
		const requiredOptions = [
			"flowBaseUrl",
			"flowTenant",
			"flowClientId",
			"flowClientSecret",
			"flowAppToAccess",
		] as const
		console.log("[FlowHandler] Validating options:", {
			hasBaseUrl: "flowBaseUrl" in this.options,
			hasTenant: "flowTenant" in this.options,
			hasClientId: "flowClientId" in this.options,
			hasClientSecret: "flowClientSecret" in this.options,
			hasAppToAccess: "flowAppToAccess" in this.options,
			tenant: this.options.flowTenant,
		})

		for (const option of requiredOptions) {
			if (!(option in this.options)) {
				console.error(`[Flow] Missing required option: ${option}`)
				throw new Error(`[Flow] Missing required option: ${option}`)
			}
			if (option === "flowTenant" && !this.options[option]) {
				console.error(`[Flow] flowTenant is empty or undefined`)
				throw new Error(`[Flow] flowTenant cannot be empty or undefined`)
			}
		}
		console.log("[FlowHandler] Options validation successful")
	}

	private setupAuthInterceptor() {
		this.axiosInstance.interceptors.request.use(
			async (config) => {
				console.log("[FlowHandler] Intercepting request", {
					url: config.url,
					tenant: this.options.flowTenant,
					currentHeaders: config.headers,
				})

				const token = await this.authenticate()
				config.headers.Authorization = `Bearer ${token}`
				config.headers.flowTenant = this.options.flowTenant

				console.log("[FlowHandler] Request headers after interceptor:", {
					Authorization: config.headers.Authorization ? "Bearer [REDACTED]" : "None",
					flowTenant: config.headers.flowTenant,
				})

				return config
			},
			(error) => {
				console.error("[FlowHandler] Request interceptor error:", error)
				return Promise.reject(error)
			},
		)
	}

	private async authenticate(): Promise<string> {
		const validToken = this.getValidToken()
		if (validToken) {
			return validToken
		}

		if (this.tokenRefreshInProgress) {
			let retries = 50 // 5 segundos no total
			while (this.tokenRefreshInProgress && retries > 0) {
				await new Promise((resolve) => setTimeout(resolve, 100))
				retries--
				const token = this.getValidToken()
				if (token) return token
			}
			throw new Error("Authentication timeout after waiting")
		}

		this.tokenRefreshInProgress = true
		try {
			console.log("[Flow] Authenticating...")
			console.log("[Flow] Using base URL:", this.options.flowAuthBaseUrl || DEFAULT_BASE_URL)
			console.log("[Flow] Using tenant:", this.options.flowTenant || "edge")

			const response = await axios.post(
				`${this.options.flowAuthBaseUrl || DEFAULT_BASE_URL}${AUTH_PATH}`,
				{
					clientId: this.options.flowClientId,
					clientSecret: this.options.flowClientSecret,
					appToAccess: this.options.flowAppToAccess || "llm-api",
				},
				{
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						flowTenant: this.options.flowTenant || "edge",
					},
				},
			)

			if (!response.data.access_token) {
				throw new Error("No access token received from Flow authentication")
			}

			this.token = response.data.access_token
			// Define expiração para 55 minutos (5 minutos antes do token expirar)
			this.tokenExpirationTime = Date.now() + 55 * 60 * 1000
			console.log("[Flow] Successfully authenticated")

			return this.ensureValidToken(this.token)
		} catch (error) {
			this.token = null
			this.tokenExpirationTime = null
			console.error("[Flow] Authentication error:", error.response?.data || error.message)
			throw new Error(`Failed to authenticate with Flow: ${error.response?.data?.message || error.message}`)
		} finally {
			this.tokenRefreshInProgress = false
		}
	}

	public async getAvailableModels(): Promise<Record<string, ModelInfo>> {
		try {
			await this.authenticate()
		} catch (authError) {
			console.error("[Flow] Authentication failed:", authError)
			throw new Error("Failed to authenticate with Flow API")
		}

		// Inicialmente, tenta apenas os provedores que sabemos que estão funcionando
		const providers = ["azure-openai", "amazon-bedrock"]
		this.availableModels = {}

		for (const provider of providers) {
			try {
				const providerModels = await this.getProviderModels(provider)
				const modelCount = Object.keys(providerModels).length
				if (modelCount > 0) {
					this.availableModels = { ...this.availableModels, ...providerModels }
					console.log(`[Flow] Fetched ${modelCount} models for provider ${provider}`)
				} else {
					console.warn(`[Flow] No models found for provider ${provider}`)
				}
			} catch (providerError) {
				console.error(`[Flow] Error fetching models for provider ${provider}:`, providerError)
			}
		}

		const totalModels = Object.keys(this.availableModels).length
		if (totalModels === 0) {
			console.warn("[Flow] No models were fetched from any provider")
			throw new Error("No models available from any provider")
		} else {
			console.log(`[Flow] Total models fetched: ${totalModels}`)
		}

		return this.availableModels
	}

	// Removed duplicate validateOptions and constructor methods

	private async getProviderModels(provider: string): Promise<Record<string, ModelInfo>> {
		try {
			const token = await this.authenticate()
			const response = await this.axiosInstance.get(
				`${API_PATH}/models/${provider}?capabilities=system-instruction,chat-conversation`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						flowTenant: this.options.flowTenant || "edge",
					},
				},
			)

			return response.data.reduce((acc: Record<string, ModelInfo>, model: FlowModel) => {
				acc[model.id] = {
					maxTokens: model.maxTokens || 4096,
					contextWindow: model.contextWindow || 128000,
					supportsImages: model.supportsImages || false,
					supportsComputerUse: model.supportsComputerUse || false,
					supportsPromptCache: false,
					description: model.description || `${provider} model ${model.id}`,
				}
				return acc
			}, {})
		} catch (error) {
			console.error(`Error fetching models for provider ${provider}:`, error)
			return {}
		}
	}

	private modelsInitialized = false
	private initializationPromise: Promise<void> | null = null

	override getModel(): { id: string; info: ModelInfo } {
		const availableModelIds = Object.keys(this.availableModels)
		if (availableModelIds.length === 0) {
			console.log("[FlowHandler] No models available, using default model")
			return this.defaultModel
		}

		const modelId = this.options.apiModelId || this.getDefaultModelId()
		const modelInfo = this.availableModels[modelId]

		if (!modelInfo) {
			console.warn(`[FlowHandler] Model ${modelId} not found in available models, using default`)
			return this.defaultModel
		}

		return { id: modelId, info: modelInfo }
	}

	private getDefaultModelId(): string {
		const availableModelIds = Object.keys(this.availableModels)

		// Prioridade: GPT > Claude > Gemini
		const gptModel = availableModelIds.find((id) => id.startsWith("gpt-"))
		if (gptModel) return gptModel

		const claudeModel = availableModelIds.find((id) => id.startsWith("anthropic.claude-"))
		if (claudeModel) return claudeModel

		const geminiModel = availableModelIds.find((id) => id.startsWith("gemini-"))
		if (geminiModel) return geminiModel

		return availableModelIds[0]
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const startTime = Date.now()
		let finalModelId = "unknown"

		try {
			console.log(`[Flow] Starting createMessage`)
			console.log(`[Flow] System Prompt:`, systemPrompt)
			console.log(`[Flow] Messages:`, JSON.stringify(messages, null, 2))

			let { id: modelId, info: modelInfo } = this.getModel()
			console.log(`[Flow] Initial model: ${modelId}`)
			finalModelId = modelId

			if (!this.hasInitializedModels) {
				try {
					await this.initializeModels()
					this.hasInitializedModels = true as const
					// Re-fetch model after initialization
					;({ id: modelId, info: modelInfo } = this.getModel())
					console.log(`[Flow] Model after initialization: ${modelId}`)
				} catch (error) {
					console.log("[Flow] Failed to initialize models, using default model")
				}
			}

			// Converte as mensagens para o formato do Flow
			const flowMessages = messages.map((msg) => {
				let content: Array<{ type: string; text: string }>

				if (Array.isArray(msg.content)) {
					content = msg.content.map((c) => {
						if (typeof c === "string") {
							return { type: "text", text: c }
						} else if (c.type === "text" && typeof c.text === "string") {
							return { type: "text", text: c.text }
						} else {
							console.warn(`[Flow] Unsupported content type:`, c)
							return { type: "text", text: JSON.stringify(c) }
						}
					})
				} else if (typeof msg.content === "string") {
					content = [{ type: "text", text: msg.content }]
				} else if (
					msg.content &&
					typeof msg.content === "object" &&
					"text" in (msg.content as Record<string, unknown>) &&
					typeof (msg.content as { text: unknown }).text === "string"
				) {
					content = [{ type: "text", text: (msg.content as { text: string }).text }]
				} else {
					console.warn(`[Flow] Unexpected message content format:`, msg.content)
					content = [{ type: "text", text: JSON.stringify(msg.content) }]
				}

				return {
					role: msg.role,
					content: content,
				}
			})

			// O prompt do sistema é incluído como uma mensagem do usuário no início
			if (systemPrompt) {
				flowMessages.unshift({
					role: "assistant",
					content: [{ type: "text", text: systemPrompt }],
				})
			}

			const getEndpoint = (modelId: string): string => {
				if (modelId.startsWith("gpt-")) {
					return "/openai/chat/completions"
				} else if (modelId.startsWith("gemini-")) {
					return "/google/generateContent"
				} else if (modelId.startsWith("anthropic.claude-")) {
					return "/bedrock/invoke"
				}
				throw new Error(`Unsupported model: ${modelId}`)
			}

			const endpoint = getEndpoint(modelId)

			const generatePayload = (modelId: string, messages: any[], options: any): any => {
				if (modelId.startsWith("gpt-")) {
					return {
						stream: options.stream || false,
						messages,
						max_tokens: options.max_tokens || modelInfo.maxTokens || 4096,
						model: modelId,
						temperature: options.temperature ?? 0.7,
						response_format: { type: "text" },
					}
				} else if (modelId.startsWith("gemini-")) {
					return {
						contents: messages.map((m) => ({
							role: m.role,
							parts: [{ text: m.content }],
						})),
						model: modelId,
					}
				} else if (modelId.startsWith("anthropic.claude-")) {
					return {
						messages,
						anthropic_version: "bedrock-2023-05-31",
						max_tokens: options.max_tokens || modelInfo.maxTokens || 131072,
						allowedModels: [modelId],
						stream: options.stream || false,
					}
				}
				throw new Error(`Unsupported model: ${modelId}`)
			}

			const payload = generatePayload(modelId, flowMessages, {
				stream: true,
				max_tokens: this.options.modelMaxTokens,
				temperature: this.options.modelTemperature,
			})

			console.log(`[Flow] Sending request to endpoint: ${endpoint}`)
			console.log(`[Flow] Payload:`, JSON.stringify(payload, null, 2))
			console.log(`[Flow] Model:`, modelId)
			if (!modelId) {
				throw new Error("No model selected. Please check your configuration.")
			}
			console.log(`[Flow] Token:`, "Authenticating before request")

			const token = await this.authenticate()
			const requestConfig = {
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: `Bearer ${token}`,
					flowAgent: this.options.flowAgent || "chat",
					flowTenant: this.options.flowTenant,
				},
				responseType: (payload.stream ? "stream" : "json") as ResponseType,
				timeout: this.options.flowRequestTimeout || 30000,
			}

			console.log(`[Flow] Making request to ${endpoint} with config:`, {
				headers: {
					...requestConfig.headers,
					Authorization: "Bearer [REDACTED]",
				},
				stream: payload.stream,
				modelId: modelId,
			})

			const response = await this.axiosInstance.post(`${API_PATH}${endpoint}`, payload, requestConfig)

			// Se não for streaming, retorna a resposta direta
			if (!payload.stream) {
				console.log(`[Flow] Received non-streaming response:`, response.data)

				const text =
					endpoint === "/google/generateContent"
						? response.data.candidates?.[0]?.content?.parts?.[0]?.text
						: endpoint === "/bedrock/invoke"
							? response.data.completion
							: response.data.choices?.[0]?.message?.content || ""

				if (!text) {
					console.error("[Flow] No content in response:", response.data)
					throw new Error("No content in response from Flow API")
				}

				yield {
					type: "text",
					text,
				}

				yield {
					type: "usage",
					inputTokens: response.data.usage?.prompt_tokens || 0,
					outputTokens: response.data.usage?.completion_tokens || 0,
				}

				return
			}

			console.log(`[Flow] Response received, processing stream...`)

			try {
				for await (const chunk of response.data) {
					const lines = chunk.toString().split("\n").filter(Boolean)
					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6))
								console.log(`[Flow] Processing chunk:`, JSON.stringify(data, null, 2))

								// Handle different response formats
								if (endpoint === "/google/generateContent") {
									if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
										yield {
											type: "text",
											text: data.candidates[0].content.parts[0].text,
										}
									}
								} else if (endpoint === "/bedrock/invoke") {
									if (data.completion) {
										yield {
											type: "text",
											text: data.completion,
										}
									}
								} else {
									// OpenAI format
									if (data.choices?.[0]?.delta?.content) {
										yield {
											type: "text",
											text: data.choices[0].delta.content,
										}
									} else if (data.choices?.[0]?.message?.content) {
										yield {
											type: "text",
											text: data.choices[0].message.content,
										}
									} else if (data.choices?.[0]?.text) {
										// Fallback para formato alternativo
										yield {
											type: "text",
											text: data.choices[0].text,
										}
									} else if (typeof data === "string") {
										// Fallback para resposta simples em texto
										yield {
											type: "text",
											text: data,
										}
									}
								}
							} catch (error) {
								console.error("[Flow] Error parsing stream chunk:", error)
								console.error("[Flow] Problematic line:", line)
								continue
							}
						}
					}
				}
			} catch (error) {
				console.error("[Flow] Error processing stream:", error)
				throw error
			}

			// Yield usage information at the end
			yield {
				type: "usage",
				inputTokens: 0, // We don't have this information in streaming mode
				outputTokens: 0, // We don't have this information in streaming mode
			}
		} catch (error) {
			console.error("[Flow] API Error:", {
				name: error.name,
				message: error.message,
				status: error.response?.status,
				data: error.response?.data,
				headers: error.response?.headers,
			})

			// Tratamento específico por tipo de erro
			if (axios.isAxiosError(error)) {
				const status = error.response?.status
				const errorMessage = error.response?.data?.message

				switch (status) {
					case 401:
						this.token = null // Force reauthentication
						throw new Error("Flow authentication failed - please check your credentials")
					case 400:
						throw new Error(`Flow API validation error: ${errorMessage || "Invalid request"}`)
					case 404:
						throw new Error(`Flow API endpoint not found: ${errorMessage || "Service unavailable"}`)
					case 409:
						console.warn(`[Flow] Conflict error (409) received. Retrying with different model...`)
						// Aqui você pode implementar uma lógica para tentar com um modelo diferente
						// Por exemplo, chamando createMessage novamente com um modelo alternativo
						return this.retryWithDifferentModel(systemPrompt, messages)
					default:
						if (status && status >= 500) {
							throw new Error(
								`Flow API server error (${status}): ${errorMessage || "Internal server error"}`,
							)
						}
				}

				if (error.code === "ECONNABORTED") {
					throw new Error("Flow API request timed out - please try again")
				}
			}
			throw new Error(`Flow API error: ${error.message}`)
		} finally {
			const endTime = Date.now()
			const executionTime = (endTime - startTime) / 1000 // Convert to seconds
			console.log(`[Flow] createMessage completed in ${executionTime.toFixed(2)} seconds`)
			console.log(`[Flow] Final model used: ${finalModelId}`)
		}
	}

	private async *retryWithDifferentModel(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): ApiStream {
		console.log("[Flow] Retrying with a different model due to conflict error")
		const currentModelId = this.getModel().id
		const availableModelIds = Object.keys(this.availableModels)

		// Encontrar o próximo modelo disponível
		const nextModelIndex = (availableModelIds.indexOf(currentModelId) + 1) % availableModelIds.length
		const nextModelId = availableModelIds[nextModelIndex]

		console.log(`[Flow] Switching from model ${currentModelId} to ${nextModelId}`)

		// Atualizar o modelo atual
		this.options.apiModelId = nextModelId

		// Tentar novamente com o novo modelo
		try {
			yield* this.createMessage(systemPrompt, messages)
		} catch (retryError) {
			console.error("[Flow] Retry with different model failed:", retryError)
			throw retryError
		}
	}
}
