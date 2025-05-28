import { FlowRequestBuilder } from "../request-builder"
import { TokenManager } from "../auth"
import type { FlowConfig, FlowChatCompletionOptions, FlowEmbeddingOptions } from "../types"

// Mock the dependencies
jest.mock("../model-utils", () => ({
	determineProvider: jest.fn(),
	getProviderEndpoint: jest.fn(),
}))

jest.mock("../payload-generator", () => ({
	generateProviderPayload: jest.fn(),
	generateEmbeddingPayload: jest.fn(),
	validatePayload: jest.fn(),
}))

jest.mock("../request-utils", () => ({
	createFlowHeaders: jest.fn(),
}))

jest.mock("../auth")

import { determineProvider, getProviderEndpoint } from "../model-utils"
import { generateProviderPayload, generateEmbeddingPayload, validatePayload } from "../payload-generator"
import { createFlowHeaders } from "../request-utils"

const mockDetermineProvider = determineProvider as jest.MockedFunction<typeof determineProvider>
const mockGetProviderEndpoint = getProviderEndpoint as jest.MockedFunction<typeof getProviderEndpoint>
const mockGenerateProviderPayload = generateProviderPayload as jest.MockedFunction<typeof generateProviderPayload>
const mockGenerateEmbeddingPayload = generateEmbeddingPayload as jest.MockedFunction<typeof generateEmbeddingPayload>
const mockValidatePayload = validatePayload as jest.MockedFunction<typeof validatePayload>
const mockCreateFlowHeaders = createFlowHeaders as jest.MockedFunction<typeof createFlowHeaders>
const MockTokenManager = TokenManager as jest.MockedClass<typeof TokenManager>

