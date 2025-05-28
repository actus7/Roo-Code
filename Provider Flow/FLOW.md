# Flow Provider - Implementação Completa

O Flow é uma plataforma de orquestração de IA que atua como uma camada de abstração entre aplicações e diferentes providers de LLMs (Modelos de Linguagem Grandes), oferecendo acesso unificado através de uma API padronizada.

## Visão Geral

O Flow oferece as seguintes funcionalidades principais:

- Acesso unificado a múltiplos providers (Azure OpenAI, Google Gemini, Amazon Bedrock, Azure Foundry)
- Gerenciamento centralizado de autenticação e credenciais com renovação automática de tokens
- Sistema de embeddings integrado
- Capacidade de streaming de respostas com suporte a SSE (Server-Sent Events)
- Sistema de monitoramento e logging através do FlowAgent
- Cache inteligente de modelos com TTL configurável
- Seleção automática de modelos com fallbacks inteligentes
- Validação e mapeamento automático de modelos incompatíveis

## Estrutura de Arquivos e Componentes

### Core Files

```
src/api/providers/
├── flow.ts                  # FlowHandler - Implementação principal
├── flow/
│   ├── auth.ts             # TokenManager - Gerenciamento de autenticação
│   ├── config.ts           # Configurações, constantes e mapeamentos
│   ├── model-service.ts    # FlowModelService - Serviço de modelos
│   ├── model-utils.ts      # Utilitários para manipulação de modelos
│   ├── payload-generator.ts # Geração de payloads específicos por provider
│   ├── request-utils.ts    # Utilitários para requisições HTTP
│   ├── types.ts            # Definições de tipos TypeScript
│   └── utils.ts            # Utilitários gerais e debug
```

### UI Components
```
webview-ui/src/components/settings/providers/
├── Flow.tsx                # Interface principal de configuração do Flow
├── FlowModelSelector.tsx   # Seletor de modelos com cache e auto-load
└── __tests__/              # Testes dos componentes

webview-ui/src/utils/
├── flowModelCache.ts       # Sistema de cache de modelos
└── __tests__/
    └── flowModelCache.test.ts # Testes do sistema de cache

webview-ui/src/hooks/
└── useFlowModelCache.ts    # Hook para gerenciamento do cache
```

### Backend Integration
```
src/core/webview/webviewMessageHandler.ts
├── testFlowConnection      # Handler para teste de conexão
└── fetchFlowModels         # Handler para busca de modelos
```

## Sistema de Cache de Modelos

### FlowModelCache

O sistema de cache de modelos oferece:

- **TTL Configurável**: Cache com tempo de vida de 60 minutos por padrão
- **Invalidação Inteligente**: Cache é invalidado quando a configuração muda
- **Armazenamento Flexível**: Suporte a localStorage e sessionStorage
- **Debug Utilities**: Ferramentas de debug disponíveis no console do navegador

```typescript
// Configuração do cache
const cacheConfig = {
    ttlMinutes: 60,           // TTL em minutos
    enabled: true,            // Habilitar/desabilitar cache
    storageType: 'localStorage' // 'localStorage' ou 'sessionStorage'
}

// Uso do cache
const cachedModels = flowModelCache.getCachedModels(flowConfig)
if (cachedModels) {
    // Usar modelos do cache
} else {
    // Buscar modelos da API
    const models = await fetchModels()
    flowModelCache.cacheModels(models, flowConfig)
}
```

### FlowModelSelector

O componente de seleção de modelos oferece:

- **Auto-load**: Carregamento automático quando credenciais estão configuradas
- **Fallback Inteligente**: Mapeamento automático de modelos incompatíveis
- **Validação**: Verificação se o modelo selecionado está disponível
- **Cache Visual**: Indicadores visuais quando usando cache
- **Retry Manual**: Botão para recarregar modelos manualmente

```typescript
// Mapeamento automático de modelos incompatíveis
const invalidAnthropicModels = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229"
]

// Se modelo inválido detectado, mapeia para equivalente Flow
if (invalidAnthropicModels.includes(selectedModel)) {
    const flowEquivalent = findFlowEquivalent(selectedModel)
    onModelChange(flowEquivalent.value)
}
```

## Autenticação e Headers

### TokenManager

O `TokenManager` gerencia automaticamente a autenticação:

- **Renovação Automática**: Tokens são renovados automaticamente antes de expirar
- **Cache de Token**: Tokens são mantidos em memória durante sua validade
- **Tratamento de Erros**: Retry automático em caso de falhas de autenticação

```typescript
const tokenManager = new TokenManager(flowConfig)
const token = await tokenManager.getValidToken() // Sempre retorna token válido
```

### Obtenção do Token

