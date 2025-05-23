# Flow Provider - Versão Corrigida

O Flow é uma plataforma de orquestração de IA que atua como uma camada de abstração entre aplicações e diferentes providers de LLMs (Modelos de Linguagem Grandes), oferecendo acesso unificado através de uma API padronizada.

## Visão Geral

O Flow oferece as seguintes funcionalidades principais:

- Acesso unificado a múltiplos providers (Azure OpenAI, Google Gemini, Amazon Bedrock, Azure Foundry)
- Gerenciamento centralizado de autenticação e credenciais
- Sistema de embeddings integrado
- Capacidade de streaming de respostas
- Sistema de monitoramento e logging através do FlowAgent

## Estrutura de Arquivos e Componentes

### Core Files

```
src/api/providers/
├── flow.ts                  # FlowHandler - Implementação principal
├── flow/
│   ├── config.ts           # Configurações e constantes
│   ├── model-utils.ts      # Utilitários para manipulação de modelos
│   ├── payload-generator.ts # Geração de payloads específicos
│   ├── request-utils.ts    # Utilitários para requisições HTTP
│   ├── types.ts            # Definições de tipos TypeScript
│   └── utils.ts            # Utilitários gerais
```

### UI Components
```
webview-ui/src/components/settings/
└── ApiOptions.tsx          # Interface de configuração do Flow
```

## Autenticação e Headers

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

### Parâmetros Obrigatórios

1. **Flow Base URL** (`flowBaseUrl`)
   - URL base da API Flow
   - Ex: `https://flow.ciandt.com`

2. **Flow Tenant** (`flowTenant`)
   - Identificador do tenant
   - Ex: `cit`

3. **Flow Client ID** (`flowClientId`)
   - ID do cliente para autenticação

4. **Flow Client Secret** (`flowClientSecret`)
   - Chave secreta para autenticação

### Parâmetros Opcionais

1. **Flow Auth Base URL** (`flowAuthBaseUrl`)
   - URL da API de autenticação
   - Default: valor de `flowBaseUrl`

2. **Flow App to Access** (`flowAppToAccess`)
   - Aplicação a ser acessada
   - Default: `llm-api`

3. **Flow Agent** (`flowAgent`)
   - Identificador do agente
   - Default: `chat`

4. **Flow Model ID** (`apiModelId`)
   - ID do modelo específico
   - Ex: `gpt-4o-mini`, `anthropic.claude-3-sonnet`

5. **Model Temperature** (`modelTemperature`)
   - Default: `0.7`

6. **Model Max Tokens** (`modelMaxTokens`)
   - Limite de tokens na resposta

7. **Flow Request Timeout** (`flowRequestTimeout`)
   - Timeout em ms
   - Default: `30000`

## Streaming

Para habilitar streaming de respostas, adicione o parâmetro `stream: true` nos payloads. Cada provider suporta streaming de maneira diferente:

### Azure OpenAI
```json
{
    "stream": true,
    "messages": [...]
}
```

### Google Gemini
```json
{
    "stream": true,
    "contents": [...]
}
```

### Amazon Bedrock
```json
{
    "stream": true,
    "messages": [...]
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

2. **Rate Limiting**
   - Implementar backoff exponencial
   - Respeitar limites por minuto
   - Implementar circuit breaker

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

### Capabilities por Provider

#### Azure OpenAI
Modelos disponíveis:
- `gpt-4o` - Contexto: 128000 tokens, Capacidades: streaming, system-instruction, chat-conversation, image-recognition
- `gpt-4o-mini` - Contexto: 128000 tokens, Capacidades: streaming, system-instruction, chat-conversation, image-recognition
- `o3-mini` - Contexto: 200000 tokens, Capacidades: streaming, system-instruction, chat-conversation
- `gpt-4` - Capacidades: system-instruction, chat-conversation, streaming
- `text-embedding-3-small` - Capacidades: embeddings
- `text-embedding-ada-002` - Capacidades: embeddings

#### Google Gemini
Modelos disponíveis:
- `gemini-2.0-flash` - Contexto: 8192 tokens, Capacidades: streaming, chat-conversation, image-recognition, system-instruction
- `gemini-2.5-pro` - Contexto: 1048576 tokens, Capacidades: streaming, chat-conversation, image-recognition, system-instruction

#### Amazon Bedrock
Modelos disponíveis:
- `anthropic.claude-3-sonnet` - Contexto: 200000 tokens, Capacidades: chat-conversation, image-recognition, streaming
- `anthropic.claude-37-sonnet` - Contexto: 200000 tokens, Capacidades: chat-conversation, image-recognition, streaming
- `meta.llama3-70b-instruct` - Contexto: 200000 tokens, Capacidades: chat-conversation, image-recognition, streaming
- `amazon.nova-lite` - Contexto: 300000 tokens, Capacidades: chat-conversation, image-recognition, streaming
- `amazon.nova-micro` - Contexto: 128000 tokens, Capacidades: chat-conversation, streaming
- `amazon.nova-pro` - Contexto: 300000 tokens, Capacidades: chat-conversation, image-recognition, streaming

#### Azure Foundry
Modelos disponíveis:
- `DeepSeek-R1` - Capacidades: chat-conversation

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

## Debug e Desenvolvimento

### Azure Foundry (DeepSeek-R1)

O DeepSeek-R1 requer um formato de prompt específico:
```json
{
    "content": "You are an AI programming assistant... \n### Instruction:\nYou are a helpful assistant.\nWhat is the capital city of Brazil?\n### Response:\n",
    "role": "user"
}
```

A resposta incluirá um elemento `<think>\n\n</think>` que é parte do processamento interno do modelo e pode ser ignorado na exibição para o usuário.

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