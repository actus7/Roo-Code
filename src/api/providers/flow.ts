import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler } from ".."
import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios"
import { generatePayload, extractResponseContent } from "./flow/payload-generator"
import { getEndpointForModel } from "./flow/model-utils"
import { FlowConfig } from "./flow/config"
import { createAxiosHeaders, ensureAxiosHeaders } from "./flow/utils"
import { createAuthHeaders, createBaseHeaders, createRequestConfig } from "./flow/request-utils"
import { 
  FlowModel, 
  FlowMessage, 
  FlowModelResponse, 
  FlowHandlerOptions,
  FlowAuthResponse,
  DEFAULT_FLOW_CONFIG,
  ensureTemperature,
} from "./flow/types"

/**
 * Handler for Flow API operations.
 * Manages authentication, model selection, and message generation for the Flow API service.
 * Implements token-based authentication with automatic token refresh and model management.
 */
export class FlowHandler extends BaseProvider implements ApiHandler {
  private options: FlowHandlerOptions
  private axiosInstance: AxiosInstance
  private token: string | undefined = undefined
  private tokenExpirationTime: number | undefined = undefined
  private tokenRefreshInProgress = false
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

  /**
   * Creates a new FlowHandler instance.
   * @param options - Configuration options for the Flow API handler
   * @throws Error if required credentials are missing
   */
  constructor(options: ApiHandlerOptions) {
    super()
    this.options = {
      ...options,
      flowBaseUrl: options.flowBaseUrl || FlowConfig.DEFAULT_BASE_URL,
      flowAppToAccess: DEFAULT_FLOW_CONFIG.flowAppToAccess,
      flowTenant: options.flowTenant || "cit",
      flowAgent: DEFAULT_FLOW_CONFIG.flowAgent,
      modelTemperature: options.modelTemperature !== undefined ? 
        ensureTemperature(options.modelTemperature) : 
        DEFAULT_FLOW_CONFIG.modelTemperature,
    }

    if (!this.options.flowClientId || !this.options.flowClientSecret) {
      throw new Error("[FlowHandler] Missing required credentials (clientId or clientSecret)")
    }

    this.validateOptions()

    const baseHeaders = createBaseHeaders(this.options.flowTenant || "")
    this.axiosInstance = axios.create({
      baseURL: this.options.flowBaseUrl,
      headers: createAxiosHeaders(baseHeaders),
    })

    this.setupAuthInterceptor()
  }