```http
POST {{flowAuthBaseUrl}}/auth-engine-api/v1/api-key/token
Content-Type: application/json
Accept: application/json
FlowTenant: {{tenant}}

{
    "clientId": "{{flowClientId}}",
    "clientSecret": "{{flowClientSecret}}",
    "appToAccess": "{{flowAppToAccess}}"
}
```

### Headers Obrigatórios

```http
Authorization: Bearer {{token}}
FlowTenant: {{tenant}}
FlowAgent: {{agent}}
Accept: application/json
Content-Type: application/json
```

## Endpoints e Payloads

### 1. Listagem de Modelos

```http
GET /ai-orchestration-api/v1/models/{{provider}}?capabilities=system-instruction,chat-conversation
```

Providers suportados:
- `azure-openai`
- `google-gemini`
- `amazon-bedrock`
- `azure-foundry`

### 2. Chat Completions por Provider

#### Azure OpenAI
```http
POST /ai-orchestration-api/v1/openai/chat/completions
Content-Type: application/json
Accept: application/json

{
    "messages": [
        {
            "role": "system",
            "content": "You are a helpful assistant."
        },
        {
            "role": "user",
            "content": "Hello!"
        }
    ],
    "model": "gpt-4o",
    "max_tokens": 4000,
    "temperature": 0.7
}
```

Alternativa usando `allowedModels` em vez de `model`:
```json
{
    "allowedModels": ["gpt-4", "gpt-4o-mini"],
    "messages": [
        {
            "role": "system",
            "content": "You are a helpful assistant."
        },
        {
            "role": "user",
            "content": "Hello!"
        }
    ],
    "max_tokens": 4000,
    "temperature": 0.7
}
```

Nota: Também é possível usar `role: "assistant"` em vez de `role: "system"` para a primeira mensagem que define o comportamento do assistente.

#### Google Gemini
```http
POST /ai-orchestration-api/v1/google/generateContent
Content-Type: application/json
Accept: application/json

{
    "model": "gemini-2.0-flash",
    "contents": [
        {
            "parts": [
                {
                    "text": "You are a helpful assistant."
                }
            ],
            "role": "user"
        },
        {
            "parts": [
                {
                    "text": "Hello!"
                }
            ],
            "role": "user"
        }
    ],
    "generationConfig": {
        "maxOutputTokens": 4000,
        "temperature": 0.7
    }
}
```

Alternativa usando `allowedModels`:
```json
{
    "allowedModels": ["gemini-2.0-flash", "gemini-2.5-pro"],
    "contents": [
        {
            "parts": [
                {
                    "text": "You are a helpful assistant."
                }
            ],
            "role": "user"
        },
        {
            "parts": [
                {
                    "text": "Hello!"
                }
            ],
            "role": "user"
        }
    ],
    "generationConfig": {
        "maxOutputTokens": 4000,
        "temperature": 0.7
    }
}
```

#### Amazon Bedrock
```http
POST /ai-orchestration-api/v1/bedrock/invoke
Content-Type: application/json
Accept: application/json

{
    "allowedModels": ["anthropic.claude-3-sonnet"],
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Hello!"
                }
            ]
        }
    ],
    "system": "You are a helpful assistant.",
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 8192,
    "temperature": 0.7
}
```

Alternativa com outros modelos disponíveis:
```json
{
    "allowedModels": ["amazon.nova-lite", "meta.llama3-70b-instruct", "anthropic.claude-3-sonnet", "anthropic.claude-37-sonnet"],
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Hello!"
                }
            ]
        }
    ],
    "system": "You are a helpful assistant.",
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 8192,
    "temperature": 0.7
}
```

#### Azure Foundry (DeepSeek-R1)
```http
POST /ai-orchestration-api/v1/foundry/chat/completions
Content-Type: application/json
Accept: application/json

{
    "model": "DeepSeek-R1",
    "messages": [
        {
            "content": "You are an AI programming assistant, utilizing the DeepSeek Coder model, developed by DeepSeek Company, and your role is to assist with questions related to computer science. For politically sensitive questions, security and privacy issues, and other non-computer science questions, you will not answer.\n### Instruction:\nSua pergunta ou instrução aqui\n### Response:\n",
            "role": "user"
        }
    ]
}
```

Nota: O formato para DeepSeek-R1 requer a estrutura específica com os marcadores `### Instruction:` e `### Response:`. A resposta pode conter um elemento `<think></think>` que é parte do processamento interno do modelo.

## Sistema de Payload Generation

O Flow Provider implementa geração de payloads específica por provider com tratamentos especiais:

### Características do Payload Generator

