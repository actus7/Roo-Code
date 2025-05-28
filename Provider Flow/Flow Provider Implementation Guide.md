# Flow Provider Implementation Guide for Roo Code - Versão Atualizada

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Current Implementation Status](#current-implementation-status)
4. [Implementation](#implementation)
   - [File Structure](#file-structure)
   - [Core Components](#core-components)
5. [Authentication](#authentication)
6. [Model Management](#model-management)
7. [UI Components](#ui-components)
8. [Backend Integration](#backend-integration)
9. [Cache System](#cache-system)
10. [API Integration](#api-integration)
11. [Error Handling and Best Practices](#error-handling-and-best-practices)
12. [Advanced Features](#advanced-features)
13. [Troubleshooting](#troubleshooting)

## Introduction

The Flow Provider is an AI orchestration platform that serves as an abstraction layer between applications and various LLM providers (Azure OpenAI, Google Gemini, Amazon Bedrock, Azure Foundry). The implementation in Roo Code is now **COMPLETE** and includes advanced features for production use.

**Key Benefits:**
- Unified access to multiple LLM providers
- Centralized authentication and credential management with automatic token renewal
- Standardized request/response format
- Built-in streaming support with SSE parsing
- Integrated monitoring via FlowAgent
- **NEW**: Intelligent model caching with TTL
- **NEW**: Auto-loading model selector with fallback support
- **NEW**: Automatic model mapping for incompatible models
- **NEW**: Backend integration for connection testing
- **NEW**: Comprehensive debug utilities
- **NEW**: Advanced SSE streaming with chunk fragmentation handling
- **NEW**: Dual algorithm chunk extraction with regex and line-by-line fallback
- **NEW**: Provider-specific streaming transformations
- **NEW**: Request utilities with exponential backoff and jitter
- **NEW**: Payload generation with O1/O3 model special handling

## Current Implementation Status

✅ **COMPLETED FEATURES:**
- Core FlowHandler with streaming support and SSE chunk processing
- TokenManager with automatic renewal (1-minute safety margin)
- FlowModelService with hardcoded model fallbacks and multi-provider support
- FlowModelSelector UI component with auto-load and cache indicators
- FlowModelCache with TTL (60min) and configuration-based invalidation
- Backend message handlers (testFlowConnection, fetchFlowModels)
- Model validation and automatic mapping for incompatible Anthropic models
- Comprehensive error handling with exponential backoff and jitter
- Debug utilities and console tools (FlowModelCacheDebug)
- Test scripts and integration tests
- Provider-specific payload generation with O1/O3 special handling
- Advanced streaming with dual algorithm chunk extraction
- Request utilities with timeout and retry mechanisms

## Architecture Overview

Flow acts as a middleware between Roo Code and the underlying LLM providers:

```
┌───────────┐     ┌──────────────┐     ┌─────────────────┐
│  Roo Code │────▶│ Flow Provider│────▶│ Azure OpenAI    │
└───────────┘     │              │     └─────────────────┘
                  │              │     ┌─────────────────┐
                  │              │────▶│ Google Gemini   │
                  │              │     └─────────────────┘
                  │              │     ┌─────────────────┐
                  │              │────▶│ Amazon Bedrock  │
                  │              │     └─────────────────┘
                  │              │     ┌─────────────────┐
                  │              │────▶│ Azure Foundry   │
                  └──────────────┘     └─────────────────┘
```

The Flow Provider handles:
- Authentication and token management
- Request transformation for each provider
- Response normalization
- Error handling and retries
- Streaming response processing

## Implementation

### File Structure

The Flow Provider is implemented with the following complete file structure:

```
src/api/providers/
├── flow.ts                  # FlowHandler - Main implementation ✅
├── flow/
│   ├── auth.ts             # TokenManager - Authentication management ✅
│   ├── config.ts           # Configuration, constants, and mappings ✅
│   ├── model-service.ts    # FlowModelService - Model discovery ✅
│   ├── model-utils.ts      # Model handling utilities ✅
│   ├── payload-generator.ts # Provider-specific payload generation ✅
│   ├── request-utils.ts    # HTTP request utilities ✅
│   ├── types.ts            # TypeScript type definitions ✅
│   └── utils.ts            # General utilities and debug ✅

webview-ui/src/components/settings/providers/
├── Flow.tsx                # Main Flow configuration component ✅
├── FlowModelSelector.tsx   # Model selector with auto-load ✅
└── __tests__/              # Component tests ✅

webview-ui/src/utils/
├── flowModelCache.ts       # Model caching system ✅
└── __tests__/
    └── flowModelCache.test.ts # Cache tests ✅

webview-ui/src/hooks/
└── useFlowModelCache.ts    # Cache management hook ✅

src/core/webview/
└── webviewMessageHandler.ts # Backend integration ✅
    ├── testFlowConnection   # Connection testing handler
    └── fetchFlowModels      # Model fetching handler
```

### Core Components

#### FlowHandler Class

The `FlowHandler` class should implement the core provider interface:

```typescript
// flow.ts
import { BaseProvider } from './base-provider';
import { generatePayload } from './flow/payload-generator';
import { makeRequest } from './flow/request-utils';
import { FlowConfig, FlowRequestOptions } from './flow/types';

export class FlowHandler extends BaseProvider {
  private config: FlowConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: FlowConfig) {
    super();
    this.config = {
      ...config,
      flowBaseUrl: config.flowBaseUrl || 'https://flow.ciandt.com',
      flowAuthBaseUrl: config.flowAuthBaseUrl || config.flowBaseUrl || 'https://flow.ciandt.com',
      flowAppToAccess: config.flowAppToAccess || 'llm-api',
      flowAgent: config.flowAgent || 'chat',
      flowRequestTimeout: config.flowRequestTimeout || 30000,
      modelTemperature: config.modelTemperature || 0.7,
    };
  }

  async authenticate(): Promise<string> {
    // Implementation of authentication logic
    // Returns a valid access token
  }

  async listModels(options?: FlowRequestOptions): Promise<Model[]> {
    // Implementation of model listing
  }

  async createChatCompletion(options: FlowChatCompletionOptions): Promise<ChatCompletionResponse> {
    // Implementation of chat completion
  }

  async createEmbedding(options: FlowEmbeddingOptions): Promise<EmbeddingResponse> {
    // Implementation of embedding creation
  }

  async streamChatCompletion(options: FlowChatCompletionOptions): Promise<AsyncIterableIterator<ChatCompletionChunk>> {
    // Implementation of streaming chat completion
  }
}
```

## Authentication

Flow uses OAuth2 token-based authentication with automatic renewal via the `TokenManager` class:

```typescript
// flow/auth.ts - TokenManager Implementation
export class TokenManager {
    private token: string | null = null
    private tokenExpiry: number = 0
    private config: FlowConfig

    constructor(config: FlowConfig) {
        this.config = config
    }

    /**
     * Get a valid access token, refreshing if necessary
     */
    async getValidToken(): Promise<string> {
        const now = Date.now()

        // Refresh token if it doesn't exist or expires within 1 minute
        if (!this.token || now >= this.tokenExpiry - 60000) {
            await this.refreshToken()
        }

        return this.token!
    }

    /**
     * Refresh the access token
     */
    private async refreshToken(): Promise<void> {
        const authResponse = await authenticate(this.config)
        this.token = authResponse.access_token
        this.tokenExpiry = Date.now() + (authResponse.expires_in * 1000)
    }
}

// Authentication function
async function authenticate(config: FlowConfig): Promise<AuthResponse> {
    const url = `${config.flowAuthBaseUrl}${FLOW_ENDPOINTS.auth}`

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'FlowTenant': config.flowTenant
        },
        body: JSON.stringify({
            clientId: config.flowClientId,
            clientSecret: config.flowClientSecret,
            appToAccess: config.flowAppToAccess
        })
    })

    if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`)
    }

    return await response.json()
}
```

## Model Management

The Flow Provider includes a sophisticated model management system:

### FlowModelService

```typescript
// flow/model-service.ts
export class FlowModelService {
    private config: FlowConfig
    private tokenManager: TokenManager
    private modelCache = new Map<string, { models: Model[], timestamp: number }>()

    constructor(config: FlowConfig) {
        this.config = config
        this.tokenManager = new TokenManager(config)
    }

    /**
     * Get formatted model options for UI
     */
    async getModelOptions(includeHardcoded = true): Promise<ModelOption[]> {
        const allModels: Model[] = []

        // Fetch from all providers
        for (const provider of FLOW_PROVIDERS) {
            try {
                const models = await this.getModelsFromProvider(provider)
                allModels.push(...models)
            } catch (error) {
                console.error(`Failed to fetch models from ${provider}:`, error)
                // Use hardcoded models as fallback
                if (includeHardcoded) {
                    const fallbackModels = HARDCODED_MODELS[provider] || []
                    allModels.push(...fallbackModels)
                }
            }
        }

        // Format for UI
        return allModels.map(model => ({
            value: model.id,
            label: `${model.name} (${model.provider})`,
            provider: model.provider
        }))
    }
}
```

### Hardcoded Models

The system includes hardcoded models that work but may not appear in API endpoints:

```typescript
// flow/model-service.ts
const HARDCODED_MODELS: Record<FlowProvider, Model[]> = {
    "azure-openai": [
        {
            id: "gpt-4",
            name: "gpt-4",
            provider: "azure-openai",
            capabilities: ["system-instruction", "chat-conversation", "streaming"],
            inputTokens: 8192,
            description: "GPT-4 model (hardcoded)"
        },
        {
            id: "text-embedding-3-small",
            name: "text-embedding-3-small",
            provider: "azure-openai",
            capabilities: ["embeddings"],
            description: "Text Embedding 3 Small (hardcoded)"
        },
        {
            id: "text-embedding-ada-002",
            name: "text-embedding-ada-002",
            provider: "azure-openai",
            capabilities: ["embeddings"],
            description: "Text Embedding Ada 002 (hardcoded)"
        }
    ],
    // ... other providers
}
```

### Model Mapping for Incompatible Models

The system automatically maps incompatible Anthropic models to Flow equivalents:

```typescript
// Automatic model mapping in FlowModelSelector
const invalidAnthropicModels = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229"
]

const modelMapping = {
    "claude-3-5-sonnet-20241022": "anthropic.claude-37-sonnet",
    "claude-3-5-haiku-20241022": "anthropic.claude-3-sonnet",
    "claude-3-opus-20240229": "anthropic.claude-37-sonnet"
}
```

## UI Components

### Flow.tsx - Main Configuration Component

```typescript
// webview-ui/src/components/settings/providers/Flow.tsx
export const Flow: React.FC<FlowProps> = ({ apiConfiguration, setApiConfigurationField }) => {
    const [isTestingConnection, setIsTestingConnection] = useState(false)
    const [connectionTestResult, setConnectionTestResult] = useState<string | null>(null)
    const [hideOptionalFields, setHideOptionalFields] = useState(true)

    const testConnection = async () => {
        setIsTestingConnection(true)

        const testConfig = {
            flowBaseUrl: apiConfiguration.flowBaseUrl || "https://flow.ciandt.com",
            flowAuthBaseUrl: apiConfiguration.flowAuthBaseUrl,
            flowTenant: apiConfiguration.flowTenant,
            flowClientId: apiConfiguration.flowClientId,
            flowClientSecret: apiConfiguration.flowClientSecret,
            flowAppToAccess: apiConfiguration.flowAppToAccess || "llm-api"
        }

        // Send message to backend to test connection
        vscode.postMessage({
            type: "testFlowConnection",
            config: testConfig
        })
    }

    return (
        <div className="space-y-4">
            {/* Model Selector */}
            <FlowModelSelector
                selectedModel={apiConfiguration.apiModelId}
                onModelChange={(modelId) => setApiConfigurationField("apiModelId", modelId)}
                flowConfig={{
                    flowBaseUrl: apiConfiguration.flowBaseUrl,
                    flowTenant: apiConfiguration.flowTenant,
                    flowClientId: apiConfiguration.flowClientId,
                    flowClientSecret: apiConfiguration.flowClientSecret,
                    flowAuthBaseUrl: apiConfiguration.flowAuthBaseUrl,
                    flowAppToAccess: apiConfiguration.flowAppToAccess
                }}
            />

            {/* Configuration fields */}
            {/* ... */}
        </div>
    )
}
```

### FlowModelSelector.tsx - Auto-loading Model Selector

```typescript
// webview-ui/src/components/settings/providers/FlowModelSelector.tsx
export const FlowModelSelector: React.FC<FlowModelSelectorProps> = ({
    selectedModel,
    onModelChange,
    flowConfig,
    disabled
}) => {
    const [models, setModels] = useState<ModelOption[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isUsingCache, setIsUsingCache] = useState(false)
    const [hasAttemptedAutoLoad, setHasAttemptedAutoLoad] = useState(false)

    // Auto-load models when config is complete
    useEffect(() => {
        if (isConfigComplete() && !hasAttemptedAutoLoad) {
            console.log("[FlowModelSelector] Auto-loading models on mount")
            setHasAttemptedAutoLoad(true)
            fetchModels(true) // true indicates auto-load
        }
    }, [flowConfig.flowTenant, flowConfig.flowClientId, flowConfig.flowClientSecret])

    const fetchModels = useCallback(async (isAutoLoad = false, forceRefresh = false) => {
        // Check cache first
        if (!forceRefresh) {
            const cachedModels = flowModelCache.getCachedModels(flowConfig)
            if (cachedModels && cachedModels.length > 0) {
                setModels(cachedModels)
                setIsUsingCache(true)
                return
            }
        }

        setIsLoading(true)
        setIsUsingCache(false)

        // Send request to backend
        vscode.postMessage({
            type: "fetchFlowModels",
            config: flowConfig
        })
    }, [flowConfig])

    // Handle model validation and automatic mapping
    const handleModelChange = (modelId: string) => {
        // Check for invalid Anthropic models and map to Flow equivalents
        const invalidAnthropicModels = [
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229"
        ]

        const modelMapping = {
            "claude-3-5-sonnet-20241022": "anthropic.claude-37-sonnet",
            "claude-3-5-haiku-20241022": "anthropic.claude-3-sonnet",
            "claude-3-opus-20240229": "anthropic.claude-37-sonnet"
        }

        if (invalidAnthropicModels.includes(modelId)) {
            const flowEquivalent = modelMapping[modelId]
            console.log(`[FlowModelSelector] Mapping ${modelId} to ${flowEquivalent}`)
            onModelChange(flowEquivalent)
        } else {
            onModelChange(modelId)
        }
    }

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium">
                Modelo
            </label>

            <div className="relative">
                <VSCodeDropdown
                    value={selectedModel || ""}
                    onChange={handleModelChange}
                    disabled={disabled || isLoading || !isConfigComplete()}
                    style={{ width: "100%" }}
                >
                    <VSCodeOption value="">Selecione um modelo...</VSCodeOption>
                    {models.map((model) => (
                        <VSCodeOption key={model.value} value={model.value}>
                            {model.label}
                        </VSCodeOption>
                    ))}
                </VSCodeDropdown>

                {isLoading && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <VSCodeProgressRing />
                        {isUsingCache && <span className="text-xs">(cache)</span>}
                    </div>
                )}

                {/* Cache indicator */}
                {isUsingCache && !isLoading && (
                    <div className="text-xs text-gray-500 mt-1">
                        Usando cache (clique em refresh para atualizar)
                    </div>
                )}
            </div>

            {/* Manual refresh button */}
            <button
                onClick={() => fetchModels(false, true)}
                disabled={disabled || isLoading || !isConfigComplete()}
                className="text-xs text-blue-500 hover:text-blue-700"
            >
                🔄 Refresh modelos
            </button>
        </div>
    )
}
```

## Backend Integration

### Message Handlers in webviewMessageHandler.ts

```typescript
// src/core/webview/webviewMessageHandler.ts
case "testFlowConnection":
    try {
        const config = message.config
        if (!config) {
            await provider.postMessageToWebview({
                type: "flowConnectionTestResult",
                success: false,
                error: "Configuração não fornecida"
            })
            break
        }

        // Import Flow provider modules
        const { TokenManager } = await import("../../api/providers/flow/auth")
        const { initializeFlowConfig, validateFlowConfig } = await import("../../api/providers/flow/config")

        // Test Flow connection
        const flowConfig = initializeFlowConfig(config)
        validateFlowConfig(flowConfig)

        const tokenManager = new TokenManager(flowConfig)
        const token = await tokenManager.getValidToken()

        await provider.postMessageToWebview({
            type: "flowConnectionTestResult",
            success: !!token,
            error: null
        })
    } catch (error) {
        await provider.postMessageToWebview({
            type: "flowConnectionTestResult",
            success: false,
            error: error.message
        })
    }
    break

case "fetchFlowModels":
    try {
        const config = message.config
        const { initializeFlowConfig, validateFlowConfig } = await import("../../api/providers/flow/config")
        const { FlowModelService } = await import("../../api/providers/flow/model-service")

        const flowConfig = initializeFlowConfig(config)
        validateFlowConfig(flowConfig)

        const modelService = new FlowModelService(flowConfig)
        const modelOptions = await modelService.getModelOptions(true)

        await provider.postMessageToWebview({
            type: "fetchFlowModelsResult",
            success: true,
            error: null,
            models: modelOptions
        })
    } catch (error) {
        await provider.postMessageToWebview({
            type: "fetchFlowModelsResult",
            success: false,
            error: error.message,
            models: []
        })
    }
    break
```

## Cache System

### FlowModelCache Implementation

```typescript
// webview-ui/src/utils/flowModelCache.ts
export class FlowModelCache {
    private config: CacheConfig
    private storage: Storage
    private cacheKey = 'flow-models-cache'

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = {
            ttlMinutes: 60,
            enabled: true,
            storageType: 'localStorage',
            ...config
        }
        this.storage = this.config.storageType === 'localStorage' ? localStorage : sessionStorage
    }

    /**
     * Get cached models if valid
     */
    getCachedModels(flowConfig: FlowConfigSubset): ModelOption[] | null {
        if (!this.config.enabled) return null

        try {
            const configHash = this.generateConfigHash(flowConfig)
            const cached = this.storage.getItem(this.cacheKey)

            if (!cached) return null

            const cacheEntry: CacheEntry = JSON.parse(cached)

            // Check if config matches
            if (cacheEntry.configHash !== configHash) {
                this.clearCache()
                return null
            }

            // Check if cache is expired
            const now = Date.now()
            if (now > cacheEntry.timestamp + cacheEntry.ttl) {
                this.clearCache()
                return null
            }

            return cacheEntry.models
        } catch (error) {
            console.error("[FlowModelCache] Error reading cache:", error)
            this.clearCache()
            return null
        }
    }

    /**
     * Cache models with current configuration
     */
    cacheModels(models: ModelOption[], flowConfig: FlowConfigSubset): void {
        if (!this.config.enabled) return

        try {
            const configHash = this.generateConfigHash(flowConfig)
            const ttl = this.config.ttlMinutes * 60 * 1000

            const cacheEntry: CacheEntry = {
                models,
                timestamp: Date.now(),
                ttl,
                configHash
            }

            this.storage.setItem(this.cacheKey, JSON.stringify(cacheEntry))
        } catch (error) {
            console.error("[FlowModelCache] Error caching models:", error)
        }
    }
}

// Export singleton instance
export const flowModelCache = new FlowModelCache()
```

## Provider Configuration

The Flow Provider requires the following configuration parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `flowBaseUrl` | string | No | Base URL for Flow API (default: `https://flow.ciandt.com`) |
| `flowAuthBaseUrl` | string | No | Base URL for authentication (default: same as `flowBaseUrl`) |
| `flowTenant` | string | Yes | Tenant identifier |
| `flowClientId` | string | Yes | Client ID for authentication |
| `flowClientSecret` | string | Yes | Client secret for authentication |
| `flowAppToAccess` | string | No | App to access (default: `llm-api`) |
| `flowAgent` | string | No | Agent identifier (default: `chat`) |
| `apiModelId` | string | No | Default model ID |
| `modelTemperature` | number | No | Default temperature (0-1, default: 0.7) |
| `modelMaxTokens` | number | No | Default max tokens for responses |
| `flowRequestTimeout` | number | No | Request timeout in ms (default: 30000) |

Example configuration:

```typescript
const flowConfig = {
  flowBaseUrl: 'https://flow.ciandt.com',
  flowTenant: 'cit',
  flowClientId: 'your-client-id',
  flowClientSecret: 'your-client-secret',
  apiModelId: 'gpt-4o',
  modelTemperature: 0.7,
  modelMaxTokens: 4000
};
```

## Supported Models

The Flow Provider supports various models across different providers:

### Azure OpenAI
- `gpt-4o` - Context: 128,000 tokens, Capabilities: streaming, system-instruction, chat-conversation, image-recognition
- `gpt-4o-mini` - Context: 128,000 tokens, Capabilities: streaming, system-instruction, chat-conversation, image-recognition
- `o3-mini` - Context: 200,000 tokens, Capabilities: streaming, system-instruction, chat-conversation
- `gpt-4` - Capabilities: system-instruction, chat-conversation, streaming
- `text-embedding-3-small` - Capabilities: embeddings
- `text-embedding-ada-002` - Capabilities: embeddings

### Google Gemini
- `gemini-2.0-flash` - Context: 8,192 tokens, Capabilities: streaming, chat-conversation, image-recognition, system-instruction
- `gemini-2.5-pro` - Context: 1,048,576 tokens, Capabilities: streaming, chat-conversation, image-recognition, system-instruction

### Amazon Bedrock
- `anthropic.claude-3-sonnet` - Context: 200,000 tokens, Capabilities: chat-conversation, image-recognition, streaming
- `anthropic.claude-37-sonnet` - Context: 200,000 tokens, Capabilities: chat-conversation, image-recognition, streaming
- `meta.llama3-70b-instruct` - Context: 200,000 tokens, Capabilities: chat-conversation, image-recognition, streaming
- `amazon.nova-lite` - Context: 300,000 tokens, Capabilities: chat-conversation, image-recognition, streaming
- `amazon.nova-micro` - Context: 128,000 tokens, Capabilities: chat-conversation, streaming
- `amazon.nova-pro` - Context: 300,000 tokens, Capabilities: chat-conversation, image-recognition, streaming

### Azure Foundry
- `DeepSeek-R1` - Capabilities: chat-conversation

## API Integration

### Model Listing

To list available models from a specific provider:

```typescript
async listModels(provider?: string, capabilities?: string[]): Promise<Model[]> {
  const token = await this.ensureValidToken();
  const capabilitiesParam = capabilities ? `?capabilities=${capabilities.join(',')}` : '';
  const url = `${this.config.flowBaseUrl}/ai-orchestration-api/v1/models/${provider || 'azure-openai'}${capabilitiesParam}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'FlowTenant': this.config.flowTenant
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.map(transformModelData);
}
```

### Chat Completions

Implement chat completions with provider-specific payload generation:

```typescript
async createChatCompletion(options: FlowChatCompletionOptions): Promise<ChatCompletionResponse> {
  const token = await this.ensureValidToken();
  const provider = determineProvider(options.model || this.config.apiModelId);

  const endpoint = getProviderEndpoint(provider);
  const payload = generateProviderPayload(provider, options, this.config);

  const response = await fetch(`${this.config.flowBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'FlowTenant': this.config.flowTenant,
      'FlowAgent': this.config.flowAgent
    },
    body: JSON.stringify(payload),
    timeout: this.config.flowRequestTimeout
  });

  if (!response.ok) {
    throw new Error(`Chat completion failed: ${response.statusText}`);
  }

  const data = await response.json();
  return transformChatResponse(provider, data);
}
```

For each provider, implement specific payload generators:

#### Azure OpenAI Payload

```typescript
function generateAzureOpenAIPayload(options, config) {
  return {
    messages: options.messages.map(transformMessage),
    model: options.model,
    max_tokens: options.maxTokens || config.modelMaxTokens,
    temperature: options.temperature || config.modelTemperature,
    stream: options.stream || false
  };
}
```

#### Google Gemini Payload

```typescript
function generateGeminiPayload(options, config) {
  return {
    model: options.model,
    contents: transformMessagesToGeminiFormat(options.messages),
    generationConfig: {
      maxOutputTokens: options.maxTokens || config.modelMaxTokens,
      temperature: options.temperature || config.modelTemperature
    },
    stream: options.stream || false
  };
}
```

#### Amazon Bedrock Payload

```typescript
function generateBedrockPayload(options, config) {
  return {
    allowedModels: [options.model],
    messages: transformMessagesToBedrockFormat(options.messages),
    system: extractSystemMessage(options.messages),
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: options.maxTokens || config.modelMaxTokens,
    temperature: options.temperature || config.modelTemperature,
    stream: options.stream || false
  };
}
```

### Embeddings

Implement embedding generation for supported models:

```typescript
async createEmbedding(options: FlowEmbeddingOptions): Promise<EmbeddingResponse> {
  const token = await this.ensureValidToken();
  const model = options.model || 'text-embedding-3-small';

  const response = await fetch(`${this.config.flowBaseUrl}/ai-orchestration-api/v1/openai/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'FlowTenant': this.config.flowTenant,
      'FlowAgent': this.config.flowAgent,
      'x-ms-model-mesh-model-name': model
    },
    body: JSON.stringify({
      input: options.input,
      user: options.user || 'flow',
      allowedModels: [model]
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.statusText}`);
  }

  return await response.json();
}
```

## Advanced Payload Generation

The Flow Provider implements sophisticated payload generation with provider-specific optimizations and special handling for different model types:

### O1/O3 Model Special Handling

```typescript
function generatePayloadWithO1O3Support(provider: string, options: any, config: any) {
  const modelId = options.model || config.apiModelId;
  const isO1OrO3 = modelId.includes('o1-') || modelId.includes('o3-');

  let payload = generateBasePayload(provider, options, config);

  if (isO1OrO3) {
    // Remove temperature for O1/O3 models (they don't support it)
    delete payload.temperature;

    // Merge system messages for Azure OpenAI
    if (provider === 'azure-openai') {
      payload.messages = mergeSystemMessages(payload.messages);
    }

    console.log(`[PayloadGenerator] Applied O1/O3 optimizations for ${modelId}`);
  }

  return payload;
}

function mergeSystemMessages(messages: Message[]): Message[] {
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  if (systemMessages.length > 1) {
    const mergedContent = systemMessages.map(m => m.content).join('\n\n');
    return [
      { role: 'system', content: mergedContent },
      ...otherMessages
    ];
  }

  return messages;
}
```

### Provider-Specific Transformations

#### Google Gemini Role Conversion

```typescript
function convertMessagesForGemini(messages: Message[]): GeminiMessage[] {
  return messages.map(message => ({
    role: message.role === 'assistant' ? 'model' : message.role,
    parts: [{ text: message.content }]
  }));
}
```

#### Amazon Bedrock Anthropic Version

```typescript
function getAnthropicVersionForBedrock(modelId: string): string {
  // Conditional anthropic_version for Nova models
  if (modelId.includes('nova-')) {
    return 'bedrock-2023-05-31';
  }

  // Default version for Claude models
  return 'bedrock-2023-05-31';
}
```

#### Azure Foundry DeepSeek-R1 Formatting

```typescript
function formatDeepSeekR1Payload(messages: Message[]): Message[] {
  // Extract system message and user messages
  const systemMessage = messages.find(m => m.role === 'system')?.content ||
    'You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company.';

  const userMessages = messages.filter(m => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

  // Format with DeepSeek-R1 instruction markers
  const formattedContent = `${systemMessage}\n### Instruction:\n${lastUserMessage}\n### Response:\n`;

  return [{
    role: 'user',
    content: formattedContent
  }];
}
```

### Advanced Streaming Implementation

The Flow Provider implements a sophisticated streaming system with robust chunk handling:

#### Streaming Architecture

```typescript
async *streamChatCompletion(options: FlowChatCompletionOptions): AsyncIterableIterator<ChatCompletionChunk> {
  const token = await this.ensureValidToken();
  const provider = determineProvider(options.model || this.config.apiModelId);

  const endpoint = getProviderEndpoint(provider);
  const payload = generateProviderPayload(provider, { ...options, stream: true }, this.config);

  const response = await fetch(`${this.config.flowBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream', // Specific for streaming
      'Authorization': `Bearer ${token}`,
      'FlowTenant': this.config.flowTenant,
      'FlowAgent': this.config.flowAgent,
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Streaming chat completion failed: ${response.statusText}`);
  }

  // Advanced chunk processing with buffer
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { stream: true });
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Process any remaining buffer content
        if (buffer.trim()) {
          yield* this.processBufferChunks(buffer, provider);
        }
        break;
      }

      // Decode chunk with stream support for fragmented data
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Extract complete chunks using dual algorithm
      const { processedChunks, remainingBuffer } = this.extractCompleteChunks(buffer);
      buffer = remainingBuffer;

      // Process each complete chunk
      for (const chunkData of processedChunks) {
        yield* this.transformStreamChunk(provider, chunkData);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Dual algorithm for chunk extraction
 */
private extractCompleteChunks(buffer: string): { processedChunks: any[], remainingBuffer: string } {
  const processedChunks: any[] = [];
  let remainingBuffer = buffer;

  // Algorithm 1: Regex for complete SSE patterns
  const sseRegex = /data: .*?\n\n/gs;
  let match;
  let lastIndex = 0;

  while ((match = sseRegex.exec(buffer)) !== null) {
    const data = match[0].slice(6, -2); // Remove "data: " and "\n\n"
    if (data !== '[DONE]' && data.trim()) {
      try {
        processedChunks.push(JSON.parse(data));
        lastIndex = match.index + match[0].length;
      } catch (e) {
        console.error('[FlowHandler] Failed to parse SSE chunk:', e);
      }
    }
  }

  // Update remaining buffer
  if (lastIndex > 0) {
    remainingBuffer = buffer.slice(lastIndex);
  }

  // Algorithm 2: Line-by-line fallback for incomplete chunks
  if (processedChunks.length === 0) {
    const lines = buffer.split('\n');
    let currentChunk = '';
    let processedLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('data: ')) {
        currentChunk = line.slice(6);
      } else if (line.trim() === '' && currentChunk) {
        // End of chunk
        if (currentChunk !== '[DONE]') {
          try {
            processedChunks.push(JSON.parse(currentChunk));
          } catch (e) {
            console.error('[FlowHandler] Failed to parse line chunk:', e);
          }
        }
        currentChunk = '';
        processedLines = i + 1;
      }
    }

    // Update remaining buffer for line-by-line processing
    if (processedLines > 0) {
      remainingBuffer = lines.slice(processedLines).join('\n');
    }
  }

  return { processedChunks, remainingBuffer };
}

/**
 * Provider-specific stream chunk transformation
 */
private *transformStreamChunk(provider: string, chunkData: any): Generator<ChatCompletionChunk> {
  switch (provider) {
    case 'azure-openai':
      // Support for delta.content and message.content
      if (chunkData.choices?.[0]?.delta?.content) {
        yield {
          content: chunkData.choices[0].delta.content,
          role: 'assistant',
          finish_reason: chunkData.choices[0].finish_reason
        };
      } else if (chunkData.choices?.[0]?.message?.content) {
        yield {
          content: chunkData.choices[0].message.content,
          role: 'assistant',
          finish_reason: chunkData.choices[0].finish_reason
        };
      }
      break;

    case 'google-gemini':
      // candidates[0].content.parts[0].text
      if (chunkData.candidates?.[0]?.content?.parts?.[0]?.text) {
        yield {
          content: chunkData.candidates[0].content.parts[0].text,
          role: 'assistant',
          finish_reason: chunkData.candidates[0].finishReason
        };
      }
      break;

    case 'amazon-bedrock':
      // Multiple formats: content_block_delta, message_delta, content array
      if (chunkData.content_block_delta?.delta?.text) {
        yield {
          content: chunkData.content_block_delta.delta.text,
          role: 'assistant'
        };
      } else if (chunkData.message_delta?.delta?.text) {
        yield {
          content: chunkData.message_delta.delta.text,
          role: 'assistant'
        };
      } else if (Array.isArray(chunkData.content)) {
        for (const contentItem of chunkData.content) {
          if (contentItem.text) {
            yield {
              content: contentItem.text,
              role: 'assistant'
            };
          }
        }
      }
      break;

    default:
      console.warn(`[FlowHandler] Unknown provider for streaming: ${provider}`);
  }
}
```

## Error Handling and Best Practices

Implement robust error handling and follow these best practices:

### Token Management

```typescript
async ensureValidToken(): Promise<string> {
  const now = Date.now();

  if (!this.token || now >= this.tokenExpiry - 60000) { // Refresh if within 1 minute of expiry
    const authResponse = await this.authenticate();
    this.token = authResponse.token;
    this.tokenExpiry = now + (authResponse.expiresIn * 1000);
  }

  return this.token;
}
```

### Request Retries

```typescript
async makeRequestWithRetry(url: string, options: RequestOptions, maxRetries = 3): Promise<Response> {
  let retries = 0;
  let lastError;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) { // Rate limit
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries++;
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      retries++;

      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }
  }

  throw lastError;
}
```

### Security Considerations

1. **Credential Management**
   - Never hardcode credentials in the code
   - Use secure environment variables or secret storage
   - Implement regular credential rotation

2. **Secure Connections**
   - Always use HTTPS connections
   - Validate server certificates
   - Implement request timeouts

3. **Input Validation**
   - Sanitize all user inputs
   - Validate parameters before sending to the API
   - Implement content filtering for sensitive applications

## Advanced Features

### Model Selection Strategy

Implement a model selection strategy to choose the best model based on requirements:

```typescript
function selectOptimalModel(
  requirements: {
    maxContextLength?: number;
    capabilities?: string[];
    preferredProvider?: string;
    priority?: 'speed' | 'quality' | 'cost';
  },
  availableModels: Model[]
): Model | null {
  // Filter models by required capabilities
  let candidates = availableModels;

  if (requirements.capabilities?.length) {
    candidates = candidates.filter(model =>
      requirements.capabilities.every(cap => model.capabilities.includes(cap))
    );
  }

  // Filter by context length if specified
  if (requirements.maxContextLength) {
    candidates = candidates.filter(model =>
      !model.inputTokens || model.inputTokens >= requirements.maxContextLength
    );
  }

  // Filter by preferred provider if specified
  if (requirements.preferredProvider) {
    const preferredCandidates = candidates.filter(
      model => model.provider === requirements.preferredProvider
    );

    if (preferredCandidates.length > 0) {
      candidates = preferredCandidates;
    }
  }

  // If no candidates match, return null
  if (candidates.length === 0) {
    return null;
  }

  // Sort candidates based on priority
  switch (requirements.priority) {
    case 'speed':
      // Sort by models known for speed
      return sortModelsBySpeed(candidates)[0];
    case 'quality':
      // Sort by models known for quality
      return sortModelsByQuality(candidates)[0];
    case 'cost':
      // Sort by models known for cost-effectiveness
      return sortModelsByCost(candidates)[0];
    default:
      // Default to first available model
      return candidates[0];
  }
}
```

### Provider-specific Optimizations

#### Azure OpenAI Special Features

```typescript
function enhanceAzureOpenAIPayload(payload, options) {
  // Add function calling support if specified
  if (options.functions) {
    payload.functions = options.functions;

    if (options.functionCall) {
      payload.function_call = options.functionCall;
    }
  }

  // Add response format if specified
  if (options.responseFormat) {
    payload.response_format = options.responseFormat;
  }

  return payload;
}
```

#### Bedrock Claude Optimizations

```typescript
function enhanceBedrockClaudePayload(payload, options) {
  // Add Claude-specific parameters
  if (options.topK) {
    payload.top_k = options.topK;
  }

  if (options.topP) {
    payload.top_p = options.topP;
  }

  return payload;
}
```

## Troubleshooting

### Common Issues and Solutions

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Authentication Failure | Invalid credentials or expired token | Verify client ID and secret, ensure proper tenant ID |
| Rate Limit Exceeded | Too many requests in a short time | Implement exponential backoff, reduce request frequency |
| Model Not Found | Incorrect model name or unavailable model | Verify model name, check available models list |
| Timeout Errors | Slow network or complex request | Increase timeout value, simplify request |
| Streaming Issues | Network instability | Implement robust chunk parsing, handle reconnection |

### Debug Logging

Implement comprehensive logging for easier troubleshooting:

```typescript
const debug = (message: string, data?: any) => {
  if (process.env.DEBUG === 'true') {
    console.log(`[Flow] ${message}`, data || '');
  }
};

// Usage in the code
debug('Making request to', url);
debug('Request payload', payload);
```

### Testing the Integration

Create a simple test script to verify the integration:

```typescript
async function testFlowProvider() {
  const flow = new FlowHandler({
    flowBaseUrl: 'https://flow.ciandt.com',
    flowTenant: 'cit',
    flowClientId: process.env.FLOW_CLIENT_ID,
    flowClientSecret: process.env.FLOW_CLIENT_SECRET
  });

  try {
    // Test authentication
    await flow.authenticate();
    console.log('✅ Authentication successful');

    // Test model listing
    const models = await flow.listModels('azure-openai');
    console.log(`✅ Listed ${models.length} models`);

    // Test chat completion
    const chatResponse = await flow.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' }
      ]
    });
    console.log('✅ Chat completion successful');
    console.log(chatResponse.choices[0].message.content);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}
