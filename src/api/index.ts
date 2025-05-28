import { Anthropic } from "@anthropic-ai/sdk"

import type { ProviderSettings, ModelInfo } from "@roo-code/types"

import { ApiStream } from "./transform/stream"

import {
	GlamaHandler,
	AnthropicHandler,
	AwsBedrockHandler,
	OpenRouterHandler,
	VertexHandler,
	AnthropicVertexHandler,
	OpenAiHandler,
	OllamaHandler,
	LmStudioHandler,
	GeminiHandler,
	OpenAiNativeHandler,
	DeepSeekHandler,
	MistralHandler,
	VsCodeLmHandler,
	UnboundHandler,
	RequestyHandler,
	HumanRelayHandler,
	FakeAIHandler,
	XAIHandler,
	GroqHandler,
	ChutesHandler,
	LiteLLMHandler,
	FlowHandler,
} from "./providers"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandlerCreateMessageMetadata {
	mode?: string
	taskId: string
}

export interface ApiHandler {
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	getModel(): { id: string; info: ModelInfo }

	/**
	 * Counts tokens for content blocks
	 * All providers extend BaseProvider which provides a default tiktoken implementation,
	 * but they can override this to use their native token counting endpoints
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
}

export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
	const { apiProvider, ...options } = configuration

	console.log("🏗️ [buildApiHandler] Construindo handler:", {
		apiProvider,
		apiModelId: options.apiModelId,
		hasApiKey: !!options.apiKey,
		hasFlowTenant: !!(options as any).flowTenant,
		hasFlowClientId: !!(options as any).flowClientId,
		hasFlowClientSecret: !!(options as any).flowClientSecret,
	})

	switch (apiProvider) {
		case "anthropic":
			console.log("📦 [buildApiHandler] Criando AnthropicHandler")
			return new AnthropicHandler(options)
		case "glama":
			console.log("📦 [buildApiHandler] Criando GlamaHandler")
			return new GlamaHandler(options)
		case "openrouter":
			console.log("📦 [buildApiHandler] Criando OpenRouterHandler")
			return new OpenRouterHandler(options)
		case "bedrock":
			console.log("📦 [buildApiHandler] Criando AwsBedrockHandler")
			return new AwsBedrockHandler(options)
		case "vertex":
			const isClaudeVertex = options.apiModelId?.startsWith("claude")
			console.log("📦 [buildApiHandler] Criando VertexHandler:", { isClaudeVertex })
			return isClaudeVertex ? new AnthropicVertexHandler(options) : new VertexHandler(options)
		case "openai":
			console.log("📦 [buildApiHandler] Criando OpenAiHandler")
			return new OpenAiHandler(options)
		case "ollama":
			console.log("📦 [buildApiHandler] Criando OllamaHandler")
			return new OllamaHandler(options)
		case "lmstudio":
			console.log("📦 [buildApiHandler] Criando LmStudioHandler")
			return new LmStudioHandler(options)
		case "gemini":
			console.log("📦 [buildApiHandler] Criando GeminiHandler")
			return new GeminiHandler(options)
		case "openai-native":
			console.log("📦 [buildApiHandler] Criando OpenAiNativeHandler")
			return new OpenAiNativeHandler(options)
		case "deepseek":
			console.log("📦 [buildApiHandler] Criando DeepSeekHandler")
			return new DeepSeekHandler(options)
		case "vscode-lm":
			console.log("📦 [buildApiHandler] Criando VsCodeLmHandler")
			return new VsCodeLmHandler(options)
		case "mistral":
			console.log("📦 [buildApiHandler] Criando MistralHandler")
			return new MistralHandler(options)
		case "unbound":
			console.log("📦 [buildApiHandler] Criando UnboundHandler")
			return new UnboundHandler(options)
		case "requesty":
			console.log("📦 [buildApiHandler] Criando RequestyHandler")
			return new RequestyHandler(options)
		case "human-relay":
			console.log("📦 [buildApiHandler] Criando HumanRelayHandler")
			return new HumanRelayHandler()
		case "fake-ai":
			console.log("📦 [buildApiHandler] Criando FakeAIHandler")
			return new FakeAIHandler(options)
		case "xai":
			console.log("📦 [buildApiHandler] Criando XAIHandler")
			return new XAIHandler(options)
		case "groq":
			console.log("📦 [buildApiHandler] Criando GroqHandler")
			return new GroqHandler(options)
		case "chutes":
			console.log("📦 [buildApiHandler] Criando ChutesHandler")
			return new ChutesHandler(options)
		case "litellm":
			console.log("📦 [buildApiHandler] Criando LiteLLMHandler")
			return new LiteLLMHandler(options)
		case "flow":
			console.log("📦 [buildApiHandler] Criando FlowHandler")
			return new FlowHandler(options)
		default:
			console.log("📦 [buildApiHandler] Provider não reconhecido, usando AnthropicHandler como padrão")
			return new AnthropicHandler(options)
	}
}