1. **Azure OpenAI**: Merge de system messages para modelos O1/O3
2. **Google Gemini**: Conversão role assistant→model
3. **Amazon Bedrock**: anthropic_version condicional para modelos Nova
4. **Azure Foundry**: Formatação DeepSeek-R1 com marcadores de instrução

### Tratamento Especial de Modelos O1/O3

Os modelos O1 e O3 requerem tratamento especial:

```typescript
// Detecção de modelos O1/O3
const isO1OrO3Model = (modelId: string): boolean => {
    return modelId.includes('o1-') || modelId.includes('o3-')
}

// Tratamento especial (sem temperature)
if (isO1OrO3Model(modelId)) {
    // Remove temperature para modelos O1/O3
    delete payload.temperature

    // Merge system messages
    payload.messages = mergeSystemMessages(payload.messages)
}
```

### Formatação por Provider

#### Azure OpenAI - Merge de System Messages
```typescript
const mergeSystemMessages = (messages: Message[]): Message[] => {
    const systemMessages = messages.filter(m => m.role === 'system')
    const otherMessages = messages.filter(m => m.role !== 'system')

    if (systemMessages.length > 1) {
        const mergedContent = systemMessages.map(m => m.content).join('\n\n')
        return [
            { role: 'system', content: mergedContent },
            ...otherMessages
        ]
    }

    return messages
}
```

#### Google Gemini - Conversão de Roles
```typescript
const convertRoleForGemini = (role: string): string => {
    return role === 'assistant' ? 'model' : role
}
```

#### Amazon Bedrock - Anthropic Version Condicional
```typescript
const getAnthropicVersion = (modelId: string): string => {
    // Para modelos Nova, usar versão específica
    if (modelId.includes('nova-')) {
        return 'bedrock-2023-05-31'
    }
    return 'bedrock-2023-05-31'
}
```

### 3. Embeddings

```http
POST /ai-orchestration-api/v1/openai/embeddings
Content-Type: application/json
Accept: application/json
x-ms-model-mesh-model-name: text-embedding-3-small

{
    "input": "Text to convert to vector",
    "user": "flow",
    "allowedModels": ["text-embedding-3-small"]
}
```

Modelos disponíveis:
- `text-embedding-ada-002`
- `text-embedding-3-small`

Nota importante: O header `x-ms-model-mesh-model-name` é necessário para o correto roteamento do modelo de embedding e deve corresponder ao primeiro modelo listado em `allowedModels`.

## Configuração do Provider

### Interface de Configuração

A interface do Flow Provider no Roo Code oferece:

- **Seleção de Modelo**: Dropdown com carregamento automático de modelos disponíveis
- **Teste de Conexão**: Botão para testar conectividade com a API Flow
- **Campos Opcionais**: Checkbox para ocultar/mostrar campos não obrigatórios
- **Validação em Tempo Real**: Feedback visual sobre o status da configuração

### Parâmetros Obrigatórios

1. **Flow Tenant** (`flowTenant`)
   - Identificador do tenant
   - Ex: `cit`
   - **Obrigatório para funcionamento**

2. **Flow Client ID** (`flowClientId`)
   - ID do cliente para autenticação
   - **Obrigatório para funcionamento**

3. **Flow Client Secret** (`flowClientSecret`)
   - Chave secreta para autenticação
   - **Obrigatório para funcionamento**

### Parâmetros Opcionais

1. **Flow Base URL** (`flowBaseUrl`)
   - URL base da API Flow
   - Default: `https://flow.ciandt.com`

2. **Flow Auth Base URL** (`flowAuthBaseUrl`)
   - URL da API de autenticação
   - Default: valor de `flowBaseUrl`

3. **Flow App to Access** (`flowAppToAccess`)
   - Aplicação a ser acessada
   - Default: `llm-api`

4. **Flow Agent** (`flowAgent`)
   - Identificador do agente
   - Default: `chat`

5. **Flow Model ID** (`apiModelId`)
   - ID do modelo específico
   - Ex: `gpt-4o-mini`, `anthropic.claude-3-sonnet`
   - **Selecionado automaticamente via dropdown**

6. **Model Temperature** (`modelTemperature`)
   - Default: `0.7`

7. **Model Max Tokens** (`modelMaxTokens`)
   - Limite de tokens na resposta

8. **Flow Request Timeout** (`flowRequestTimeout`)
   - Timeout em ms
   - Default: `30000`

### Funcionalidades da Interface

#### Auto-load de Modelos
```typescript
// Carregamento automático quando credenciais estão configuradas
useEffect(() => {
    if (isConfigComplete() && !hasAttemptedAutoLoad) {
        console.log("[FlowModelSelector] Auto-loading models on mount")
        setHasAttemptedAutoLoad(true)
        fetchModels(true) // true indica auto-load
    }
}, [flowConfig.flowTenant, flowConfig.flowClientId, flowConfig.flowClientSecret])
```

