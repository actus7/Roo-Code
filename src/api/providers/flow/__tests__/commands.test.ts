import {
	CreateChatCompletionCommand,
	CreateStreamingChatCommand,
	CreateEmbeddingCommand,
	ListModelsCommand,
	CompositeCommand,
	CommandInvoker,
	FlowCommandFactory,
} from "../commands"
import { FlowRequestBuilder } from "../request-builder"
import { FlowStreamProcessor } from "../stream-processor"
import { FlowMessageProcessor } from "../message-processor"
import type { FlowConfig, FlowChatCompletionOptions, FlowEmbeddingOptions } from "../types"

// Mock the dependencies
jest.mock("../request-builder")
jest.mock("../stream-processor")
jest.mock("../message-processor")
jest.mock("../request-utils", () => ({
	makeJsonRequest: jest.fn(),
	makeStreamingRequest: jest.fn(),
}))
jest.mock("../model-utils", () => ({
	transformModelData: jest.fn(),
	transformChatResponse: jest.fn(),
}))

import { makeJsonRequest, makeStreamingRequest } from "../request-utils"
import { transformModelData, transformChatResponse } from "../model-utils"

const mockMakeJsonRequest = makeJsonRequest as jest.MockedFunction<typeof makeJsonRequest>
const mockMakeStreamingRequest = makeStreamingRequest as jest.MockedFunction<typeof makeStreamingRequest>
const mockTransformModelData = transformModelData as jest.MockedFunction<typeof transformModelData>
const mockTransformChatResponse = transformChatResponse as jest.MockedFunction<typeof transformChatResponse>

