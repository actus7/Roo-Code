/**
 * FlowHandler - Main orchestrator for Flow API operations
 *
 * This class serves as the primary interface for Flow API operations,
 * orchestrating various specialized components following SRP principles.
 */

import { Anthropic } from "@anthropic-ai/sdk"
import { BaseProvider } from "../base-provider"
import type {
	ApiHandlerCreateMessageMetadata,
	ApiStream,
	Model,
	ChatCompletionResponse,
	EmbeddingResponse,
} from "../../types"
import type {
	FlowConfig,
	FlowChatCompletionOptions,
	FlowEmbeddingOptions,
	FlowRequestOptions,
} from "./types"
import { SecureTokenManager as TokenManager } from "./secure-token-manager"
import { FlowMessageProcessor } from "./message-processor"
import { FlowStreamProcessor } from "./stream-processor"
import { FlowRequestBuilder } from "./request-builder"
import { FlowCommandFactory, CommandInvoker } from "./commands"
import { handleHttpError } from "./request-utils"
import { debug } from "./utils"
import { secureLogger } from "./secure-logger"
import { securityAuditTrail } from "./audit-trail"

/**
 * FlowHandler - Main orchestrator class for Flow API operations
 *
 * Responsibilities:
 * - Orchestrate Flow API operations using specialized components
 * - Manage authentication and configuration
 * - Provide high-level API for chat, embedding, and model operations
 * - Implement Command Pattern for operation management
 * - Handle logging, security, and error management
 */
export class FlowHandler extends BaseProvider {
	private readonly config: FlowConfig
	private readonly correlationId: string
	private readonly tokenManager: TokenManager
	private readonly messageProcessor: FlowMessageProcessor
	private readonly streamProcessor: FlowStreamProcessor
	private readonly requestBuilder: FlowRequestBuilder
	private readonly commandFactory: FlowCommandFactory
	private readonly commandInvoker: CommandInvoker

	constructor(config: FlowConfig) {
		super()
		this.config = config
		this.correlationId = secureLogger.generateCorrelationId()

		// Initialize core components
		this.tokenManager = new TokenManager(this.config)
		this.messageProcessor = new FlowMessageProcessor()
		this.streamProcessor = new FlowStreamProcessor()
		this.requestBuilder = new FlowRequestBuilder(this.config, this.tokenManager)

		// Initialize command pattern components
		this.commandFactory = new FlowCommandFactory(
			this.requestBuilder,
			this.streamProcessor,
			this.messageProcessor,
			this.config
		)
		this.commandInvoker = new CommandInvoker()

		secureLogger.logInfo("FlowHandler inicializado", {
			correlationId: this.correlationId,
			operation: "initialization",
			hasConfig: !!this.config,
			configKeys: Object.keys(this.config),
		})
	}

	/**
	 * Create a chat message with streaming support using Command Pattern
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		this.logCreateMessageStart(systemPrompt, messages, metadata)
		await this.logApiAccessEvent()

		try {
			// Create and execute streaming chat command using Command Pattern
			const command = this.commandFactory.createStreamingChatCommand(systemPrompt, messages)

			secureLogger.logDebug("Executando comando de streaming via Command Pattern", {
				correlationId: this.correlationId,
				operation: "command_execution",
				commandDescription: command.getDescription(),
				canExecute: command.canExecute(),
			})

			const streamIterator = await this.commandInvoker.execute(command)

			secureLogger.logDebug("Comando executado com sucesso", {
				correlationId: this.correlationId,
				operation: "command_executed",
				commandDescription: command.getDescription(),
				isExecuted: command.isExecuted(),
			})

			yield* streamIterator
		} catch (error) {
			this.handleCreateMessageError(error)
		}
	}

	/**
	 * Log the start of createMessage operation
	 */
	private logCreateMessageStart(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata
	): void {
		secureLogger.logRequest("POST", "createMessage", {
			correlationId: this.correlationId,
			operation: "createMessage",
			systemPromptLength: systemPrompt.length,
			messagesCount: messages.length,
			hasMetadata: !!metadata,
		})
	}

	/**
	 * Log API access event for audit trail
	 */
	private async logApiAccessEvent(): Promise<void> {
		await securityAuditTrail.logApiAccessEvent(
			"POST",
			"createMessage",
			this.correlationId,
			"success", // Will be updated if error occurs
			{
				statusCode: 200 // Will be updated with actual status
			}
		)
	}

	/**
	 * Handle createMessage errors
	 */
	private handleCreateMessageError(error: unknown): never {
		secureLogger.logError("Erro no createMessage", error instanceof Error ? error : new Error(String(error)), {
			correlationId: this.correlationId,
			operation: "createMessage"
		})

		const enhancedError = handleHttpError(error, "Flow chat completion")
		debug("Chat completion error", { error: enhancedError.message })
		throw enhancedError
	}