#### Teste de Conexão
```typescript
const testConnection = async () => {
    setIsTestingConnection(true)

    // Enviar mensagem para o backend testar a conexão
    vscode.postMessage({
        type: "testFlowConnection",
        config: testConfig
    })
}
```

#### Cache de Modelos
- Cache automático com TTL de 60 minutos
- Invalidação quando configuração muda
- Indicadores visuais de uso do cache
- Botão de refresh manual

## Sistema de Streaming

O Flow Provider implementa um sistema robusto de streaming SSE (Server-Sent Events) com processamento de chunks fragmentados e buffer inteligente.

### Características do Sistema de Streaming

1. **Processamento de Chunks SSE**: Sistema de buffer para fragmentação de dados
2. **Extração de Chunks Completos**: Uso de regex para identificar chunks válidos
3. **Transformação Específica por Provider**: Cada provider tem seu próprio formato de streaming
4. **Headers Específicos**: Headers otimizados para streaming (`Cache-Control: no-cache`, `Connection: keep-alive`)
5. **TextDecoder com Stream**: Uso de `TextDecoder` com `stream: true` para chunks fragmentados

### Algoritmo de Extração de Chunks

O FlowHandler implementa um algoritmo duplo de extração:

1. **Primeiro**: Regex `/data: .*?\n\n/gs` para padrões completos
2. **Fallback**: Processamento linha-por-linha com agrupamento baseado em "data: " e linhas vazias

### Implementação por Provider

#### Azure OpenAI
```json
{
    "stream": true,
    "messages": [...]
}
```

**Formato de Streaming**: Suporte a `delta.content` e `message.content`

#### Google Gemini
```json
{
    "stream": true,
    "contents": [...]
}
```

**Formato de Streaming**: `candidates[0].content.parts[0].text`

#### Amazon Bedrock
```json
{
    "stream": true,
    "messages": [...]
}
```

**Formato de Streaming**: Múltiplos formatos (`content_block_delta`, `message_delta`, `content array`)

### Headers para Streaming

```http
Cache-Control: no-cache
Connection: keep-alive
Accept: text/event-stream
Authorization: Bearer {{token}}
FlowTenant: {{tenant}}
FlowAgent: {{agent}}
```

### Tratamento de Chunks Fragmentados

```typescript
// Exemplo de processamento de chunks
const parseSSEChunk = (chunk: string): any[] => {
    // Detecção de JSON completo vs SSE tradicional
    if (chunk.startsWith('{') && chunk.endsWith('}')) {
        return [JSON.parse(chunk)]
    }

    // Processamento SSE tradicional
    const chunks = []
    const regex = /data: .*?\n\n/gs
    let match

    while ((match = regex.exec(chunk)) !== null) {
        const data = match[0].slice(6, -2) // Remove "data: " e "\n\n"
        if (data !== '[DONE]') {
            chunks.push(JSON.parse(data))
        }
    }

    return chunks
}
```

## Boas Práticas e Pontos Críticos

### Segurança

1. **Credenciais**
   - Nunca expor credenciais no código
   - Usar variáveis de ambiente
   - Rotacionar credenciais regularmente

2. **Conexões**
   - Usar TLS 1.2+
   - Implementar timeouts
   - Validar inputs

### Performance

1. **Otimizações**
   - Usar streaming para respostas longas
   - Implementar cache quando apropriado
   - Monitorar tempos de resposta

2. **Rate Limiting e Retry**
   - **Retry Automático**: Com Retry-After header para rate limiting
   - **Timeout Configurável**: Promise.race para controle de timeout
   - **Headers Dinâmicos**: Accept: text/event-stream para streaming vs application/json para requests normais
   - **Exponential Backoff**: Com jitter para evitar thundering herd
   - **Circuit Breaker**: Para falhas consecutivas

### Sistema de Request Utils

O Flow implementa utilitários avançados de requisição:

```typescript
// Retry automático com exponential backoff
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn()
        } catch (error) {
            if (i === maxRetries - 1) throw error

            // Exponential backoff com jitter
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }
}

// Timeout configurável
const requestWithTimeout = (url: string, options: any, timeout: number) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
    ])
}
```

### Monitoramento

1. **Logging**
   - Usar FlowAgent para rastreamento
   - Manter logs estruturados
   - Configurar alertas

2. **Métricas**
   - Monitorar uso de tokens
   - Acompanhar latência
   - Verificar health checks

## Estrutura de Mensagens e Tipos de Requisição

### Formatos de Roles

