# Flow Provider Implementation Guide for Roo Code

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Implementation](#implementation)
   - [File Structure](#file-structure)
   - [Core Components](#core-components)
4. [Authentication](#authentication)
5. [Provider Configuration](#provider-configuration)
6. [Supported Models](#supported-models)
7. [API Integration](#api-integration)
   - [Model Listing](#model-listing)
   - [Chat Completions](#chat-completions)
   - [Embeddings](#embeddings)
   - [Streaming](#streaming)
8. [Error Handling and Best Practices](#error-handling-and-best-practices)
9. [Advanced Features](#advanced-features)
10. [Troubleshooting](#troubleshooting)

## Introduction

The Flow Provider is an AI orchestration platform that serves as an abstraction layer between applications and various LLM providers (Azure OpenAI, Google Gemini, Amazon Bedrock, Azure Foundry). By implementing the Flow Provider in Roo Code, you can access multiple AI models through a single unified API, simplifying integration and providing flexibility in model selection.

**Key Benefits:**
- Unified access to multiple LLM providers
- Centralized authentication and credential management
- Standardized request/response format
- Built-in streaming support
- Integrated monitoring via FlowAgent

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

Implement the Flow Provider with the following file structure:

```
src/api/providers/
├── flow.ts                  # FlowHandler - Main implementation
├── flow/
│   ├── config.ts            # Configuration and constants
│   ├── model-utils.ts       # Model handling utilities
│   ├── payload-generator.ts # Provider-specific payload generation
│   ├── request-utils.ts     # HTTP request utilities
│   ├── types.ts             # TypeScript type definitions
│   └── utils.ts             # General utilities
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
      flowAgent: config.flowAgent || 'roo-code',
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

Flow uses OAuth2 token-based authentication. Implement the authentication flow as follows:

```typescript
// flow/auth.ts
async function authenticate(config: FlowConfig): Promise<AuthResponse> {
  const url = `${config.flowAuthBaseUrl}/auth-engine-api/v1/api-key/token`;
  
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
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    token: data.access_token,
    expiresIn: data.expires_in
  };
}
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
| `flowAgent` | string | No | Agent identifier (default: `roo-code`) |
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

### Streaming

Implement streaming for chat completions:

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
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'FlowTenant': this.config.flowTenant,
      'FlowAgent': this.config.flowAgent
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Streaming chat completion failed: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            yield transformStreamChunk(provider, parsed);
          } catch (e) {
            console.error('Failed to parse stream chunk:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
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

By following this implementation guide, you can successfully integrate the Flow Provider into the Roo Code extension, enabling access to a wide range of AI models through a unified interface.