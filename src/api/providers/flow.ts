/**
 * Flow Provider - Main Entry Point
 *
 * This file serves as the main entry point for the Flow provider,
 * re-exporting the modularized FlowHandler and related components.
 *
 * The actual implementation has been moved to ./flow/flow-handler.ts
 * following the Single Responsibility Principle and modular architecture.
 */

import type { ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { Anthropic } from "@anthropic-ai/sdk"

import { initializeFlowConfig, validateFlowConfig } from "./flow/config"
import { debug } from "./flow/utils"
import type { FlowConfig } from "./flow/types"
import { BaseProvider } from "./base-provider"

// Re-export all Flow components for external use
export * from "./flow"

/**
 * Flow Provider Handler - Compatibility Wrapper
 *
 * This class maintains backward compatibility while delegating to the modularized FlowHandler.
 * The actual implementation is in ./flow/flow-handler.ts following SRP principles.
 *
 * Provides unified access to multiple LLM providers through Flow API:
 * - Azure OpenAI (GPT-4, GPT-4O, embeddings)
 * - Google Gemini (2.0 Flash, 2.5 Pro)
 * - Amazon Bedrock (Claude, Nova, Llama)
 * - Azure Foundry (DeepSeek-R1)
 */
export class FlowHandler extends BaseProvider {
	private readonly modularHandler: import("./flow/flow-handler").FlowHandler

	constructor(options: ApiHandlerOptions) {
		super()

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
			modelTemperature: options.modelTemperature ?? undefined,
			modelMaxTokens: options.modelMaxTokens,
			flowRequestTimeout: options.flowRequestTimeout,
		}

		const config = initializeFlowConfig(partialConfig)
		validateFlowConfig(config)

		// Import and initialize the modular handler
		const { FlowHandler: ModularFlowHandler } = require("./flow/flow-handler")
		this.modularHandler = new ModularFlowHandler(config)

		debug("FlowHandler wrapper initialized", {
			baseUrl: config.flowBaseUrl,
			tenant: config.flowTenant,
			agent: config.flowAgent,
			modelId: config.apiModelId,
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
		yield* this.modularHandler.createMessage(systemPrompt, messages, metadata)
	}

	/**
	 * Get model information
	 */
	override getModel(): { id: string; info: ModelInfo } {
		return this.modularHandler.getModel()
	}

	/**
	 * List available models for a specific provider
	 */
	async listModels(options?: import("./flow/types").FlowRequestOptions): Promise<import("./flow/types").Model[]> {
		return this.modularHandler.listModels(options)
	}

	/**
	 * Create chat completion (non-streaming)
	 */
	async createChatCompletion(options: import("./flow/types").FlowChatCompletionOptions): Promise<import("./flow/types").ChatCompletionResponse> {
		return this.modularHandler.createChatCompletion(options)
	}

	/**
	 * Create embeddings
	 */
	async createEmbedding(options: import("./flow/types").FlowEmbeddingOptions): Promise<import("./flow/types").EmbeddingResponse> {
		return this.modularHandler.createEmbedding(options)
	}

	/**
	 * Get the command factory for advanced command operations
	 */
	getCommandFactory(): import("./flow/commands").FlowCommandFactory {
		return this.modularHandler.getCommandFactory()
	}

	/**
	 * Get the command invoker for command history and undo/redo operations
	 */
	getCommandInvoker(): import("./flow/commands").CommandInvoker {
		return this.modularHandler.getCommandInvoker()
	}

	/**
	 * Execute multiple commands in batch
	 */
	async executeBatchCommands(commands: any[]): Promise<any[]> {
		return this.modularHandler.executeBatchCommands(commands)
	}

	/**
	 * Undo the last executed command
	 */
	async undoLastCommand(): Promise<void> {
		return this.modularHandler.undoLastCommand()
	}

	/**
	 * Get command execution history
	 */
	getCommandHistory(): any[] {
		return this.modularHandler.getCommandHistory()
	}
}
