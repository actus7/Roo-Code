import type { FlowConfig, FlowChatCompletionOptions, FlowEmbeddingOptions, FlowRequestOptions } from "./types"
import { FlowRequestBuilder } from "./request-builder"
import { FlowStreamProcessor } from "./stream-processor"
import { FlowMessageProcessor } from "./message-processor"
import { makeJsonRequest, makeStreamingRequest } from "./request-utils"
import { transformModelData, transformChatResponse } from "./model-utils"
import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Base interface for all commands
 */
export interface ICommand<T = any> {
	execute(): Promise<T>
	undo?(): Promise<void>
	canExecute(): boolean
	getDescription(): string
}

/**
 * Base abstract command class
 */
export abstract class BaseCommand<T = any> implements ICommand<T> {
	protected executed: boolean = false
	protected result?: T
	protected error?: Error

	abstract execute(): Promise<T>

	canExecute(): boolean {
		return !this.executed
	}

	abstract getDescription(): string

	async undo(): Promise<void> {
		// Default implementation - override in subclasses if needed
		this.executed = false
		this.result = undefined
		this.error = undefined
	}

	getResult(): T | undefined {
		return this.result
	}

	getError(): Error | undefined {
		return this.error
	}

	isExecuted(): boolean {
		return this.executed
	}
}

/**
 * Command for creating chat completions
 */
export class CreateChatCompletionCommand extends BaseCommand<any> {
	constructor(
		private readonly options: FlowChatCompletionOptions,
		private readonly requestBuilder: FlowRequestBuilder,
		private readonly config: FlowConfig
	) {
		super()
	}

	async execute(): Promise<any> {
		if (!this.canExecute()) {
			throw new Error("Command has already been executed")
		}

		try {
			const { url, headers, payload, provider } = await this.requestBuilder.buildChatRequest(this.options, false)

			const response = await makeJsonRequest(url, {
				method: "POST",
				headers,
				body: JSON.stringify(payload),
				timeout: this.config.flowRequestTimeout,
			})

			this.result = transformChatResponse(provider, response)
			this.executed = true
			return this.result
		} catch (error) {
			this.error = error instanceof Error ? error : new Error(String(error))
			this.executed = true
			throw this.error
		}
	}

	getDescription(): string {
		return `Create chat completion with model: ${this.options.model ?? "default"}`
	}
}

/**
 * Command for creating streaming chat completions
 */
export class CreateStreamingChatCommand extends BaseCommand<AsyncIterableIterator<any>> {
	constructor(
		private readonly systemPrompt: string,
		private readonly messages: Anthropic.Messages.MessageParam[],
		private readonly requestBuilder: FlowRequestBuilder,
		private readonly streamProcessor: FlowStreamProcessor,
		private readonly messageProcessor: FlowMessageProcessor,
		private readonly config: FlowConfig
	) {
		super()
	}

	async execute(): Promise<AsyncIterableIterator<any>> {
		if (!this.canExecute()) {
			throw new Error("Command has already been executed")
		}

		try {
			// Convert messages
			const flowMessages = this.messageProcessor.convertAnthropicMessages(this.systemPrompt, this.messages)
			const model = this.config.apiModelId ?? "gpt-4o-mini"
			const isO1Model = this.isO1OrO3Model(model)

			const options: FlowChatCompletionOptions = {
				model,
				messages: flowMessages,
				maxTokens: this.config.modelMaxTokens,
				...(isO1Model ? {} : { temperature: this.config.modelTemperature }),
			}

			// Build request
			const { url, headers, payload, provider } = await this.requestBuilder.buildChatRequest(options, true)

			// Execute streaming request
			const stream = await makeStreamingRequest(url, {
				method: "POST",
				headers,
				body: JSON.stringify(payload),
				timeout: this.config.flowRequestTimeout,
			})

			// Process stream
			this.result = this.streamProcessor.processStreamingResponse(stream, provider)
			this.executed = true
			return this.result
		} catch (error) {
			this.error = error instanceof Error ? error : new Error(String(error))
			this.executed = true
			throw this.error
		}
	}

	private isO1OrO3Model(model: string): boolean {
		return /^(o1|o3)(-|$)/.test(model)
	}

	getDescription(): string {
		return `Create streaming chat completion with ${this.messages.length} messages`
	}
}

/**
 * Command for creating embeddings
 */
export class CreateEmbeddingCommand extends BaseCommand<any> {
	constructor(
		private readonly options: FlowEmbeddingOptions,
		private readonly requestBuilder: FlowRequestBuilder,
		private readonly config: FlowConfig
	) {
		super()
	}

