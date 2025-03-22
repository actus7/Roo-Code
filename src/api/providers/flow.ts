import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler } from ".."
import { ApiHandlerOptions, flowDefaultModelId, FlowModelId, flowModels, ModelInfo } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import axios, { AxiosInstance } from "axios"

const DEFAULT_BASE_URL = "https://flow.ciandt.com"
const AUTH_PATH = "/auth-engine-api/v1/api-key/token"
const API_PATH = "/ai-orchestration-api/v1"

export class FlowHandler extends BaseProvider implements ApiHandler {
	private options: ApiHandlerOptions
	private axiosInstance: AxiosInstance
	private token: string | null = null

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.axiosInstance = axios.create({
			baseURL: options.flowBaseUrl || DEFAULT_BASE_URL,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				flowTenant: options.flowTenant,
			},
		})
		this.setupAuthInterceptor()
	}

	private setupAuthInterceptor() {
		this.axiosInstance.interceptors.request.use(
			async (config) => {
				if (!this.token) {
					this.token = await this.authenticate()
				}
				config.headers.Authorization = `Bearer ${this.token}`
				return config
			},
			(error) => Promise.reject(error),
		)
	}

	private async authenticate(): Promise<string> {
		try {
			const response = await axios.post(
				`${this.options.flowBaseUrl || DEFAULT_BASE_URL}${AUTH_PATH}`,
				{
					clientId: this.options.flowClientId,
					clientSecret: this.options.flowClientSecret,
					appToAccess: "llm-api",
				},
				{
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						flowTenant: this.options.flowTenant || "edge",
					},
				},
			)
			return response.data.access_token
		} catch (error) {
			console.error("Flow authentication error:", error)
			throw new Error("Failed to authenticate with Flow")
		}
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		try {
			// Converte as mensagens para o formato do Flow
			const flowMessages = messages.map((msg) => {
				let content: string

				if (Array.isArray(msg.content)) {
					content = msg.content.map((c) => (typeof c === "string" ? c : (c as any).text || "")).join("\n")
				} else if (typeof msg.content === "string") {
					content = msg.content
				} else {
					content = (msg.content as any).text || ""
				}

				return {
					role: msg.role === "assistant" ? "assistant" : "user",
					content: content,
				}
			})

			// O prompt do sistema é incluído como uma mensagem do usuário no início
			if (systemPrompt) {
				flowMessages.unshift({
					role: "user",
					content: systemPrompt,
				})
			}

			// Usa o endpoint correto baseado no modelo
			const modelId = this.getModel().id
			const endpoint = modelId.startsWith("gpt-")
				? "/openai/chat/completions"
				: modelId.startsWith("gemini-")
					? "/google/generateContent"
					: modelId.startsWith("anthropic.claude-")
						? "/bedrock/invoke"
						: "/openai/chat/completions"

			let payload: any

			if (endpoint === "/google/generateContent") {
				payload = {
					contents: flowMessages.map((msg) => ({
						role: msg.role,
						parts: [{ text: msg.content }],
					})),
					model: this.getModel().id,
				}
			} else if (endpoint === "/bedrock/invoke") {
				payload = {
					messages: flowMessages.map((msg) => ({
						role: msg.role,
						content: [
							{
								type: "text",
								text: msg.content,
							},
						],
					})),
					anthropic_version: "bedrock-2023-05-31",
					max_tokens: this.options.modelMaxTokens || 1000000,
					allowedModels: [this.getModel().id],
				}
			} else {
				// OpenAI format (default)
				payload = {
					messages: flowMessages,
					max_tokens: this.options.modelMaxTokens || this.getModel().info.maxTokens,
					temperature: this.options.modelTemperature ?? 0.7,
					model: this.getModel().id,
					stream: false,
				}
			}

			const response = await this.axiosInstance.post(`${API_PATH}${endpoint}`, payload, {
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					flowAgent: "chat",
					flowTenant: this.options.flowTenant || "edge",
				},
			})

			// Extrai o texto da resposta de acordo com o endpoint
			let responseText = ""
			let inputTokens = 0
			let outputTokens = 0

			if (endpoint === "/google/generateContent") {
				responseText = response.data.candidates[0].content.parts[0].text
				// Gemini não fornece contagem de tokens
				inputTokens = 0
				outputTokens = 0
			} else if (endpoint === "/bedrock/invoke") {
				responseText = response.data.content[0].text
				inputTokens = response.data.usage?.input_tokens ?? 0
				outputTokens = response.data.usage?.output_tokens ?? 0
			} else {
				// OpenAI format
				responseText = response.data.choices[0].message.content
				inputTokens = response.data.usage?.prompt_tokens ?? 0
				outputTokens = response.data.usage?.completion_tokens ?? 0
			}

			// Retorna o texto gerado
			yield {
				type: "text",
				text: responseText,
			}

			// Retorna informações de uso (tokens)
			yield {
				type: "usage",
				inputTokens,
				outputTokens,
			}
		} catch (error) {
			console.error("Flow API error:", error)
			throw error
		}
	}

	override getModel(): { id: FlowModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in flowModels) {
			const id = modelId as FlowModelId
			return { id, info: flowModels[id] }
		}
		return { id: flowDefaultModelId, info: flowModels[flowDefaultModelId] }
	}
}