1. **Tipos de Roles**:
   - `system`: Define instruções e comportamento do modelo
   - `user`: Mensagens enviadas pelo usuário
   - `assistant`: Pode ser usado como:
     - Resposta do modelo (output)
     - Configuração inicial do comportamento (similar ao system)

2. **Exemplos por Provider**:
   - **Azure OpenAI**:
   ```json
   {
       "messages": [
           {"role": "system", "content": "You are a helpful assistant."},
           {"role": "user", "content": "Hello"}
       ]
   }
   ```

   ou alternativamente:
   ```json
   {
       "messages": [
           {"role": "assistant", "content": "You are a helpful assistant."},
           {"role": "user", "content": "Hello"}
       ]
   }
   ```

   - **Google Gemini**:
   ```json
   {
       "contents": [
           {
               "parts": [{"text": "You are a helpful assistant."}],
               "role": "user"
           },
           {
               "parts": [{"text": "Hello"}],
               "role": "user"
           }
       ]
   }
   ```

   - **Amazon Bedrock (Claude)**:
   ```json
   {
       "system": "You are a helpful assistant.",
       "anthropic_version": "bedrock-2023-05-31",
       "messages": [
           {"role": "user", "content": [{"type": "text", "text": "Hello"}]}
       ]
   }
   ```

### Detalhes de Uso de Tokens

O Flow fornece informações detalhadas sobre o uso de tokens em cada requisição:

#### Azure OpenAI (O3-mini)
```json
"usage": {
    "completion_tokens": 200,
    "completion_tokens_details": {
        "accepted_prediction_tokens": 0,
        "audio_tokens": 0,
        "reasoning_tokens": 128,
        "rejected_prediction_tokens": 0
    },
    "prompt_tokens": 24,
    "prompt_tokens_details": {
        "audio_tokens": 0,
        "cached_tokens": 0
    },
    "total_tokens": 224
}
```

#### Google Gemini
```json
"usageMetadata": {
    "promptTokenCount": 14,
    "candidatesTokenCount": 9,
    "totalTokenCount": 23,
    "trafficType": "ON_DEMAND",
    "promptTokensDetails": [
        {
            "modality": "TEXT",
            "tokenCount": 14
        }
    ],
    "candidatesTokensDetails": [
        {
            "modality": "TEXT",
            "tokenCount": 9
        }
    ]
}
```

#### Amazon Bedrock (Claude 3.7)
```json
"usage": {
    "input_tokens": 21,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0,
    "output_tokens": 77
}
```

### Content Filters e Safety

1. **Azure OpenAI**:
```json
"content_filter_results": {
    "hate": { "filtered": false, "severity": "safe" },
    "self_harm": { "filtered": false, "severity": "safe" },
    "sexual": { "filtered": false, "severity": "safe" },
    "violence": { "filtered": false, "severity": "safe" }
}
```

2. **Azure Foundry**:
```json
"content_filter_results": {
    "hate": { "filtered": false, "severity": "safe" },
    "self_harm": { "filtered": false, "severity": "safe" },
    "sexual": { "filtered": false, "severity": "safe" },
    "violence": { "filtered": false, "severity": "safe" }
}
```

3. **Google Gemini**:
```json
"safetyRatings": [
    {
        "category": "HARM_CATEGORY_HARASSMENT",
        "probability": "NEGLIGIBLE"
    },
    {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "probability": "NEGLIGIBLE"
    },
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "probability": "NEGLIGIBLE"
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "probability": "NEGLIGIBLE"
    }
]
```

## Sistema de Modelos

### FlowModelService

O `FlowModelService` gerencia a descoberta e cache de modelos:

- **Busca Multi-Provider**: Consulta todos os providers simultaneamente
- **Modelos Hardcoded**: Inclui modelos conhecidos que podem não aparecer na API
- **Deduplicação**: Remove modelos duplicados baseado no ID
- **Fallback**: Usa modelos hardcoded quando a API falha
- **Cache por Provider**: Cache separado para cada provider

```typescript
const modelService = new FlowModelService(flowConfig)
const modelOptions = await modelService.getModelOptions(true) // true = incluir hardcoded

// Resultado formatado para UI
const formattedModels = modelOptions.map(model => ({
    value: model.id,
    label: `${model.name} (${model.provider})`,
    provider: model.provider
}))
```

### Modelos Suportados por Provider

#### Azure OpenAI
**Modelos da API:**
- `gpt-4o` - Contexto: 128000 tokens, Capacidades: streaming, system-instruction, chat-conversation, image-recognition
- `gpt-4o-mini` - Contexto: 128000 tokens, Capacidades: streaming, system-instruction, chat-conversation, image-recognition
- `o3-mini` - Contexto: 200000 tokens, Capacidades: streaming, system-instruction, chat-conversation