  /**
   * Validates that all required options are present and valid.
   * @throws Error if any required option is missing or invalid
   */
  private validateOptions(): void {
    const requiredOptions = [
      "flowBaseUrl",
      "flowTenant",
      "flowClientId",
      "flowClientSecret",
      "flowAppToAccess",
    ] as const

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

  /**
   * Sets up the authentication interceptor for all API requests.
   * Automatically adds authentication headers to requests.
   */
  private setupAuthInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await this.authenticate()
        const headers = createAuthHeaders(token, this.options.flowTenant || "")
        if (this.options.flowAgent) {
          headers.flowAgent = this.options.flowAgent
        }
        config.headers = ensureAxiosHeaders(createAxiosHeaders(headers))
        return config
      },
      (error) => {
        console.error("[FlowHandler] Request interceptor error:", error)
        return Promise.reject(error)
      },
    )
  }

  /**
   * Returns the current token if it's still valid.
   * @returns The current token if valid, undefined otherwise
   */
  private getValidToken(): string | undefined {
    if (!this.token || !this.tokenExpirationTime || Date.now() >= this.tokenExpirationTime) {
      return undefined
    }
    return this.token
  }

  /**
   * Ensures a token is valid and available.
   * @param token - The token to validate
   * @returns The validated token
   * @throws Error if no valid token is available
   */
  private ensureValidToken(token: string | undefined): string {
    if (!token) {
      throw new Error("No valid token available")
    }
    return token
  }

  /**
   * Authenticates with the Flow API and manages token refresh.
   * Implements retry logic for concurrent authentication requests.
   * @returns A promise that resolves to a valid authentication token
   * @throws Error if authentication fails
   */
  private async authenticate(): Promise<string> {
    const validToken = this.getValidToken()
    if (validToken) {
      return validToken
    }

    if (this.tokenRefreshInProgress) {
      let retries = FlowConfig.MAX_AUTH_RETRIES
      while (this.tokenRefreshInProgress && retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, FlowConfig.RETRY_DELAY_MS))
        retries--
        const token = this.getValidToken()
        if (token) return token
      }
      throw new Error("Authentication timeout after waiting")
    }

    this.tokenRefreshInProgress = true
    try {
      const authUrl = `${this.options.flowAuthBaseUrl || FlowConfig.DEFAULT_BASE_URL}${FlowConfig.AUTH_PATH}`
      const payload = {
        clientId: this.options.flowClientId,
        clientSecret: this.options.flowClientSecret,
        appToAccess: this.options.flowAppToAccess || DEFAULT_FLOW_CONFIG.flowAppToAccess,
      }
      const headers = createBaseHeaders(this.options.flowTenant || "")

      const response = await axios.post<FlowAuthResponse>(
        authUrl, 
        payload, 
        { headers: createAxiosHeaders(headers) }
      )

      if (!response.data.access_token) {
        console.error("[Flow] Auth response data:", response.data)
        throw new Error("No access token received from Flow authentication")
      }

      this.token = response.data.access_token
      this.tokenExpirationTime = Date.now() + FlowConfig.TOKEN_EXPIRY_MINUTES * 60 * 1000

      return this.ensureValidToken(this.token)
    } catch (error) {
      this.token = undefined
      this.tokenExpirationTime = undefined
      console.error("[Flow] Authentication error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          headers: {
            ...error.config?.headers,
            Authorization: undefined,
          },
        },
      })
      throw error
    } finally {
      this.tokenRefreshInProgress = false
    }
  }

  /**
   * Fetches available models from the Flow API.
   * @returns A promise that resolves to a record of available models and their information
   * @throws Error if authentication fails or no models are available
   */
  public async getAvailableModels(): Promise<Record<string, ModelInfo>> {
    try {
      await this.authenticate()
    } catch (authError) {
      console.error("[Flow] Authentication failed:", authError)
      throw new Error("Failed to authenticate with Flow API")
    }

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

  /**
   * Fetches models for a specific provider.
   * @param provider - The provider to fetch models from
   * @returns A promise that resolves to a record of provider-specific models
   */
  private async getProviderModels(provider: string): Promise<Record<string, ModelInfo>> {
    try {
      const token = await this.authenticate()
      const headers = createAuthHeaders(token, this.options.flowTenant || "")

      const response = await this.axiosInstance.get<FlowModel[]>(
        `${FlowConfig.API_PATH}/models/${provider}?capabilities=system-instruction,chat-conversation`,
        { headers: createAxiosHeaders(headers) }
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

  /**
   * Gets the current model configuration.
   * @returns The current model ID and its information
   */
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

  /**
   * Gets the default model ID based on available models.
   * Prioritizes models in the order: GPT > Claude > Gemini.
   * @returns The selected default model ID
   */
  private getDefaultModelId(): string {
    const availableModelIds = Object.keys(this.availableModels)

    const gptModel = availableModelIds.find((id) => id.startsWith("gpt-"))
    if (gptModel) return gptModel

    const claudeModel = availableModelIds.find((id) => id.startsWith("anthropic.claude-"))
    if (claudeModel) return claudeModel

    const geminiModel = availableModelIds.find((id) => id.startsWith("gemini-"))
    if (geminiModel) return geminiModel

    return availableModelIds[0]
  }

  /**
   * Creates a message stream using the Flow API.
   * @param systemPrompt - The system prompt to use
   * @param messages - The conversation messages
   * @returns An async generator yielding message chunks and usage information
   */
  override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
    const startTime = Date.now()
    let finalModelId = "unknown"
    
    try {
      const { id: modelId, info: modelInfo } = await this.prepareModelForRequest()
      finalModelId = modelId
      
      const flowMessages = this.convertToFlowMessages(messages, systemPrompt)
      const endpoint = getEndpointForModel(modelId)
      
      const payload = generatePayload(modelId, flowMessages, modelInfo, {
        stream: true,
        max_tokens: this.options.modelMaxTokens,
        temperature: ensureTemperature(this.options.modelTemperature),
      })
      
      this.logRequestDetails(endpoint, payload, modelId)
      
      const token = await this.authenticate()
      const headers = createAuthHeaders(token, this.options.flowTenant || "")
      const requestConfig = createRequestConfig(
        headers, 
        payload.stream, 
        this.options.flowRequestTimeout || FlowConfig.DEFAULT_TIMEOUT
      )

      const response = await this.axiosInstance.post<FlowModelResponse>(
        `${FlowConfig.API_PATH}${endpoint}`, 
        payload, 
        requestConfig
      )
      
      if (payload.stream) {
        yield* this.handleStreamingResponse(response.data, modelId)
      } else {
        yield* this.handleNonStreamingResponse(response.data, endpoint)
      }
      
      yield {
        type: "usage",
        inputTokens: 0,
        outputTokens: 0,
      }
    } catch (error) {
      yield* this.handleApiError(error, systemPrompt, messages)
    } finally {
      this.logRequestCompletion(startTime, finalModelId)
    }
  }
  
  /**
   * Prepares the model for a request by ensuring models are initialized.
   * @returns A promise that resolves to the selected model ID and info
   */
  private async prepareModelForRequest(): Promise<{ id: string; info: ModelInfo }> {
    if (!this.hasInitializedModels) {
      try {
        await this.initializeModels()
        this.hasInitializedModels = true
      } catch (error) {
        console.log("[Flow] Failed to initialize models, using default model")
      }
    }
    return this.getModel()
  }

  /**
   * Initializes the available models.
   */
  private async initializeModels(): Promise<void> {
    try {
      await this.getAvailableModels()
    } catch (error) {
      console.error("[FlowHandler] Failed to initialize models:", error)
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
  
  /**
   * Converts Anthropic message format to Flow message format.
   * @param messages - The messages to convert
   * @param systemPrompt - The system prompt to include
   * @returns An array of Flow formatted messages
   */
  private convertToFlowMessages(messages: Anthropic.Messages.MessageParam[], systemPrompt: string): FlowMessage[] {
    const flowMessages = messages.map((msg) => {
      let content: Array<{ type: string; text: string }> = []
      
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
        content,
      }
    })
    
    if (systemPrompt) {
      flowMessages.unshift({
        role: "assistant",
        content: [{ type: "text", text: systemPrompt }],
      })
    }
    
    return flowMessages
  }
  
  /**
   * Logs request details for debugging purposes.
   * @param endpoint - The API endpoint being called
   * @param payload - The request payload
   * @param modelId - The model ID being used
   * @throws Error if no model is selected
   */
  private logRequestDetails(endpoint: string, payload: unknown, modelId: string): void {
    console.log(`[Flow] Sending request to endpoint: ${endpoint}`)
    console.log(`[Flow] Payload:`, JSON.stringify(payload, null, 2))
    console.log(`[Flow] Model:`, modelId)

    if (!modelId) {
      throw new Error("No model selected. Please check your configuration.")
    }
  }
  
  /**
   * Handles streaming response from the Flow API.
   * @param data - The streaming response data
   * @param modelId - The model ID being used
   * @yields Text chunks from the response
   */
  private async *handleStreamingResponse(data: unknown, modelId: string): AsyncGenerator<any, void, unknown> {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid streaming response data")
    }

    const iterable = data as AsyncIterable<Buffer>
    for await (const chunk of iterable) {
      try {
        const lines = chunk.toString().split("\n").filter(Boolean)
        
        for (const line of lines) {
          if (line.trim() === "[DONE]") {
            continue
          }
          
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6)
            try {
              const data = JSON.parse(jsonStr) as FlowModelResponse
              const content = extractResponseContent(data, modelId)
              
              if (content) {
                yield {
                  type: "text",
                  text: content,
                }
              }
            } catch (parseError) {
              if (jsonStr.trim() !== "[DONE]") {
                console.warn(`[Flow] Failed to parse JSON from chunk: ${jsonStr}`, parseError)
              }
            }
          }
        }
      } catch (chunkError) {
        console.warn(`[Flow] Error processing chunk`, chunkError)
      }
    }
  }
  
  /**
   * Handles non-streaming response from the Flow API.
   * @param data - The response data from the Flow API
   * @param endpoint - The API endpoint that was called
   * @yields First a text chunk containing the response content, then usage statistics
   * @throws Error if no content is found in the response
   */
  private async *handleNonStreamingResponse(data: FlowModelResponse, endpoint: string): AsyncGenerator<any, void, unknown> {
    const text = extractResponseContent(data, endpoint) || ""
    
    if (!text) {
      console.error("[Flow] No content in response:", data)
      throw new Error("No content in response from Flow API")
    }
    
    yield {
      type: "text",
      text,
    }
    
    const inputTokens = data.usage?.prompt_tokens
    const outputTokens = data.usage?.completion_tokens
    
    yield {
      type: "usage",
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
    }
  }
  
  /**
   * Handles API errors by categorizing them and taking appropriate action.
   * @param error - The error that occurred during the API call
   * @param systemPrompt - The system prompt that was used in the request
   * @param messages - The messages that were sent in the request
   * @yields Results from retry attempts if applicable
   * @throws Error with appropriate error message based on the error type
   */
  private async *handleApiError(
    error: unknown,
    systemPrompt: string,
    messages: Anthropic.Messages.MessageParam[]
  ): AsyncGenerator<any, void, unknown> {
    if (axios.isAxiosError(error)) {
      console.error("[Flow] API Error:", {
        name: error.name,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      })

      const status = error.response?.status
      const errorMessage = error.response?.data?.message
      
      switch (status) {
        case 401:
          this.token = undefined
          throw new Error("Flow authentication failed - please check your credentials")
        case 400:
          throw new Error(`Flow API validation error: ${errorMessage || "Invalid request"}`)
        case 404:
          throw new Error(`Flow API endpoint not found: ${errorMessage || "Service unavailable"}`)
        case 409:
          console.warn(`[Flow] Conflict error (409) received. Retrying with different model...`)
          return yield* this.retryWithDifferentModel(systemPrompt, messages)
        default:
          if (status && status >= 500) {
            throw new Error(
              `Flow API server error (${status}): ${errorMessage || "Internal server error"}`
            )
          }
      }
      
      if (error.code === "ECONNABORTED") {
        throw new Error("Flow API request timed out - please try again")
      }
    }
    throw new Error(`Flow API error: ${error instanceof Error ? error.message : String(error)}`)
  }
  
  /**
   * Logs the completion of a request including execution time and final model used.
   * @param startTime - The timestamp when the request started
   * @param finalModelId - The ID of the model that was ultimately used
   */
  private logRequestCompletion(startTime: number, finalModelId: string): void {
    const endTime = Date.now()
    const executionTime = (endTime - startTime) / 1000
    console.log(`[Flow] createMessage completed in ${executionTime.toFixed(2)} seconds`)
    console.log(`[Flow] Final model used: ${finalModelId}`)
  }
  
  /**
   * Attempts to retry a failed request with a different model.
   * Cycles through available models in sequence if multiple retries are needed.
   * @param systemPrompt - The system prompt to use in the retry
   * @param messages - The messages to retry sending
   * @yields Results from the retried request
   * @throws Error if the retry also fails
   */
  private async *retryWithDifferentModel(
    systemPrompt: string,
    messages: Anthropic.Messages.MessageParam[]
  ): AsyncGenerator<any, void, unknown> {
    console.log("[Flow] Retrying with a different model due to conflict error")
    const currentModelId = this.getModel().id
    const availableModelIds = Object.keys(this.availableModels)
    
    const nextModelIndex = (availableModelIds.indexOf(currentModelId) + 1) % availableModelIds.length
    const nextModelId = availableModelIds[nextModelIndex]
    
    console.log(`[Flow] Switching from model ${currentModelId} to ${nextModelId}`)
    
    this.options.apiModelId = nextModelId
    
    try {
      yield* this.createMessage(systemPrompt, messages)
    } catch (retryError) {
      console.error("[Flow] Retry with different model failed:", retryError)
      throw retryError
    }
  }
}