	async execute(): Promise<any> {
		if (!this.canExecute()) {
			throw new Error("Command has already been executed")
		}

		try {
			const { url, headers, payload } = await this.requestBuilder.buildEmbeddingRequest(this.options)

			const response = await makeJsonRequest(url, {
				method: "POST",
				headers,
				body: JSON.stringify(payload),
				timeout: this.config.flowRequestTimeout,
			})

			this.result = response
			this.executed = true
			return this.result
		} catch (error) {
			this.error = error instanceof Error ? error : new Error(String(error))
			this.executed = true
			throw this.error
		}
	}

	getDescription(): string {
		const inputType = Array.isArray(this.options.input) ? "array" : "string"
		return `Create embedding for ${inputType} input with model: ${this.options.model ?? "default"}`
	}
}

/**
 * Command for listing models
 */
export class ListModelsCommand extends BaseCommand<any[]> {
	constructor(
		private readonly options: FlowRequestOptions,
		private readonly requestBuilder: FlowRequestBuilder,
		private readonly config: FlowConfig
	) {
		super()
	}

	async execute(): Promise<any[]> {
		if (!this.canExecute()) {
			throw new Error("Command has already been executed")
		}

		try {
			const provider = this.options.provider ?? "azure-openai"
			const capabilities = this.options.capabilities ?? ["chat-conversation"]

			const { url, headers, params } = await this.requestBuilder.buildModelsRequest(provider, capabilities)

			const capabilitiesParam = params.capabilities ? `?capabilities=${params.capabilities}` : ""
			const fullUrl = `${url}/${provider}${capabilitiesParam}`

			const response = await makeJsonRequest(fullUrl, {
				method: "GET",
				headers,
				timeout: this.config.flowRequestTimeout,
			})

			this.result = response.map(transformModelData)
			this.executed = true
			return this.result
		} catch (error) {
			this.error = error instanceof Error ? error : new Error(String(error))
			this.executed = true
			throw this.error
		}
	}

	getDescription(): string {
		return `List models for provider: ${this.options.provider ?? "azure-openai"}`
	}
}

/**
 * Composite command for executing multiple commands
 */
export class CompositeCommand extends BaseCommand<any[]> {
	private commands: ICommand[] = []

	constructor(commands: ICommand[] = []) {
		super()
		this.commands = commands
	}

	addCommand(command: ICommand): this {
		this.commands.push(command)
		return this
	}

	removeCommand(command: ICommand): this {
		const index = this.commands.indexOf(command)
		if (index > -1) {
			this.commands.splice(index, 1)
		}
		return this
	}

	async execute(): Promise<any[]> {
		if (!this.canExecute()) {
			throw new Error("Composite command has already been executed")
		}

		const results: any[] = []
		const errors: Error[] = []

		try {
			for (const command of this.commands) {
				try {
					const result = await command.execute()
					results.push(result)
				} catch (error) {
					const commandError = error instanceof Error ? error : new Error(String(error))
					errors.push(commandError)
					results.push(null)
				}
			}

			this.result = results
			this.executed = true

			// If there were any errors, throw a composite error
			if (errors.length > 0) {
				const compositeError = new Error(`${errors.length} command(s) failed: ${errors.map(e => e.message).join(", ")}`)
				this.error = compositeError
				throw compositeError
			}

			return results
		} catch (error) {
			this.error = error instanceof Error ? error : new Error(String(error))
			this.executed = true
			throw this.error
		}
	}

	async undo(): Promise<void> {
		// Undo commands in reverse order
		for (let i = this.commands.length - 1; i >= 0; i--) {
			const command = this.commands[i]
			if (command.undo) {
				await command.undo()
			}
		}
		await super.undo()
	}

	getDescription(): string {
		return `Composite command with ${this.commands.length} sub-commands`
	}

	getCommands(): ICommand[] {
		return [...this.commands]
	}
}

/**
 * Command Invoker for managing command execution
 */
export class CommandInvoker {
	private history: ICommand[] = []
	private currentIndex: number = -1

	/**
	 * Execute a command and add it to history
	 */
	async execute<T>(command: ICommand<T>): Promise<T> {
		try {
			const result = await command.execute()

			// Add to history and update index
			this.history = this.history.slice(0, this.currentIndex + 1)
			this.history.push(command)
			this.currentIndex = this.history.length - 1

			return result
		} catch (error) {
			// Still add failed commands to history for debugging
			this.history = this.history.slice(0, this.currentIndex + 1)
			this.history.push(command)
			this.currentIndex = this.history.length - 1
			throw error
		}
	}