**Modelos Hardcoded:**
- `gpt-4` - Capacidades: system-instruction, chat-conversation, streaming
- `text-embedding-3-small` - Capacidades: embeddings
- `text-embedding-ada-002` - Capacidades: embeddings

#### Google Gemini
- `gemini-2.0-flash` - Contexto: 8192 tokens, Capacidades: streaming, chat-conversation, image-recognition, system-instruction
- `gemini-2.5-pro` - Contexto: 1048576 tokens, Capacidades: streaming, chat-conversation, image-recognition, system-instruction

#### Amazon Bedrock
- `anthropic.claude-3-sonnet` - Contexto: 200000 tokens, Capacidades: chat-conversation, image-recognition, streaming
- `anthropic.claude-37-sonnet` - Contexto: 200000 tokens, Capacidades: chat-conversation, image-recognition, streaming
- `meta.llama3-70b-instruct` - Contexto: 200000 tokens, Capacidades: chat-conversation, image-recognition, streaming
- `amazon.nova-lite` - Contexto: 300000 tokens, Capacidades: chat-conversation, image-recognition, streaming
- `amazon.nova-micro` - Contexto: 128000 tokens, Capacidades: chat-conversation, streaming
- `amazon.nova-pro` - Contexto: 300000 tokens, Capacidades: chat-conversation, image-recognition, streaming

#### Azure Foundry
- `DeepSeek-R1` - Capacidades: chat-conversation

### Mapeamento de Modelos

O sistema inclui mapeamento automático para modelos incompatíveis:

```typescript
// Modelos Anthropic incompatíveis que são mapeados para equivalentes Flow
const invalidAnthropicModels = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229"
]

// Mapeamento automático para modelos Flow equivalentes
const modelMapping = {
    "claude-3-5-sonnet-20241022": "anthropic.claude-37-sonnet",
    "claude-3-5-haiku-20241022": "anthropic.claude-3-sonnet",
    "claude-3-opus-20240229": "anthropic.claude-37-sonnet"
}
```

## Exemplos de Respostas

### Azure OpenAI (O3-mini)
```json
{
  "choices": [
    {
      "content_filter_results": {
        "hate": {
          "filtered": false,
          "severity": "safe"
        },
        "self_harm": {
          "filtered": false,
          "severity": "safe"
        },
        "sexual": {
          "filtered": false,
          "severity": "safe"
        },
        "violence": {
          "filtered": false,
          "severity": "safe"
        }
      },
      "finish_reason": "stop",
      "index": 0,
      "logprobs": null,
      "message": {
        "annotations": [],
        "content": "The capital city of Brazil is Brasília. It officially became the capital on April 21, 1960, replacing Rio de Janeiro. The city was planned and developed with a modern design by architect Oscar Niemeyer and urban planner Lúcio Costa, making it a significant example of modernist urban planning.",
        "refusal": null,
        "role": "assistant"
      }
    }
  ],
  "created": 1747622721,
  "id": "chatcmpl-BYknBGbCQEtWTEXdvefMyUaSH62co",
  "model": "o3-mini-2025-01-31",
  "object": "chat.completion",
  "prompt_filter_results": [
    {
      "prompt_index": 0,
      "content_filter_results": {
        "hate": {
          "filtered": false,
          "severity": "safe"
        },
        "self_harm": {
          "filtered": false,
          "severity": "safe"
        },
        "sexual": {
          "filtered": false,
          "severity": "safe"
        },
        "violence": {
          "filtered": false,
          "severity": "safe"
        }
      }
    }
  ],
  "system_fingerprint": "fp_ded0d14823",
  "usage": {
    "completion_tokens": 200,
    "completion_tokens_details": {
      "accepted_prediction_tokens": 0,
      "audio_tokens": 0,
      "reasoning_tokens": 128,
      "rejected_prediction_tokens": 0
    },
    "prompt_tokens": 24,
    "prompt_tokens_details": {
      "audio_tokens": 0,
      "cached_tokens": 0
    },
    "total_tokens": 224
  }
}
```

### Google Gemini
```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          {
            "text": "The capital city of Brazil is Brasília.\n"
          }
        ]
      },
      "finishReason": "STOP",
      "avgLogprobs": -0.011464295287926992
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 14,
    "candidatesTokenCount": 9,
    "totalTokenCount": 23,
    "trafficType": "ON_DEMAND",
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 14
      }
    ],
    "candidatesTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 9
      }
    ]
  },
  "modelVersion": "gemini-2.0-flash",
  "createTime": "2025-05-19T02:45:27.887574Z",
  "responseId": "R5sqaJaWNrPYj8MPjK2X2Q4"
}
```