describe("Flow Commands", () => {
	let mockConfig: FlowConfig
	let mockRequestBuilder: jest.Mocked<FlowRequestBuilder>
	let mockStreamProcessor: jest.Mocked<FlowStreamProcessor>
	let mockMessageProcessor: jest.Mocked<FlowMessageProcessor>

	beforeEach(() => {
		mockConfig = {
			baseUrl: "https://api.flow.test",
			apiModelId: "gpt-4o-mini",
			flowRequestTimeout: 30000,
		} as FlowConfig

		mockRequestBuilder = {
			buildChatRequest: jest.fn(),
			buildEmbeddingRequest: jest.fn(),
			buildModelsRequest: jest.fn(),
		} as any

		mockStreamProcessor = {
			processStreamingResponse: jest.fn(),
		} as any

		mockMessageProcessor = {
			convertAnthropicMessages: jest.fn(),
		} as any

		jest.clearAllMocks()
	})

	describe("CreateChatCompletionCommand", () => {
		it("should execute chat completion successfully", async () => {
			const options: FlowChatCompletionOptions = {
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "Hello" }],
			}

			const requestData = {
				url: "https://api.flow.test/chat",
				headers: { "Authorization": "Bearer token" },
				payload: { model: "gpt-4o-mini", messages: [] },
				provider: "azure-openai",
			}

			const apiResponse = { choices: [{ message: { content: "Hi there!" } }] }
			const transformedResponse = { content: "Hi there!" }

			mockRequestBuilder.buildChatRequest.mockResolvedValue(requestData)
			mockMakeJsonRequest.mockResolvedValue(apiResponse)
			mockTransformChatResponse.mockReturnValue(transformedResponse)

			const command = new CreateChatCompletionCommand(options, mockRequestBuilder, mockConfig)
			const result = await command.execute()

			expect(result).toEqual(transformedResponse)
			expect(command.isExecuted()).toBe(true)
			expect(command.getResult()).toEqual(transformedResponse)
			expect(mockRequestBuilder.buildChatRequest).toHaveBeenCalledWith(options, false)
			expect(mockMakeJsonRequest).toHaveBeenCalledWith(requestData.url, expect.any(Object))
			expect(mockTransformChatResponse).toHaveBeenCalledWith(requestData.provider, apiResponse)
		})

		it("should handle execution errors", async () => {
			const options: FlowChatCompletionOptions = {
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "Hello" }],
			}

			const error = new Error("API Error")
			mockRequestBuilder.buildChatRequest.mockRejectedValue(error)

			const command = new CreateChatCompletionCommand(options, mockRequestBuilder, mockConfig)

			await expect(command.execute()).rejects.toThrow("API Error")
			expect(command.isExecuted()).toBe(true)
			expect(command.getError()).toEqual(error)
		})

		it("should prevent double execution", async () => {
			const options: FlowChatCompletionOptions = {
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "Hello" }],
			}

			mockRequestBuilder.buildChatRequest.mockResolvedValue({} as any)
			mockMakeJsonRequest.mockResolvedValue({})
			mockTransformChatResponse.mockReturnValue({})

			const command = new CreateChatCompletionCommand(options, mockRequestBuilder, mockConfig)
			await command.execute()

			await expect(command.execute()).rejects.toThrow("Command has already been executed")
		})

		it("should provide correct description", () => {
			const options: FlowChatCompletionOptions = {
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "Hello" }],
			}

			const command = new CreateChatCompletionCommand(options, mockRequestBuilder, mockConfig)
			expect(command.getDescription()).toBe("Create chat completion with model: gpt-4o-mini")
		})
	})

	describe("CreateEmbeddingCommand", () => {
		it("should execute embedding creation successfully", async () => {
			const options: FlowEmbeddingOptions = {
				input: "test text",
				model: "text-embedding-3-small",
			}

			const requestData = {
				url: "https://api.flow.test/embeddings",
				headers: { "Authorization": "Bearer token" },
				payload: { input: "test text", model: "text-embedding-3-small" },
			}

			const apiResponse = { data: [{ embedding: [0.1, 0.2, 0.3] }] }

			mockRequestBuilder.buildEmbeddingRequest.mockResolvedValue(requestData)
			mockMakeJsonRequest.mockResolvedValue(apiResponse)

			const command = new CreateEmbeddingCommand(options, mockRequestBuilder, mockConfig)
			const result = await command.execute()

			expect(result).toEqual(apiResponse)
			expect(command.isExecuted()).toBe(true)
			expect(mockRequestBuilder.buildEmbeddingRequest).toHaveBeenCalledWith(options)
		})

		it("should provide correct description for string input", () => {
			const options: FlowEmbeddingOptions = {
				input: "test text",
				model: "text-embedding-3-small",
			}

			const command = new CreateEmbeddingCommand(options, mockRequestBuilder, mockConfig)
			expect(command.getDescription()).toBe("Create embedding for string input with model: text-embedding-3-small")
		})

		it("should provide correct description for array input", () => {
			const options: FlowEmbeddingOptions = {
				input: ["text1", "text2"],
				model: "text-embedding-3-small",
			}

			const command = new CreateEmbeddingCommand(options, mockRequestBuilder, mockConfig)
			expect(command.getDescription()).toBe("Create embedding for array input with model: text-embedding-3-small")
		})
	})

	describe("ListModelsCommand", () => {
		it("should execute list models successfully", async () => {
			const options = { provider: "azure-openai", capabilities: ["chat-conversation"] }

			const requestData = {
				url: "https://api.flow.test/models",
				headers: { "Authorization": "Bearer token" },
				params: { provider: "azure-openai", capabilities: "chat-conversation" },
			}

			const apiResponse = [{ name: "gpt-4o-mini", provider: "azure-openai" }]
			const transformedResponse = [{ id: "gpt-4o-mini", provider: "azure-openai" }]

			mockRequestBuilder.buildModelsRequest.mockResolvedValue(requestData)
			mockMakeJsonRequest.mockResolvedValue(apiResponse)
			mockTransformModelData.mockReturnValue(transformedResponse[0])

			const command = new ListModelsCommand(options, mockRequestBuilder, mockConfig)
			const result = await command.execute()

			expect(result).toEqual(transformedResponse)
			expect(command.isExecuted()).toBe(true)
			expect(mockRequestBuilder.buildModelsRequest).toHaveBeenCalledWith("azure-openai", ["chat-conversation"])
		})
	})

	describe("CompositeCommand", () => {
		it("should execute multiple commands successfully", async () => {
			const command1 = {
				execute: jest.fn().mockResolvedValue("result1"),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Command 1"),
			}

			const command2 = {
				execute: jest.fn().mockResolvedValue("result2"),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Command 2"),
			}

			const composite = new CompositeCommand([command1, command2])
			const results = await composite.execute()

			expect(results).toEqual(["result1", "result2"])
			expect(command1.execute).toHaveBeenCalled()
			expect(command2.execute).toHaveBeenCalled()
		})

		it("should handle partial failures", async () => {
			const command1 = {
				execute: jest.fn().mockResolvedValue("result1"),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Command 1"),
			}

			const command2 = {
				execute: jest.fn().mockRejectedValue(new Error("Command 2 failed")),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Command 2"),
			}

			const composite = new CompositeCommand([command1, command2])

			await expect(composite.execute()).rejects.toThrow("1 command(s) failed")
			expect(composite.isExecuted()).toBe(true)
		})

		it("should add and remove commands", () => {
			const command1 = {
				execute: jest.fn(),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Command 1"),
			}

			const command2 = {
				execute: jest.fn(),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Command 2"),
			}

			const composite = new CompositeCommand()
			composite.addCommand(command1)
			composite.addCommand(command2)

			expect(composite.getCommands()).toHaveLength(2)

			composite.removeCommand(command1)
			expect(composite.getCommands()).toHaveLength(1)
			expect(composite.getCommands()[0]).toBe(command2)
		})
	})

	describe("CommandInvoker", () => {
		let invoker: CommandInvoker

		beforeEach(() => {
			invoker = new CommandInvoker()
		})

		it("should execute commands and maintain history", async () => {
			const command = {
				execute: jest.fn().mockResolvedValue("result"),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Test Command"),
			}

			const result = await invoker.execute(command)

			expect(result).toBe("result")
			expect(invoker.getHistory()).toHaveLength(1)
			expect(invoker.getCurrentIndex()).toBe(0)
			expect(invoker.getLastCommand()).toBe(command)
		})

		it("should support undo functionality", async () => {
			const command = {
				execute: jest.fn().mockResolvedValue("result"),
				undo: jest.fn().mockResolvedValue(undefined),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Test Command"),
			}

			await invoker.execute(command)
			expect(invoker.canUndo()).toBe(true)

			await invoker.undo()
			expect(command.undo).toHaveBeenCalled()
			expect(invoker.getCurrentIndex()).toBe(-1)
			expect(invoker.canUndo()).toBe(false)
		})

		it("should support redo functionality", async () => {
			const command = {
				execute: jest.fn().mockResolvedValue("result"),
				undo: jest.fn().mockResolvedValue(undefined),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Test Command"),
			}

			await invoker.execute(command)
			await invoker.undo()

			expect(invoker.canRedo()).toBe(true)

			const result = await invoker.redo()
			expect(result).toBe("result")
			expect(invoker.getCurrentIndex()).toBe(0)
			expect(invoker.canRedo()).toBe(false)
		})

		it("should clear history", async () => {
			const command = {
				execute: jest.fn().mockResolvedValue("result"),
				canExecute: jest.fn().mockReturnValue(true),
				getDescription: jest.fn().mockReturnValue("Test Command"),
			}

			await invoker.execute(command)
			expect(invoker.getHistory()).toHaveLength(1)

			invoker.clearHistory()
			expect(invoker.getHistory()).toHaveLength(0)
			expect(invoker.getCurrentIndex()).toBe(-1)
		})
	})

	describe("FlowCommandFactory", () => {
		let factory: FlowCommandFactory

		beforeEach(() => {
			factory = new FlowCommandFactory(
				mockRequestBuilder,
				mockStreamProcessor,
				mockMessageProcessor,
				mockConfig
			)
		})

		it("should create chat completion command", () => {
			const options: FlowChatCompletionOptions = {
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "Hello" }],
			}

			const command = factory.createChatCompletionCommand(options)
			expect(command).toBeInstanceOf(CreateChatCompletionCommand)
		})

		it("should create embedding command", () => {
			const options: FlowEmbeddingOptions = {
				input: "test text",
				model: "text-embedding-3-small",
			}

			const command = factory.createEmbeddingCommand(options)
			expect(command).toBeInstanceOf(CreateEmbeddingCommand)
		})

		it("should create list models command", () => {
			const command = factory.createListModelsCommand()
			expect(command).toBeInstanceOf(ListModelsCommand)
		})

		it("should create composite command", () => {
			const command = factory.createCompositeCommand()
			expect(command).toBeInstanceOf(CompositeCommand)
		})

		it("should create command invoker", () => {
			const invoker = factory.createInvoker()
			expect(invoker).toBeInstanceOf(CommandInvoker)
		})

		it("should create batch chat command", () => {
			const optionsArray: FlowChatCompletionOptions[] = [
				{ model: "gpt-4o-mini", messages: [{ role: "user", content: "Hello 1" }] },
				{ model: "gpt-4o-mini", messages: [{ role: "user", content: "Hello 2" }] },
			]

			const command = factory.createBatchChatCommand(optionsArray)
			expect(command).toBeInstanceOf(CompositeCommand)
			expect(command.getCommands()).toHaveLength(2)
		})
	})
})
