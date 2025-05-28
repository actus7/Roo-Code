import { Anthropic } from "@anthropic-ai/sdk"
import { FlowMessageProcessor } from "../message-processor"
import type { FlowMessage } from "../types"

describe("FlowMessageProcessor", () => {
	let processor: FlowMessageProcessor

	beforeEach(() => {
		processor = new FlowMessageProcessor()
	})

	describe("convertAnthropicMessages", () => {
		it("should convert simple text messages", () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
			]

			const result = processor.convertAnthropicMessages(systemPrompt, messages)

			expect(result).toEqual([
				{ role: "system", content: "You are a helpful assistant" },
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
			])
		})

		it("should handle empty system prompt", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "Hello" },
			]

			const result = processor.convertAnthropicMessages("", messages)

			expect(result).toEqual([
				{ role: "user", content: "Hello" },
			])
		})

		it("should handle complex content blocks", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "Hello" },
						{ type: "text", text: " World" },
					],
				},
			]

			const result = processor.convertAnthropicMessages("", messages)

			expect(result).toEqual([
				{ role: "user", content: "Hello World" },
			])
		})
	})

	describe("processMessageContent", () => {
		it("should return string content as-is", () => {
			const content = "Simple text"
			const result = processor.processMessageContent(content)
			expect(result).toBe("Simple text")
		})

		it("should extract text from content blocks", () => {
			const content: Anthropic.Messages.ContentBlock[] = [
				{ type: "text", text: "Hello" },
				{ type: "text", text: " World" },
			]
			const result = processor.processMessageContent(content)
			expect(result).toBe("Hello World")
		})
	})

	describe("validateMessages", () => {
		it("should validate correct messages", () => {
			const messages: FlowMessage[] = [
				{ role: "system", content: "System prompt" },
				{ role: "user", content: "User message" },
				{ role: "assistant", content: "Assistant response" },
			]

			expect(processor.validateMessages(messages)).toBe(true)
		})

		it("should reject empty array", () => {
			expect(processor.validateMessages([])).toBe(false)
		})

		it("should reject messages with invalid role", () => {
			const messages: FlowMessage[] = [
				{ role: "invalid" as any, content: "Test" },
			]

			expect(processor.validateMessages(messages)).toBe(false)
		})

		it("should reject messages without content", () => {
			const messages: FlowMessage[] = [
				{ role: "user", content: "" },
			]

			expect(processor.validateMessages(messages)).toBe(false)
		})
	})

	describe("message creation helpers", () => {
		it("should create system message", () => {
			const message = processor.createSystemMessage("System prompt")
			expect(message).toEqual({
				role: "system",
				content: "System prompt",
			})
		})

		it("should create user message", () => {
			const message = processor.createUserMessage("User input")
			expect(message).toEqual({
				role: "user",
				content: "User input",
			})
		})

		it("should create assistant message", () => {
			const message = processor.createAssistantMessage("Assistant response")
			expect(message).toEqual({
				role: "assistant",
				content: "Assistant response",
			})
		})
	})

	describe("mergeConsecutiveMessages", () => {
		it("should merge consecutive messages with same role", () => {
			const messages: FlowMessage[] = [
				{ role: "user", content: "First" },
				{ role: "user", content: "Second" },
				{ role: "assistant", content: "Response" },
			]

			const result = processor.mergeConsecutiveMessages(messages)

			expect(result).toEqual([
				{ role: "user", content: "First\nSecond" },
				{ role: "assistant", content: "Response" },
			])
		})

		it("should not merge messages with different roles", () => {
			const messages: FlowMessage[] = [
				{ role: "user", content: "User message" },
				{ role: "assistant", content: "Assistant response" },
			]

			const result = processor.mergeConsecutiveMessages(messages)

			expect(result).toEqual(messages)
		})
	})

	describe("estimateTokenCount", () => {
		it("should estimate token count", () => {
			const messages: FlowMessage[] = [
				{ role: "user", content: "Hello" }, // 5 chars / 4 = 1.25 -> 2 tokens
				{ role: "assistant", content: "Hi there!" }, // 9 chars / 4 = 2.25 -> 3 tokens
			]

			const count = processor.estimateTokenCount(messages)
			expect(count).toBe(5) // 2 + 3 = 5 tokens
		})
	})

	describe("truncateMessages", () => {
		it("should keep system message and truncate others", () => {
			const messages: FlowMessage[] = [
				{ role: "system", content: "System" }, // ~2 tokens
				{ role: "user", content: "User1" }, // ~2 tokens
				{ role: "assistant", content: "Assistant1" }, // ~3 tokens
				{ role: "user", content: "User2" }, // ~2 tokens
			]

			const result = processor.truncateMessages(messages, 6)

			// Should keep system message and most recent messages that fit within token limit
			expect(result.length).toBeGreaterThan(0)
			expect(result[0].role).toBe("system") // System message should be first
			expect(result.some(msg => msg.content === "User2")).toBe(true) // Most recent should be included
		})

		it("should handle messages without system prompt", () => {
			const messages: FlowMessage[] = [
				{ role: "user", content: "User1" },
				{ role: "assistant", content: "Assistant1" },
				{ role: "user", content: "User2" },
			]

			const result = processor.truncateMessages(messages, 4)

			expect(result.length).toBeLessThanOrEqual(messages.length)
		})
	})
})
