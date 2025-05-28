/**
 * Flow Provider Module - Main Entry Point
 *
 * This module provides a centralized export point for all Flow-related components,
 * following the modular architecture with Single Responsibility Principle.
 */

// Core Handler
export { FlowHandler } from './flow-handler'

// Interfaces - Contract Definitions
export * from './interfaces'

// Configuration and Authentication
export { SecureTokenManager as TokenManager } from './secure-token-manager'
export { initializeFlowConfig, validateFlowConfig } from './config'
export type { FlowConfig } from './types'

// Message Processing
export { FlowMessageProcessor } from './message-processor'

// Stream Processing
export { FlowStreamProcessor } from './stream-processor'

// Request Building
export { FlowRequestBuilder } from './request-builder'

// Builder Pattern Components
export {
	ChatRequestBuilder,
	EmbeddingRequestBuilder,
	ModelsRequestBuilder,
	FlowRequestBuilderFactory
} from './request-builders'

// Command Pattern Components
export {
	CreateChatCompletionCommand,
	CreateStreamingChatCommand,
	CreateEmbeddingCommand,
	ListModelsCommand,
	CompositeCommand,
	CommandInvoker,
	FlowCommandFactory,
	BaseCommand
} from './commands'

// Utilities and Helpers
export {
	makeJsonRequest,
	makeStreamingRequest,
	handleHttpError,
	createFlowHeaders
} from './request-utils'

export {
	determineProvider,
	getProviderEndpoint,
	transformModelData,
	transformChatResponse
} from './model-utils'

export {
	generateProviderPayload,
	generateEmbeddingPayload,
	validatePayload
} from './payload-generator'

export { debug } from './utils'
export { secureLogger } from './secure-logger'
export { securityAuditTrail } from './audit-trail'

// Types
export type {
	FlowChatCompletionOptions,
	FlowEmbeddingOptions,
	FlowRequestOptions,
	FlowProvider,
	FlowCapability,
	FlowModel,
	FlowChatMessage,
	FlowEmbeddingRequest,
	FlowModelsRequest,
	ChatCompletionResponse,
	EmbeddingResponse,
	Model
} from './types'

// Model Service
export { FlowModelService } from './model-service'

// Enhanced Features
export { EnhancedRetryService } from './enhanced-retry'
export { CredentialValidator } from './credential-validator'
export { DataSanitizer } from './data-sanitizer'
export { EncryptionService } from './encryption-service'
export { LoggingMonitor } from './logging-monitor'
export { SecureTokenManager } from './secure-token-manager'

/**
 * Default export - FlowHandler for convenience
 */
export { FlowHandler as default } from './flow-handler'