	/**
	 * List available models for a specific provider using Command Pattern
	 */
	async listModels(options?: FlowRequestOptions): Promise<Model[]> {
		try {
			// Create and execute list models command using Command Pattern
			const command = this.commandFactory.createListModelsCommand(options)

			secureLogger.logDebug("Executando comando de listagem de modelos", {
				correlationId: this.correlationId,
				operation: "list_models_command",
				commandDescription: command.getDescription(),
			})

			const result = await this.commandInvoker.execute(command)

			secureLogger.logDebug("Comando de listagem executado com sucesso", {
				correlationId: this.correlationId,
				operation: "list_models_executed",
				modelsCount: result.length,
			})

			return result
		} catch (error) {
			const enhancedError = handleHttpError(error, "Flow model listing")
			debug("Model listing error", { error: enhancedError.message })
			throw enhancedError
		}
	}

	/**
	 * Create chat completion (non-streaming) using Command Pattern
	 */
	async createChatCompletion(options: FlowChatCompletionOptions): Promise<ChatCompletionResponse> {
		try {
			// Create and execute chat completion command using Command Pattern
			const command = this.commandFactory.createChatCompletionCommand(options)

			secureLogger.logDebug("Executando comando de chat completion", {
				correlationId: this.correlationId,
				operation: "chat_completion_command",
				commandDescription: command.getDescription(),
			})

			const result = await this.commandInvoker.execute(command)

			secureLogger.logDebug("Comando de chat completion executado com sucesso", {
				correlationId: this.correlationId,
				operation: "chat_completion_executed",
			})

			return result
		} catch (error) {
			const enhancedError = handleHttpError(error, "Flow chat completion")
			debug("Chat completion error", { error: enhancedError.message })
			throw enhancedError
		}
	}

	/**
	 * Create embeddings using Command Pattern
	 */
	async createEmbedding(options: FlowEmbeddingOptions): Promise<EmbeddingResponse> {
		try {
			// Create and execute embedding command using Command Pattern
			const command = this.commandFactory.createEmbeddingCommand(options)

			secureLogger.logDebug("Executando comando de embedding", {
				correlationId: this.correlationId,
				operation: "embedding_command",
				commandDescription: command.getDescription(),
			})

			const result = await this.commandInvoker.execute(command)

			secureLogger.logDebug("Comando de embedding executado com sucesso", {
				correlationId: this.correlationId,
				operation: "embedding_executed",
			})

			return result
		} catch (error) {
			const enhancedError = handleHttpError(error, "Flow embedding creation")
			debug("Embedding creation error", { error: enhancedError.message })
			throw enhancedError
		}
	}

	/**
	 * Get model information
	 */
	override getModel(): { id: string; info: ModelInfo } {
		const id = this.config.apiModelId ?? "gpt-4o-mini"

		// Basic model info - in a real implementation, this would come from the models API
		const info: ModelInfo = {
			maxTokens: this.config.modelMaxTokens ?? 4096,
			contextWindow: 128000,
			supportsImages: true,
			supportsPromptCache: false,
			inputPrice: 0.15,
			outputPrice: 0.6,
		}

		return { id, info }
	}

	/**
	 * Check if model is O1 or O3 type
	 */
	private isO1OrO3Model(modelId: string): boolean {
		const o1o3Models = ["o1-mini", "o1-preview", "o3-mini"]
		return o1o3Models.some(model => modelId === model || modelId.startsWith(model + "-"))
	}

	/**
	 * Get the command factory for advanced command operations
	 */
	getCommandFactory(): FlowCommandFactory {
		return this.commandFactory
	}

	/**
	 * Get the command invoker for command history and undo/redo operations
	 */
	getCommandInvoker(): CommandInvoker {
		return this.commandInvoker
	}

	/**
	 * Execute multiple commands in batch
	 */
	async executeBatchCommands(commands: any[]): Promise<any[]> {
		try {
			const compositeCommand = this.commandFactory.createCompositeCommand(commands)

			secureLogger.logDebug("Executando batch de comandos", {
				correlationId: this.correlationId,
				operation: "batch_commands",
				commandsCount: commands.length,
				commandDescription: compositeCommand.getDescription(),
			})

			const results = await this.commandInvoker.execute(compositeCommand)

			secureLogger.logDebug("Batch de comandos executado com sucesso", {
				correlationId: this.correlationId,
				operation: "batch_commands_executed",
				resultsCount: results.length,
			})

			return results
		} catch (error) {
			const enhancedError = handleHttpError(error, "Flow batch command execution")
			debug("Batch command error", { error: enhancedError.message })
			throw enhancedError
		}
	}

	/**
	 * Undo the last executed command
	 */
	async undoLastCommand(): Promise<void> {
		try {
			if (!this.commandInvoker.canUndo()) {
				throw new Error("No commands to undo")
			}

			await this.commandInvoker.undo()

			secureLogger.logDebug("Comando desfeito com sucesso", {
				correlationId: this.correlationId,
				operation: "command_undo",
			})
		} catch (error) {
			const enhancedError = handleHttpError(error, "Flow command undo")
			debug("Command undo error", { error: enhancedError.message })
			throw enhancedError
		}
	}

	/**
	 * Get command execution history
	 */
	getCommandHistory(): any[] {
		return this.commandInvoker.getHistory()
	}
}