	/**
	 * Undo the last executed command
	 */
	async undo(): Promise<void> {
		if (this.currentIndex < 0) {
			throw new Error("No commands to undo")
		}

		const command = this.history[this.currentIndex]
		if (command.undo) {
			await command.undo()
		}
		this.currentIndex--
	}

	/**
	 * Redo the next command in history
	 */
	async redo(): Promise<any> {
		if (this.currentIndex >= this.history.length - 1) {
			throw new Error("No commands to redo")
		}

		this.currentIndex++
		const command = this.history[this.currentIndex]
		return await command.execute()
	}

	/**
	 * Get command history
	 */
	getHistory(): ICommand[] {
		return [...this.history]
	}

	/**
	 * Get current command index
	 */
	getCurrentIndex(): number {
		return this.currentIndex
	}

	/**
	 * Clear command history
	 */
	clearHistory(): void {
		this.history = []
		this.currentIndex = -1
	}

	/**
	 * Check if undo is possible
	 */
	canUndo(): boolean {
		return this.currentIndex >= 0
	}

	/**
	 * Check if redo is possible
	 */
	canRedo(): boolean {
		return this.currentIndex < this.history.length - 1
	}

	/**
	 * Get the last executed command
	 */
	getLastCommand(): ICommand | undefined {
		return this.currentIndex >= 0 ? this.history[this.currentIndex] : undefined
	}

	/**
	 * Execute multiple commands in sequence
	 */
	async executeSequence(commands: ICommand[]): Promise<any[]> {
		const results: any[] = []
		for (const command of commands) {
			const result = await this.execute(command)
			results.push(result)
		}
		return results
	}

	/**
	 * Execute multiple commands in parallel
	 */
	async executeParallel(commands: ICommand[]): Promise<any[]> {
		const promises = commands.map(command => this.execute(command))
		return await Promise.all(promises)
	}
}

/**
 * Command Factory for creating Flow commands
 */
export class FlowCommandFactory {
	constructor(
		private readonly requestBuilder: FlowRequestBuilder,
		private readonly streamProcessor: FlowStreamProcessor,
		private readonly messageProcessor: FlowMessageProcessor,
		private readonly config: FlowConfig
	) {}

	/**
	 * Create a chat completion command
	 */
	createChatCompletionCommand(options: FlowChatCompletionOptions): CreateChatCompletionCommand {
		return new CreateChatCompletionCommand(options, this.requestBuilder, this.config)
	}

	/**
	 * Create a streaming chat command
	 */
	createStreamingChatCommand(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[]
	): CreateStreamingChatCommand {
		return new CreateStreamingChatCommand(
			systemPrompt,
			messages,
			this.requestBuilder,
			this.streamProcessor,
			this.messageProcessor,
			this.config
		)
	}

	/**
	 * Create an embedding command
	 */
	createEmbeddingCommand(options: FlowEmbeddingOptions): CreateEmbeddingCommand {
		return new CreateEmbeddingCommand(options, this.requestBuilder, this.config)
	}

	/**
	 * Create a list models command
	 */
	createListModelsCommand(options: FlowRequestOptions = {}): ListModelsCommand {
		return new ListModelsCommand(options, this.requestBuilder, this.config)
	}

	/**
	 * Create a composite command
	 */
	createCompositeCommand(commands: ICommand[] = []): CompositeCommand {
		return new CompositeCommand(commands)
	}

	/**
	 * Create a command invoker
	 */
	createInvoker(): CommandInvoker {
		return new CommandInvoker()
	}

	/**
	 * Create a batch command for multiple chat completions
	 */
	createBatchChatCommand(optionsArray: FlowChatCompletionOptions[]): CompositeCommand {
		const commands = optionsArray.map(options => this.createChatCompletionCommand(options))
		return new CompositeCommand(commands)
	}

	/**
	 * Create a batch command for multiple embeddings
	 */
	createBatchEmbeddingCommand(optionsArray: FlowEmbeddingOptions[]): CompositeCommand {
		const commands = optionsArray.map(options => this.createEmbeddingCommand(options))
		return new CompositeCommand(commands)
	}

	/**
	 * Create a command for getting models from multiple providers
	 */
	createMultiProviderModelsCommand(providers: string[]): CompositeCommand {
		const commands = providers.map(provider =>
			this.createListModelsCommand({ provider })
		)
		return new CompositeCommand(commands)
	}
}