### Amazon Bedrock (Claude 3.7)
```json
{
  "id": "msg_bdrk_018QBWivw3LZbAVpUWW1v6mt",
  "type": "message",
  "role": "assistant",
  "model": "claude-3-7-sonnet-20250219",
  "content": [
    {
      "type": "text",
      "text": "The capital city of Brazil is Brasília. It's located in the central-western part of the country and has been Brazil's capital since 1960, when it officially replaced Rio de Janeiro. Brasília is known for its modern architecture and urban planning, designed primarily by architect Oscar Niemeyer and urban planner Lúcio Costa."
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 21,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0,
    "output_tokens": 77
  }
}
```

### Azure Foundry (DeepSeek-R1)
```json
{
  "choices": [
    {
      "content_filter_results": {
        "hate": {
          "filtered": false,
          "severity": "safe"
        },
        "self_harm": {
          "filtered": false,
          "severity": "safe"
        },
        "sexual": {
          "filtered": false,
          "severity": "safe"
        },
        "violence": {
          "filtered": false,
          "severity": "safe"
        }
      },
      "finish_reason": "stop",
      "index": 0,
      "message": {
        "content": "<think>\n\n</think>\n\nThe capital city of Brazil is Brasília. It was inaugurated on April 21, 1960, and is located in the Federal District, within the Central-West region of the country.",
        "role": "assistant",
        "tool_calls": null
      }
    }
  ],
  "created": 1747622734,
  "id": "f17b551d034e4a3e9cda573611ee99f9",
  "model": "deepseek-r1",
  "object": "chat.completion",
  "prompt_filter_results": [
    {
      "prompt_index": 0,
      "content_filter_results": {
        "hate": {
          "filtered": false,
          "severity": "safe"
        },
        "self_harm": {
          "filtered": false,
          "severity": "safe"
        },
        "sexual": {
          "filtered": false,
          "severity": "safe"
        },
        "violence": {
          "filtered": false,
          "severity": "safe"
        }
      }
    }
  ],
  "usage": {
    "completion_tokens": 43,
    "prompt_tokens": 82,
    "prompt_tokens_details": null,
    "total_tokens": 125
  }
}
```

### Embeddings (text-embedding-3-small)
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.03435814, -0.0073973415, 0.038820483, ...] // Vetor truncado para brevidade
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

### Tratamento de Erros

```typescript
try {
    const response = await flow.chat(payload);
} catch (error) {
    if (error.status === 401) {
        await flow.refreshToken();
    } else if (error.status === 429) {
        await delay(calculateBackoff(retryCount));
    } else {
        logger.error("Flow API error", { error });
    }
}
```

#### Códigos de Erro Comuns

| Código | Significado | Ação Recomendada |
|--------|-------------|------------------|
| 401    | Token inválido/expirado | Renovar token |
| 403    | Acesso negado | Verificar permissões |
| 429    | Rate limit | Implementar backoff |
| 500    | Erro interno | Retry com backoff |

## Comparação entre Modelos

### Modelos de Chat

| Modelo | Provider | Casos de Uso Ideais | Velocidade | Custo |
|--------|----------|---------------------|------------|-------|
| GPT-4 | Azure OpenAI | Tarefas complexas, análise profunda | Moderada | Muito Alto |
| GPT-4O | Azure OpenAI | Tarefas complexas, análise profunda | Moderada | Muito Alto |
| GPT-4O Mini | Azure OpenAI | Tarefas médias a complexas | Alta | Alto |
| O3-Mini | Azure OpenAI | Respostas rápidas, tarefas simples | Muito Alta | Baixo |
| Gemini 2.0 Flash | Google | Respostas ultra-rápidas | Muito Alta | Baixo |
| Gemini 2.5 Pro | Google | Uso geral, boa performance | Alta | Médio |
| Claude 3 Sonnet | Amazon Bedrock | Análise detalhada, contextos longos | Moderada | Alto |
| Claude 3.7 Sonnet | Amazon Bedrock | Análise avançada, alta precisão | Moderada | Alto |
| Nova Lite | Amazon Bedrock | Tarefas gerais, boa velocidade | Alta | Médio |
| Llama3 70B | Amazon Bedrock | Raciocínio complexo | Moderada | Alto |
| DeepSeek-R1 | Azure Foundry | Tarefas técnicas e programação | Alta | Médio |

### Modelos de Embeddings

| Modelo | Tamanho do Vetor | Casos de Uso Ideais | Performance |
|--------|------------------|---------------------|-------------|
| text-embedding-ada-002 | 1536 | Busca semântica, classificação | Padrão |
| text-embedding-3-small | 1536 | Aplicações otimizadas | Melhor |

## Ferramentas de Debug e Desenvolvimento

