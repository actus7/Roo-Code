# Guia de Implementação para Integração com a API Flow

## Arquivo a ser modificado: src/api/providers/flow.ts

### 1. Ajuste de Endpoints

Modifique a função `createMessage` para selecionar o endpoint correto:

```typescript
const getEndpoint = (modelId: string): string => {
  if (modelId.startsWith('gpt-')) {
    return '/ai-orchestration-api/v1/openai/chat/completions';
  } else if (modelId.startsWith('gemini-')) {
    return '/ai-orchestration-api/v1/google/generateContent';
  } else if (modelId.startsWith('anthropic.claude-')) {
    return '/ai-orchestration-api/v1/bedrock/invoke';
  }
  throw new Error(`Unsupported model: ${modelId}`);
};

// Uso:
const endpoint = getEndpoint(modelId);
```

### 2. Estrutura do Payload

Implemente uma função para gerar o payload correto com base no modelo:

```typescript
const generatePayload = (modelId: string, messages: any[], options: any): any => {
  if (modelId.startsWith('gpt-')) {
    return {
      stream: options.stream || false,
      messages,
      max_tokens: options.max_tokens || 4096,
      model: modelId
    };
  } else if (modelId.startsWith('gemini-')) {
    return {
      contents: messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      })),
      model: modelId
    };
  } else if (modelId.startsWith('anthropic.claude-')) {
    return {
      messages,
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: options.max_tokens || 131072,
      allowedModels: [modelId]
    };
  }
  throw new Error(`Unsupported model: ${modelId}`);
};

// Uso:
const payload = generatePayload(modelId, messages, this.options);
```

### 3. Headers

Atualize a configuração de headers:

```typescript
const requestConfig = {
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${await this.authenticate()}`,
    "flowAgent": this.options.flowAgent || "chat",
    "flowTenant": this.options.flowTenant
  },
  responseType: (payload.stream ? 'stream' : 'json') as ResponseType,
  timeout: this.options.flowRequestTimeout || 30000
};
```

### 4. Autenticação

Revise a função `authenticate` para garantir que está gerando e usando o token corretamente:

```typescript
private async authenticate(): Promise<string> {
  if (this.token && this.tokenExpirationTime && Date.now() < this.tokenExpirationTime) {
    return this.token;
  }

  try {
    const response = await axios.post(
      `${this.options.flowAuthBaseUrl || DEFAULT_BASE_URL}${AUTH_PATH}`,
      {
        clientId: this.options.flowClientId,
        clientSecret: this.options.flowClientSecret,
        appToAccess: this.options.flowAppToAccess || "llm-api",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "flowTenant": this.options.flowTenant || "edge",
        },
      }
    );

    if (!response.data.access_token) {
      throw new Error('No access token received from Flow authentication');
    }

    this.token = response.data.access_token;
    this.tokenExpirationTime = Date.now() + 55 * 60 * 1000; // 55 minutes
    return this.token;
  } catch (error) {
    console.error("[Flow] Authentication error:", error);
    throw new Error('Failed to authenticate with Flow API');
  }
}
```

### 5. Seleção de Modelo

Atualize a função `getModel` para selecionar o modelo apropriado:

```typescript
public getModel(): { id: string; info: ModelInfo } {
  const modelId = this.options.apiModelId || this.getDefaultModelId();
  const modelInfo = this.availableModels[modelId];

  if (!modelInfo) {
    throw new Error(`Model ${modelId} not found in available models`);
  }

  return { id: modelId, info: modelInfo };
}

private getDefaultModelId(): string {
  const availableModelIds = Object.keys(this.availableModels);
  if (availableModelIds.length === 0) {
    throw new Error('No models available');
  }
  
  // Prioridade: GPT > Claude > Gemini
  const gptModel = availableModelIds.find(id => id.startsWith('gpt-'));
  if (gptModel) return gptModel;

  const claudeModel = availableModelIds.find(id => id.startsWith('anthropic.claude-'));
  if (claudeModel) return claudeModel;

  const geminiModel = availableModelIds.find(id => id.startsWith('gemini-'));
  if (geminiModel) return geminiModel;

  return availableModelIds[0];
}
```

## Notas Adicionais

1. Certifique-se de importar todas as dependências necessárias no topo do arquivo.
2. Atualize os tipos e interfaces conforme necessário para refletir as mudanças na estrutura de dados.
3. Adicione tratamento de erros adequado em todas as novas funções e chamadas de API.
4. Comente o código para explicar a lógica por trás das novas implementações.
5. Após fazer essas alterações, teste extensivamente cada tipo de modelo para garantir que tudo está funcionando conforme esperado.