# Flow Provider

O Flow é uma plataforma de orquestração de IA que oferece acesso unificado a múltiplos providers de LLMs através de uma API padronizada.

## Principais Características

- Acesso unificado a Azure OpenAI, Google Gemini, Amazon Bedrock e Azure Foundry
- Gerenciamento centralizado de autenticação
- Sistema de embeddings integrado
- Streaming de respostas
- Sistema de monitoramento via FlowAgent

## Configuração Necessária

| Campo | Descrição | Padrão |
|-------|-----------|---------|
| Flow Base URL | URL base da API Flow | - |
| Flow Tenant | Identificador do tenant | - |
| Flow Client ID | ID do cliente para autenticação | - |
| Flow Client Secret | Chave secreta para autenticação | - |
| Flow Auth Base URL | URL da API de autenticação | Flow Base URL |
| Flow App to Access | Aplicação a ser acessada | llm-api |
| Flow Agent | Identificador do agente | chat |
| Flow Request Timeout | Timeout em ms | 30000 |

## Modelos Suportados

### Azure OpenAI

- gpt-4o (128k contexto)
- gpt-4o-mini (128k contexto)
- o3-mini (200k contexto)
- gpt-4

### Google Gemini

- gemini-2.0-flash (8k contexto)
- gemini-2.5-pro (1M contexto)

### Amazon Bedrock

- anthropic.claude-3-sonnet (200k contexto)
- anthropic.claude-37-sonnet (200k contexto)
- meta.llama3-70b-instruct (200k contexto)
- amazon.nova-lite (300k contexto)
- amazon.nova-micro (128k contexto)
- amazon.nova-pro (300k contexto)

### Azure Foundry

- DeepSeek-R1

### Embeddings

- text-embedding-3-small
- text-embedding-ada-002

## Exemplos

### Configuração Básica

```json
{
  "flowBaseUrl": "https://flow.ciandt.com",
  "flowTenant": "cit",
  "flowClientId": "seu-client-id",
  "flowClientSecret": "seu-client-secret"
}
```

### Seleção de Modelo

```json
{
  "flowModelId": "gpt-4o-mini"
}
```

## Resolução de Problemas

1. **Token Inválido/Expirado (401)**
    - Verifique suas credenciais
    - O token será renovado automaticamente

2. **Rate Limiting (429)**
    - O sistema implementa backoff exponencial
    - Verifique seus limites de uso

3. **Erro de Conexão**
    - Verifique a URL base
    - Confirme conectividade com o servidor Flow