### Debug Utilities

O Flow Provider inclui várias ferramentas para debug e desenvolvimento:

#### Console Debug Tools
```javascript
// Ferramentas disponíveis no console do navegador
window.FlowModelCacheDebug = {
    info: () => console.table(FlowModelCacheDebug.getCacheInfo()),
    clear: () => FlowModelCacheDebug.clearCache(),
    disable: () => FlowModelCacheDebug.updateConfig({ enabled: false }),
    enable: () => FlowModelCacheDebug.updateConfig({ enabled: true }),
    setTTL: (minutes) => FlowModelCacheDebug.updateConfig({ ttlMinutes: minutes })
}
```

#### Logging Detalhado
```typescript
// Habilitar debug logging
const debug = (message: string, data?: any) => {
    if (process.env.DEBUG === 'true') {
        console.log(`[Flow] ${message}`, data || '')
    }
}

// Logs estruturados para cada operação
console.log("🚀 [FlowHandler] createMessage iniciado", {
    systemPromptLength: systemPrompt.length,
    messagesCount: messages.length,
    metadata
})
```

#### Teste de Scripts

Scripts de teste estão disponíveis na pasta `Provider Flow/`:

- `test-flow-api.sh` - Teste completo da API Flow
- `test-flow-models-api.sh` - Teste específico de listagem de modelos
- `test-flow-chat-api.sh` - Teste de chat completions
- `debug-models.js` - Debug de modelos específicos

```bash
# Executar teste completo
cd "Provider Flow"
DEBUG=true ./test-flow-api.sh

# Testar apenas modelos
./test-flow-models-api.sh
```

### Monitoramento e Métricas

#### Backend Integration
```typescript
// Handler para teste de conexão
case "testFlowConnection":
    const { TokenManager } = await import("../../api/providers/flow/auth")
    const { initializeFlowConfig, validateFlowConfig } = await import("../../api/providers/flow/config")

    const flowConfig = initializeFlowConfig(config)
    validateFlowConfig(flowConfig)

    const tokenManager = new TokenManager(flowConfig)
    const token = await tokenManager.getValidToken()

// Handler para busca de modelos
case "fetchFlowModels":
    const { FlowModelService } = await import("../../api/providers/flow/model-service")

    const modelService = new FlowModelService(flowConfig)
    const modelOptions = await modelService.getModelOptions(true)
```

#### Cache Monitoring
```typescript
// Informações do cache em tempo real
const cacheInfo = flowModelCache.getCacheInfo()
console.log("Cache Status:", {
    hasCache: cacheInfo.hasCache,
    age: `${cacheInfo.age} minutes`,
    modelCount: cacheInfo.modelCount,
    expiresIn: `${cacheInfo.expiresIn} minutes`
})
```

## Debug e Desenvolvimento

### Arquivos de Teste

O Flow Provider inclui arquivos de teste para validação da implementação:

1. **test-flow-api.http**: Padrões de teste da API com exemplos de requisições
2. **test-flow-api.sh**: Script de teste completo da API Flow
3. **test-flow-models-api.sh**: Teste específico de listagem de modelos

### Recomendações de Teste

- **Usar Backend**: Testes devem usar backend em vez de frontend para evitar restrições CSP do VSCode
- **Referência aos Arquivos**: Consultar `test-flow-api.http` e `test-flow-models-api.sh` para implementação
- **Debugging**: Usar logging detalhado com `console.log` para debugging

### Azure Foundry (DeepSeek-R1)

O DeepSeek-R1 requer um formato de prompt específico:
```json
{
    "content": "You are an AI programming assistant... \n### Instruction:\nYou are a helpful assistant.\nWhat is the capital city of Brazil?\n### Response:\n",
    "role": "user"
}
```

A resposta incluirá um elemento `<think>\n\n</think>` que é parte do processamento interno do modelo e pode ser ignorado na exibição para o usuário.

### Logging Detalhado

O FlowHandler implementa logging detalhado para debugging:

```typescript
// Logging estruturado para operações
console.log("🚀 [FlowHandler] createMessage iniciado", {
    systemPromptLength: systemPrompt.length,
    messagesCount: messages.length,
    metadata
})

// Logging de chunks SSE
console.log("[FlowHandler] Processing SSE chunk", {
    chunkLength: chunk.length,
    isComplete: chunk.includes('\n\n')
})
```

### Alta Disponibilidade

1. **Fallbacks**
   - Implementar fallback entre providers
   - Manter modelos alternativos configurados

2. **Circuit Breaking**
   - Definir thresholds de falhas
   - Implementar recovery gradual

3. **Monitoramento**
   - Alertas para erros críticos
   - Métricas de disponibilidade
   - Logs de auditoria