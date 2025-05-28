/**
 * Interface Contract Tests
 *
 * These tests verify that all Flow classes correctly implement their interfaces
 * and adhere to the defined contracts.
 */

import { FlowMessageProcessor } from "../message-processor"
import { FlowStreamProcessor } from "../stream-processor"
import { FlowRequestBuilder } from "../request-builder"
import { FlowHandler } from "../flow-handler"
import { FlowRequestBuilderFactory } from "../request-builders"
import { FlowCommandFactory } from "../commands"
import { TokenManager } from "../auth"
import type {
	IFlowHandler,
	IFlowMessageProcessor,
	IFlowStreamProcessor,
	IFlowRequestBuilder,
	IChatRequestBuilder,
	IEmbeddingRequestBuilder,
	IModelsRequestBuilder,
	IFlowRequestBuilderFactory,
	ICommandInvoker,
	IFlowCommandFactory,
	FlowConfig
} from "../interfaces"

// Mock dependencies
jest.mock("../auth")
jest.mock("../request-utils", () => ({
	makeJsonRequest: jest.fn(),
	makeStreamingRequest: jest.fn(),
	handleHttpError: jest.fn(),
	createFlowHeaders: jest.fn(),
}))
jest.mock("../secure-logger", () => ({
	secureLogger: {
		logInfo: jest.fn(),
		logDebug: jest.fn(),
		logError: jest.fn(),
		logRequest: jest.fn(),
		logResponse: jest.fn(),
		generateCorrelationId: jest.fn(() => "test-correlation-id"),
	},
}))
jest.mock("../audit-trail", () => ({
	securityAuditTrail: {
		logApiAccessEvent: jest.fn(),
		logSecurityEvent: jest.fn(),
		logAuthenticationEvent: jest.fn(),
	},
}))

const MockTokenManager = TokenManager as jest.MockedClass<typeof TokenManager>