describe("FlowRequestBuilder", () => {
	let builder: FlowRequestBuilder
	let mockTokenManager: jest.Mocked<TokenManager>
	let mockConfig: FlowConfig

	beforeEach(() => {
		mockConfig = {
			flowBaseUrl: "https://api.flow.test",
			flowTenant: "test-tenant",
			flowClientId: "test-client-id",
			flowClientSecret: "test-client-secret",
			apiModelId: "gpt-4o-mini",
			flowRequestTimeout: 30000,
		} as FlowConfig

		mockTokenManager = new MockTokenManager(mockConfig) as jest.Mocked<TokenManager>
		mockTokenManager.getValidToken.mockResolvedValue("test-token")

		builder = new FlowRequestBuilder(mockConfig, mockTokenManager)

		// Setup default mocks
		mockDetermineProvider.mockReturnValue("azure-openai")
		mockGetProviderEndpoint.mockReturnValue("/ai-orchestration-api/v1/azure-openai/chat/completions")
		mockGenerateProviderPayload.mockReturnValue({ model: "gpt-4o-mini", messages: [] })
		mockGenerateEmbeddingPayload.mockReturnValue({ input: "test", model: "text-embedding-3-small" })
		mockValidatePayload.mockReturnValue(true)
		mockCreateFlowHeaders.mockReturnValue({ "Authorization": "Bearer test-token" })

		jest.clearAllMocks()
	})

	describe("buildChatRequest", () => {
		it("should build a chat request successfully", async () => {
			const options: FlowChatCompletionOptions = {
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "Hello" }],
			}

			const result = await builder.buildChatRequest(options)

			expect(result).toEqual({
				url: "https://api.flow.test/ai-orchestration-api/v1/azure-openai/chat/completions",
				headers: {
					"Authorization": "Bearer test-token",
					"Content-Type": "application/json",
				},
				payload: { model: "gpt-4o-mini", messages: [] },
				provider: "azure-openai",
			})

			expect(mockDetermineProvider).toHaveBeenCalledWith("gpt-4o-mini")
			expect(mockGetProviderEndpoint).toHaveBeenCalledWith("azure-openai")
			expect(mockGenerateProviderPayload).toHaveBeenCalledWith(
				"azure-openai",
				{ ...options, model: "gpt-4o-mini", stream: false },
				mockConfig
			)
			expect(mockValidatePayload).toHaveBeenCalled()
			expect(mockTokenManager.getValidToken).toHaveBeenCalled()
		})

		it("should build a streaming chat request", async () => {
			const options: FlowChatCompletionOptions = {
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "Hello" }],
			}

			const result = await builder.buildChatRequest(options, true)

			expect(result.headers).toEqual({
				"Authorization": "Bearer test-token",
				"Content-Type": "application/json",
				"Accept": "text/event-stream",
				"Cache-Control": "no-cache",
				"Connection": "keep-alive",
			})

			expect(mockGenerateProviderPayload).toHaveBeenCalledWith(
				"azure-openai",
				{ ...options, model: "gpt-4o-mini", stream: true },
				mockConfig
			)
		})

		it("should use default model when not specified", async () => {
			const options: FlowChatCompletionOptions = {
				messages: [{ role: "user", content: "Hello" }],
			}

			await builder.buildChatRequest(options)

			expect(mockDetermineProvider).toHaveBeenCalledWith("gpt-4o-mini")
		})

		it("should throw error for invalid payload", async () => {
			mockValidatePayload.mockReturnValue(false)

			const options: FlowChatCompletionOptions = {
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "Hello" }],
			}

			await expect(builder.buildChatRequest(options)).rejects.toThrow("Invalid request payload generated")
		})
	})

	describe("buildEmbeddingRequest", () => {
		it("should build an embedding request successfully", async () => {
			const options: FlowEmbeddingOptions = {
				input: "test text",
				model: "text-embedding-3-small",
			}

			const result = await builder.buildEmbeddingRequest(options)

			expect(result).toEqual({
				url: "https://api.flow.test/ai-orchestration-api/v1/embeddings",
				headers: {
					"Authorization": "Bearer test-token",
					"Content-Type": "application/json",
					"x-ms-model-mesh-model-name": "text-embedding-3-small",
				},
				payload: { input: "test", model: "text-embedding-3-small" },
			})

			expect(mockGenerateEmbeddingPayload).toHaveBeenCalledWith("test text", "text-embedding-3-small", undefined)
			expect(mockValidatePayload).toHaveBeenCalled()
			expect(mockTokenManager.getValidToken).toHaveBeenCalled()
		})

		it("should use default embedding model when not specified", async () => {
			const options: FlowEmbeddingOptions = {
				input: "test text",
			}

			await builder.buildEmbeddingRequest(options)

			expect(mockGenerateEmbeddingPayload).toHaveBeenCalledWith("test text", "text-embedding-3-small", undefined)
		})

		it("should throw error for invalid embedding payload", async () => {
			mockValidatePayload.mockReturnValue(false)

			const options: FlowEmbeddingOptions = {
				input: "test text",
			}

			await expect(builder.buildEmbeddingRequest(options)).rejects.toThrow("Invalid embedding request payload generated")
		})
	})

	describe("buildModelsRequest", () => {
		it("should build a models request successfully", async () => {
			const result = await builder.buildModelsRequest()

			expect(result).toEqual({
				url: "https://api.flow.test/ai-orchestration-api/v1/models",
				headers: {
					"Authorization": "Bearer test-token",
					"Content-Type": "application/json",
				},
				params: {
					provider: "azure-openai",
					capabilities: "chat-conversation",
				},
			})

			expect(mockTokenManager.getValidToken).toHaveBeenCalled()
		})

		it("should build a models request with custom provider and capabilities", async () => {
			const result = await builder.buildModelsRequest("google-gemini", ["streaming", "image-recognition"])

			expect(result.params).toEqual({
				provider: "google-gemini",
				capabilities: "streaming,image-recognition",
			})
		})
	})

	describe("utility methods", () => {
		it("should validate request payload", () => {
			// Mock validatePayload to not throw for valid case
			mockValidatePayload.mockImplementation(() => {})
			expect(builder.validateRequest({}, "azure-openai")).toBe(true)

			// Mock validatePayload to throw for invalid case
			mockValidatePayload.mockImplementation(() => {
				throw new Error("Invalid payload")
			})
			expect(builder.validateRequest({}, "azure-openai")).toBe(false)
		})

		it("should get provider for model", () => {
			mockDetermineProvider.mockReturnValue("google-gemini")
			expect(builder.getProviderForModel("gemini-pro")).toBe("google-gemini")
		})

		it("should build headers correctly", () => {
			mockCreateFlowHeaders.mockReturnValue({ "Authorization": "Bearer test-token" })

			const headers = builder.buildHeaders("test-token", { "Custom": "header" })

			expect(headers).toEqual({
				"Authorization": "Bearer test-token",
				"Custom": "header",
			})
		})

		it("should get base URL", () => {
			expect(builder.getBaseUrl()).toBe("https://api.flow.test")
		})

		it("should get timeout", () => {
			expect(builder.getTimeout()).toBe(30000)
		})

		it("should build request config", () => {
			const config = builder.buildRequestConfig("GET", { custom: "value" })

			expect(config).toEqual({
				method: "GET",
				timeout: 30000,
				custom: "value",
			})
		})
	})

	describe("provider capabilities", () => {
		it("should return correct capabilities for azure-openai", () => {
			const capabilities = builder.getProviderCapabilities("azure-openai")
			expect(capabilities).toEqual(["chat-conversation", "streaming", "embeddings", "system-instruction"])
		})

		it("should return correct capabilities for google-gemini", () => {
			const capabilities = builder.getProviderCapabilities("google-gemini")
			expect(capabilities).toEqual(["chat-conversation", "streaming", "image-recognition", "system-instruction"])
		})

		it("should return default capabilities for unknown provider", () => {
			const capabilities = builder.getProviderCapabilities("unknown")
			expect(capabilities).toEqual(["chat-conversation"])
		})

		it("should check streaming support", () => {
			expect(builder.supportsStreaming("azure-openai")).toBe(true)
			expect(builder.supportsStreaming("unknown")).toBe(false)
		})

		it("should check embeddings support", () => {
			expect(builder.supportsEmbeddings("azure-openai")).toBe(true)
			expect(builder.supportsEmbeddings("google-gemini")).toBe(false)
		})

		it("should check image support", () => {
			expect(builder.supportsImages("google-gemini")).toBe(true)
			expect(builder.supportsImages("azure-openai")).toBe(false)
		})
	})
})