```

### Known Issues and Debugging

#### Test Files and References

The Flow Provider includes comprehensive test files:

1. **test-flow-api.http**: API testing patterns with request examples
2. **test-flow-api.sh**: Complete Flow API test script
3. **test-flow-models-api.sh**: Specific model listing tests
4. **test-flow-chat-api.sh**: Chat completion tests
5. **debug-models.js**: Debug specific model comparisons

**Testing Recommendations:**
- Use backend instead of frontend to avoid VSCode CSP restrictions
- Reference `test-flow-api.http` and `test-flow-models-api.sh` for implementation details
- Use detailed logging with `console.log` for debugging

#### Debug Utilities and Console Tools

The Flow Provider includes comprehensive debug utilities:

```javascript
// Console tools available in browser console
window.FlowModelCacheDebug = {
    info: () => console.table(FlowModelCacheDebug.getCacheInfo()),
    clear: () => FlowModelCacheDebug.clearCache(),
    disable: () => FlowModelCacheDebug.updateConfig({ enabled: false }),
    enable: () => FlowModelCacheDebug.updateConfig({ enabled: true }),
    setTTL: (minutes) => FlowModelCacheDebug.updateConfig({ ttlMinutes: minutes })
}
```

#### Known Issues and Solutions

1. **FlowModelSelector Double Mount**
   - **Problem:** Component mounts twice causing unexpected selectedModel changes
   - **Solution:** Implemented `hasAttemptedAutoLoad` flag to prevent duplicate auto-load

2. **Cache Invalidation**
   - **Problem:** Cache didn't invalidate when configuration changed
   - **Solution:** Configuration hash used as validation key

#### Recommended Configuration

**UI Settings:**
- Flow Agent default: 'chat'
- Hide optional fields checkbox: checked by default
- Model selection positioned above optional fields checkbox
- Auto-load enabled by default

**Cache Settings:**
- TTL: 60 minutes
- Storage: localStorage
- Auto-invalidation: enabled

**Debug Settings:**
- Structured logging: enabled
- Console tools: available
- Performance metrics: collected

#### Advanced Debugging Features

```typescript
// Structured logging for operations
console.log("🚀 [FlowHandler] createMessage started", {
    systemPromptLength: systemPrompt.length,
    messagesCount: messages.length,
    metadata
});

// SSE chunk logging
console.log("[FlowHandler] Processing SSE chunk", {
    chunkLength: chunk.length,
    isComplete: chunk.includes('\n\n'),
    provider: provider
});

// Token management logging
console.log("[TokenManager] Token renewal", {
    expiresIn: Math.floor((tokenExpiry - Date.now()) / 1000),
    tenant: config.flowTenant
});
```

#### Request Utils with Advanced Retry

```typescript
// Exponential backoff with jitter to avoid thundering herd
const retryWithJitter = async (fn: () => Promise<any>, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            // Exponential backoff with jitter
            const baseDelay = Math.pow(2, i) * 1000;
            const jitter = Math.random() * 1000;
            const delay = baseDelay + jitter;

            console.log(`[RequestUtils] Retry ${i + 1}/${maxRetries} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Timeout with Promise.race
const requestWithTimeout = (url: string, options: any, timeout: number) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
        )
    ]);
};
```

By following this implementation guide, you can successfully integrate the Flow Provider into the Roo Code extension, enabling access to a wide range of AI models through a unified interface with advanced features like intelligent caching, robust streaming, and comprehensive error handling.