describe("Interface Contract Tests", () => {
	let mockConfig: FlowConfig
	let mockTokenManager: jest.Mocked<TokenManager>

	beforeEach(() => {
		mockConfig = {
			baseUrl: "https://api.flow.test",
			apiModelId: "gpt-4o-mini",
		} as FlowConfig

		mockTokenManager = new MockTokenManager(mockConfig) as jest.Mocked<TokenManager>
		mockTokenManager.getValidToken.mockResolvedValue("test-token")

		jest.clearAllMocks()
	})

	describe("FlowMessageProcessor Interface Compliance", () => {
		it("should implement IFlowMessageProcessor interface", () => {
			const processor = new FlowMessageProcessor()

			// Verify interface compliance at compile time
			const interfaceCompliant: IFlowMessageProcessor = processor
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof processor.convertAnthropicMessages).toBe("function")
			expect(typeof processor.processMessageContent).toBe("function")
			expect(typeof processor.validateMessage).toBe("function")
			expect(typeof processor.extractTextContent).toBe("function")
			expect(typeof processor.createSystemMessage).toBe("function")
			expect(typeof processor.createUserMessage).toBe("function")
			expect(typeof processor.createAssistantMessage).toBe("function")
			expect(typeof processor.mergeConsecutiveMessages).toBe("function")
			expect(typeof processor.estimateTokenCount).toBe("function")
			expect(typeof processor.truncateMessages).toBe("function")
		})
	})

	describe("FlowStreamProcessor Interface Compliance", () => {
		it("should implement IFlowStreamProcessor interface", () => {
			const processor = new FlowStreamProcessor()

			// Verify interface compliance at compile time
			const interfaceCompliant: IFlowStreamProcessor = processor
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof processor.processStreamingResponse).toBe("function")
			expect(typeof processor.extractCompleteChunks).toBe("function")
			expect(typeof processor.processBufferedChunks).toBe("function")
			expect(typeof processor.createStreamFromText).toBe("function")
			expect(typeof processor.validateChunk).toBe("function")
			expect(typeof processor.normalizeChunk).toBe("function")
			expect(typeof processor.parseSSEChunk).toBe("function")
			expect(typeof processor.transformStreamChunk).toBe("function")
		})
	})

	describe("FlowRequestBuilder Interface Compliance", () => {
		it("should implement IFlowRequestBuilder interface", () => {
			const builder = new FlowRequestBuilder(mockConfig, mockTokenManager)

			// Verify interface compliance at compile time
			const interfaceCompliant: IFlowRequestBuilder = builder
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof builder.buildChatRequest).toBe("function")
			expect(typeof builder.buildEmbeddingRequest).toBe("function")
			expect(typeof builder.buildModelsRequest).toBe("function")
			expect(typeof builder.validatePayload).toBe("function")
			expect(typeof builder.determineProvider).toBe("function")
			expect(typeof builder.getProviderEndpoint).toBe("function")
			expect(typeof builder.getProviderCapabilities).toBe("function")
			expect(typeof builder.supportsStreaming).toBe("function")
			expect(typeof builder.supportsEmbeddings).toBe("function")
			expect(typeof builder.supportsImages).toBe("function")
			expect(typeof builder.getBuilderFactory).toBe("function")
		})
	})

	describe("FlowHandler Interface Compliance", () => {
		it("should implement IFlowHandler interface", () => {
			const handler = new FlowHandler(mockConfig)

			// Verify interface compliance at compile time
			const interfaceCompliant: IFlowHandler = handler
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof handler.createMessage).toBe("function")
			expect(typeof handler.getModel).toBe("function")
			expect(typeof handler.listModels).toBe("function")
			expect(typeof handler.createChatCompletion).toBe("function")
			expect(typeof handler.createEmbedding).toBe("function")
			expect(typeof handler.getCommandFactory).toBe("function")
			expect(typeof handler.getCommandInvoker).toBe("function")
			expect(typeof handler.executeBatchCommands).toBe("function")
			expect(typeof handler.undoLastCommand).toBe("function")
			expect(typeof handler.getCommandHistory).toBe("function")
		})
	})

	describe("Builder Pattern Interface Compliance", () => {
		it("should implement IChatRequestBuilder interface", () => {
			const factory = new FlowRequestBuilderFactory(mockConfig, mockTokenManager, {} as any)
			const builder = factory.createChatBuilder()

			// Verify interface compliance at compile time
			const interfaceCompliant: IChatRequestBuilder = builder
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof builder.setModel).toBe("function")
			expect(typeof builder.setMessages).toBe("function")
			expect(typeof builder.setMaxTokens).toBe("function")
			expect(typeof builder.setTemperature).toBe("function")
			expect(typeof builder.setStreaming).toBe("function")
			expect(typeof builder.addHeader).toBe("function")
			expect(typeof builder.addHeaders).toBe("function")
			expect(typeof builder.build).toBe("function")
			expect(typeof builder.reset).toBe("function")
			expect(typeof builder.clone).toBe("function")
		})

		it("should implement IEmbeddingRequestBuilder interface", () => {
			const factory = new FlowRequestBuilderFactory(mockConfig, mockTokenManager, {} as any)
			const builder = factory.createEmbeddingBuilder()

			// Verify interface compliance at compile time
			const interfaceCompliant: IEmbeddingRequestBuilder = builder
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof builder.setInput).toBe("function")
			expect(typeof builder.setModel).toBe("function")
			expect(typeof builder.setUser).toBe("function")
			expect(typeof builder.addHeader).toBe("function")
			expect(typeof builder.addHeaders).toBe("function")
			expect(typeof builder.setDimensions).toBe("function")
			expect(typeof builder.setEncodingFormat).toBe("function")
			expect(typeof builder.build).toBe("function")
			expect(typeof builder.reset).toBe("function")
			expect(typeof builder.clone).toBe("function")
		})

		it("should implement IModelsRequestBuilder interface", () => {
			const factory = new FlowRequestBuilderFactory(mockConfig, mockTokenManager, {} as any)
			const builder = factory.createModelsBuilder()

			// Verify interface compliance at compile time
			const interfaceCompliant: IModelsRequestBuilder = builder
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof builder.setProvider).toBe("function")
			expect(typeof builder.setCapabilities).toBe("function")
			expect(typeof builder.addCapability).toBe("function")
			expect(typeof builder.removeCapability).toBe("function")
			expect(typeof builder.addHeader).toBe("function")
			expect(typeof builder.addHeaders).toBe("function")
			expect(typeof builder.addParam).toBe("function")
			expect(typeof builder.addParams).toBe("function")
			expect(typeof builder.build).toBe("function")
			expect(typeof builder.reset).toBe("function")
			expect(typeof builder.clone).toBe("function")
		})

		it("should implement IFlowRequestBuilderFactory interface", () => {
			const factory = new FlowRequestBuilderFactory(mockConfig, mockTokenManager, {} as any)

			// Verify interface compliance at compile time
			const interfaceCompliant: IFlowRequestBuilderFactory = factory
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof factory.createChatBuilder).toBe("function")
			expect(typeof factory.createEmbeddingBuilder).toBe("function")
			expect(typeof factory.createModelsBuilder).toBe("function")
			expect(typeof factory.createStreamingChatBuilder).toBe("function")
			expect(typeof factory.createO1ChatBuilder).toBe("function")
			expect(typeof factory.createStandardEmbeddingBuilder).toBe("function")
		})
	})

	describe("Command Pattern Interface Compliance", () => {
		let commandFactory: FlowCommandFactory

		beforeEach(() => {
			const requestBuilder = new FlowRequestBuilder(mockConfig, mockTokenManager)
			const streamProcessor = new FlowStreamProcessor()
			const messageProcessor = new FlowMessageProcessor()

			commandFactory = new FlowCommandFactory(
				requestBuilder,
				streamProcessor,
				messageProcessor,
				mockConfig
			)
		})

		it("should implement IFlowCommandFactory interface", () => {
			// Verify interface compliance at compile time
			const interfaceCompliant: IFlowCommandFactory = commandFactory
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof commandFactory.createChatCompletionCommand).toBe("function")
			expect(typeof commandFactory.createStreamingChatCommand).toBe("function")
			expect(typeof commandFactory.createEmbeddingCommand).toBe("function")
			expect(typeof commandFactory.createListModelsCommand).toBe("function")
			expect(typeof commandFactory.createCompositeCommand).toBe("function")
			expect(typeof commandFactory.createInvoker).toBe("function")
			expect(typeof commandFactory.createBatchChatCommand).toBe("function")
			expect(typeof commandFactory.createBatchEmbeddingCommand).toBe("function")
			expect(typeof commandFactory.createMultiProviderModelsCommand).toBe("function")
		})

		it("should implement ICommandInvoker interface", () => {
			const invoker = commandFactory.createInvoker()

			// Verify interface compliance at compile time
			const interfaceCompliant: ICommandInvoker = invoker
			expect(interfaceCompliant).toBeDefined()

			// Verify all required methods exist
			expect(typeof invoker.execute).toBe("function")
			expect(typeof invoker.undo).toBe("function")
			expect(typeof invoker.redo).toBe("function")
			expect(typeof invoker.getHistory).toBe("function")
			expect(typeof invoker.getCurrentIndex).toBe("function")
			expect(typeof invoker.clearHistory).toBe("function")
			expect(typeof invoker.canUndo).toBe("function")
			expect(typeof invoker.canRedo).toBe("function")
			expect(typeof invoker.getLastCommand).toBe("function")
			expect(typeof invoker.executeSequence).toBe("function")
			expect(typeof invoker.executeParallel).toBe("function")
		})
	})

	describe("TypeScript Interface Enforcement", () => {
		it("should enforce interface contracts at compile time", () => {
			// This test verifies that TypeScript enforces interface contracts
			// If any class doesn't implement its interface correctly, this will fail at compile time

			const messageProcessor: IFlowMessageProcessor = new FlowMessageProcessor()
			const streamProcessor: IFlowStreamProcessor = new FlowStreamProcessor()
			const requestBuilder: IFlowRequestBuilder = new FlowRequestBuilder(mockConfig, mockTokenManager)
			const handler: IFlowHandler = new FlowHandler(mockConfig)

			expect(messageProcessor).toBeInstanceOf(FlowMessageProcessor)
			expect(streamProcessor).toBeInstanceOf(FlowStreamProcessor)
			expect(requestBuilder).toBeInstanceOf(FlowRequestBuilder)
			expect(handler).toBeInstanceOf(FlowHandler)
		})

		it("should maintain interface consistency across all implementations", () => {
			// Verify that all implementations maintain consistent interface signatures
			const messageProcessor = new FlowMessageProcessor()
			const streamProcessor = new FlowStreamProcessor()
			const requestBuilder = new FlowRequestBuilder(mockConfig, mockTokenManager)

			// Check method signatures exist and are callable
			expect(() => messageProcessor.convertAnthropicMessages("", [])).not.toThrow()
			expect(() => streamProcessor.extractCompleteChunks("")).not.toThrow()
			expect(() => requestBuilder.getProviderCapabilities("azure-openai")).not.toThrow()
		})
	})
})
