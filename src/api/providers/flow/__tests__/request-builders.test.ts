import { ChatRequestBuilder, EmbeddingRequestBuilder, ModelsRequestBuilder, FlowRequestBuilderFactory } from "../request-builders"
import { TokenManager } from "../auth"
import type { FlowConfig } from "../types"

// Mock the dependencies
jest.mock("../auth")

const MockTokenManager = TokenManager as jest.MockedClass<typeof TokenManager>

describe("Request Builders", () => {
	let mockConfig: FlowConfig
	let mockTokenManager: jest.Mocked<TokenManager>
	let mockRequestBuilder: any

	beforeEach(() => {
		mockConfig = {
			flowBaseUrl: "https://api.flow.test",
			flowTenant: "test-tenant",
			flowClientId: "test-client-id",
			flowClientSecret: "test-client-secret",
			apiModelId: "gpt-4o-mini",
		} as FlowConfig

		mockTokenManager = new MockTokenManager(mockConfig) as jest.Mocked<TokenManager>
		mockTokenManager.getValidToken.mockResolvedValue("test-token")

		mockRequestBuilder = {
			buildChatRequest: jest.fn(),
			buildEmbeddingRequest: jest.fn(),
			buildModelsRequest: jest.fn(),
		}

		jest.clearAllMocks()
	})

	describe("ChatRequestBuilder", () => {
		let builder: ChatRequestBuilder

		beforeEach(() => {
			builder = new ChatRequestBuilder(mockConfig, mockTokenManager, mockRequestBuilder)
		})

		it("should build a basic chat request", async () => {
			const expectedResult = {
				url: "https://api.flow.test/chat",
				headers: { "Authorization": "Bearer test-token" },
				payload: { model: "gpt-4o-mini", messages: [] },
				provider: "azure-openai",
			}

			mockRequestBuilder.buildChatRequest.mockResolvedValue(expectedResult)

			const result = await builder
				.setModel("gpt-4o-mini")
				.setMessages([{ role: "user", content: "Hello" }])
				.build()

			expect(result).toEqual(expectedResult)
			expect(mockRequestBuilder.buildChatRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-4o-mini",
					messages: [{ role: "user", content: "Hello" }],
				}),
				false
			)
		})

		it("should build a streaming chat request", async () => {
			const expectedResult = {
				url: "https://api.flow.test/chat",
				headers: {
					"Authorization": "Bearer test-token",
					"Accept": "text/event-stream",
				},
				payload: { model: "gpt-4o-mini", messages: [] },
				provider: "azure-openai",
			}

			mockRequestBuilder.buildChatRequest.mockResolvedValue(expectedResult)

			const result = await builder
				.setModel("gpt-4o-mini")
				.setMessages([{ role: "user", content: "Hello" }])
				.setStreaming(true)
				.build()

			expect(mockRequestBuilder.buildChatRequest).toHaveBeenCalledWith(
				expect.any(Object),
				true
			)
		})

		it("should add custom headers", async () => {
			const expectedResult = {
				url: "https://api.flow.test/chat",
				headers: { "Authorization": "Bearer test-token" },
				payload: { model: "gpt-4o-mini", messages: [] },
				provider: "azure-openai",
			}

			mockRequestBuilder.buildChatRequest.mockResolvedValue(expectedResult)

			const result = await builder
				.setModel("gpt-4o-mini")
				.addHeader("Custom-Header", "custom-value")
				.build()

			expect(result.headers).toEqual({
				"Authorization": "Bearer test-token",
				"Custom-Header": "custom-value",
			})
		})

		it("should set all chat options", async () => {
			const expectedResult = {
				url: "https://api.flow.test/chat",
				headers: { "Authorization": "Bearer test-token" },
				payload: { model: "gpt-4o-mini", messages: [] },
				provider: "azure-openai",
			}

			mockRequestBuilder.buildChatRequest.mockResolvedValue(expectedResult)

			await builder
				.setModel("gpt-4o-mini")
				.setMessages([{ role: "user", content: "Hello" }])
				.setMaxTokens(1000)
				.setTemperature(0.7)
				.setTopP(0.9)
				.setFrequencyPenalty(0.1)
				.setPresencePenalty(0.2)
				.setStop(["END"])
				.setUser("user123")
				.build()

			expect(mockRequestBuilder.buildChatRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-4o-mini",
					messages: [{ role: "user", content: "Hello" }],
					maxTokens: 1000,
					temperature: 0.7,
					topP: 0.9,
					frequencyPenalty: 0.1,
					presencePenalty: 0.2,
					stop: ["END"],
					user: "user123",
				}),
				false
			)
		})

		it("should reset builder state", async () => {
			builder
				.setModel("gpt-4o-mini")
				.setMessages([{ role: "user", content: "Hello" }])
				.setStreaming(true)
				.reset()

			const expectedResult = {
				url: "https://api.flow.test/chat",
				headers: { "Authorization": "Bearer test-token" },
				payload: { model: "gpt-4o-mini", messages: [] },
				provider: "azure-openai",
			}

			mockRequestBuilder.buildChatRequest.mockResolvedValue(expectedResult)

			await builder.build()

			expect(mockRequestBuilder.buildChatRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-4o-mini", // Should use default from config
				}),
				false // Should reset streaming to false
			)
		})

		it("should clone builder", () => {
			builder
				.setModel("gpt-4o-mini")
				.setMessages([{ role: "user", content: "Hello" }])
				.setStreaming(true)

			const clone = builder.clone()

			expect(clone).toBeInstanceOf(ChatRequestBuilder)
			expect(clone).not.toBe(builder)
		})
	})

	describe("EmbeddingRequestBuilder", () => {
		let builder: EmbeddingRequestBuilder

		beforeEach(() => {
			builder = new EmbeddingRequestBuilder(mockConfig, mockTokenManager, mockRequestBuilder)
		})

		it("should build an embedding request", async () => {
			const expectedResult = {
				url: "https://api.flow.test/embeddings",
				headers: { "Authorization": "Bearer test-token" },
				payload: { input: "test text", model: "text-embedding-3-small" },
			}

			mockRequestBuilder.buildEmbeddingRequest.mockResolvedValue(expectedResult)

			const result = await builder
				.setInput("test text")
				.setModel("text-embedding-3-small")
				.build()

			expect(result).toEqual(expectedResult)
			expect(mockRequestBuilder.buildEmbeddingRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					input: "test text",
					model: "text-embedding-3-small",
				})
			)
		})

		it("should set all embedding options", async () => {
			const expectedResult = {
				url: "https://api.flow.test/embeddings",
				headers: { "Authorization": "Bearer test-token" },
				payload: { input: "test text", model: "text-embedding-3-small" },
			}

			mockRequestBuilder.buildEmbeddingRequest.mockResolvedValue(expectedResult)

			await builder
				.setInput("test text")
				.setModel("text-embedding-3-small")
				.setUser("user123")
				.setDimensions(1536)
				.setEncodingFormat("float")
				.build()

			expect(mockRequestBuilder.buildEmbeddingRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					input: "test text",
					model: "text-embedding-3-small",
					user: "user123",
					dimensions: 1536,
					encoding_format: "float",
				})
			)
		})

		it("should add custom headers", async () => {
			const expectedResult = {
				url: "https://api.flow.test/embeddings",
				headers: { "Authorization": "Bearer test-token" },
				payload: { input: "test text", model: "text-embedding-3-small" },
			}

			mockRequestBuilder.buildEmbeddingRequest.mockResolvedValue(expectedResult)

			const result = await builder
				.setInput("test text")
				.addHeader("Custom-Header", "custom-value")
				.build()

			expect(result.headers).toEqual({
				"Authorization": "Bearer test-token",
				"Custom-Header": "custom-value",
			})
		})
	})

	describe("ModelsRequestBuilder", () => {
		let builder: ModelsRequestBuilder

		beforeEach(() => {
			builder = new ModelsRequestBuilder(mockConfig, mockTokenManager, mockRequestBuilder)
		})

		it("should build a models request", async () => {
			const expectedResult = {
				url: "https://api.flow.test/models",
				headers: { "Authorization": "Bearer test-token" },
				params: { provider: "azure-openai", capabilities: "chat-conversation" },
			}

			mockRequestBuilder.buildModelsRequest.mockResolvedValue(expectedResult)

			const result = await builder.build()

			expect(result).toEqual(expectedResult)
			expect(mockRequestBuilder.buildModelsRequest).toHaveBeenCalledWith(
				"azure-openai",
				["chat-conversation"]
			)
		})

		it("should set provider and capabilities", async () => {
			const expectedResult = {
				url: "https://api.flow.test/models",
				headers: { "Authorization": "Bearer test-token" },
				params: { provider: "google-gemini", capabilities: "streaming,image-recognition" },
			}

			mockRequestBuilder.buildModelsRequest.mockResolvedValue(expectedResult)

			await builder
				.setProvider("google-gemini")
				.setCapabilities(["streaming", "image-recognition"])
				.build()

			expect(mockRequestBuilder.buildModelsRequest).toHaveBeenCalledWith(
				"google-gemini",
				["streaming", "image-recognition"]
			)
		})

		it("should add and remove capabilities", async () => {
			const expectedResult = {
				url: "https://api.flow.test/models",
				headers: { "Authorization": "Bearer test-token" },
				params: { provider: "azure-openai", capabilities: "streaming" },
			}

			mockRequestBuilder.buildModelsRequest.mockResolvedValue(expectedResult)

			await builder
				.addCapability("streaming")
				.removeCapability("chat-conversation")
				.build()

			expect(mockRequestBuilder.buildModelsRequest).toHaveBeenCalledWith(
				"azure-openai",
				["streaming"]
			)
		})
	})

	describe("FlowRequestBuilderFactory", () => {
		let factory: FlowRequestBuilderFactory

		beforeEach(() => {
			factory = new FlowRequestBuilderFactory(mockConfig, mockTokenManager, mockRequestBuilder)
		})

		it("should create chat builder", () => {
			const builder = factory.createChatBuilder()
			expect(builder).toBeInstanceOf(ChatRequestBuilder)
		})

		it("should create embedding builder", () => {
			const builder = factory.createEmbeddingBuilder()
			expect(builder).toBeInstanceOf(EmbeddingRequestBuilder)
		})

		it("should create models builder", () => {
			const builder = factory.createModelsBuilder()
			expect(builder).toBeInstanceOf(ModelsRequestBuilder)
		})

		it("should create streaming chat builder", () => {
			const builder = factory.createStreamingChatBuilder()
			expect(builder).toBeInstanceOf(ChatRequestBuilder)
		})

		it("should create O1 chat builder", () => {
			const builder = factory.createO1ChatBuilder()
			expect(builder).toBeInstanceOf(ChatRequestBuilder)
		})

		it("should create standard embedding builder", () => {
			const builder = factory.createStandardEmbeddingBuilder()
			expect(builder).toBeInstanceOf(EmbeddingRequestBuilder)
		})
	})
})
