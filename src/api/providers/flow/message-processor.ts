import { Anthropic } from "@anthropic-ai/sdk"
import type { FlowMessage } from "./types"
import { IFlowMessageProcessor } from "./interfaces"

/**
 * Flow Message Processor
 *
 * Responsible for converting and processing messages between different formats.
 * Handles Anthropic to Flow message conversion and content processing.
 */
export class FlowMessageProcessor implements IFlowMessageProcessor {
	/**
	 * Convert Anthropic messages to Flow format
	 */
	convertAnthropicMessages(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[]
	): FlowMessage[] {
		const flowMessages: FlowMessage[] = []

		// Add system message if provided
		if (systemPrompt) {
			flowMessages.push({
				role: "system",
				content: systemPrompt,
			})
		}

		// Convert Anthropic messages
		for (const message of messages) {
			const content = this.processMessageContent(message.content)

			flowMessages.push({
				role: message.role as "user" | "assistant",
				content,
			})
		}

		return flowMessages
	}

	/**
	 * Process message content blocks
	 */
	processMessageContent(content: Anthropic.Messages.MessageParam["content"]): string {
		if (Array.isArray(content)) {
			return this.extractTextContent(content)
		}
		return content
	}

	/**
	 * Extract text content from complex message structures
	 */
	extractTextContent(content: Anthropic.Messages.ContentBlock[]): string {
		return content
			.map((block) => {
				if (block.type === "text") {
					return block.text
				}
				// Handle other content types as needed
				// For now, we only support text content
				return ""
			})
			.join("")
	}

	/**
	 * Validate single message format
	 */
	validateMessage(message: any): boolean {
		// Check required fields
		if (!message.role || !message.content) {
			return false
		}

		// Validate role
		if (!["system", "user", "assistant"].includes(message.role)) {
			return false
		}

		// Validate content
		if (typeof message.content !== "string" && !Array.isArray(message.content)) {
			return false
		}

		return true
	}

	/**
	 * Validate message format
	 */
	validateMessages(messages: FlowMessage[]): boolean {
		if (!Array.isArray(messages) || messages.length === 0) {
			return false
		}

		return messages.every(message => {
			// Check required fields
			if (!message.role || !message.content) {
				return false
			}

			// Validate role
			if (!["system", "user", "assistant"].includes(message.role)) {
				return false
			}

			// Validate content
			if (typeof message.content !== "string" && !Array.isArray(message.content)) {
				return false
			}

			return true
		})
	}

	/**
	 * Create a system message
	 */
	createSystemMessage(content: string): FlowMessage {
		return {
			role: "system",
			content,
		}
	}

	/**
	 * Create a user message
	 */
	createUserMessage(content: string): FlowMessage {
		return {
			role: "user",
			content,
		}
	}

	/**
	 * Create an assistant message
	 */
	createAssistantMessage(content: string): FlowMessage {
		return {
			role: "assistant",
			content,
		}
	}

	/**
	 * Merge consecutive messages with the same role
	 */
	mergeConsecutiveMessages(messages: FlowMessage[]): FlowMessage[] {
		if (messages.length <= 1) {
			return messages
		}

		const merged: FlowMessage[] = []
		let current = messages[0]

		for (let i = 1; i < messages.length; i++) {
			const next = messages[i]

			if (current.role === next.role) {
				// Merge content
				const currentContent = typeof current.content === "string" ? current.content : ""
				const nextContent = typeof next.content === "string" ? next.content : ""
				current = {
					...current,
					content: currentContent + "\n" + nextContent,
				}
			} else {
				merged.push(current)
				current = next
			}
		}

		merged.push(current)
		return merged
	}

	/**
	 * Count tokens in messages (approximate)
	 */
	estimateTokenCount(messages: FlowMessage[]): number {
		return messages.reduce((total, message) => {
			const content = typeof message.content === "string" ? message.content : ""
			// Rough estimation: 1 token ≈ 4 characters
			return total + Math.ceil(content.length / 4)
		}, 0)
	}

	/**
	 * Truncate messages to fit within token limit
	 */
	truncateMessages(messages: FlowMessage[], maxTokens: number): FlowMessage[] {
		if (messages.length === 0) {
			return []
		}

		const result: FlowMessage[] = []
		let currentTokens = 0

		// Find system message
		const systemMessage = messages.find(msg => msg.role === "system")

		// Always keep system message if present and add it first
		if (systemMessage) {
			result.push(systemMessage)
			currentTokens += this.estimateTokenCount([systemMessage])
		}

		// Get non-system messages in reverse order (most recent first)
		const nonSystemMessages = messages
			.filter(msg => msg.role !== "system")
			.reverse()

		// Add messages from most recent, respecting token limit
		const messagesToAdd: FlowMessage[] = []
		for (const message of nonSystemMessages) {
			const messageTokens = this.estimateTokenCount([message])

			if (currentTokens + messageTokens <= maxTokens) {
				messagesToAdd.unshift(message) // Add to beginning to maintain chronological order
				currentTokens += messageTokens
			} else {
				break
			}
		}

		// Add the selected messages after system message
		result.push(...messagesToAdd)

		return result
	}
}
