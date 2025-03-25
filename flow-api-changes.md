# Plano de Implementação: Melhorias no FlowHandler

## Objetivo
Melhorar a implementação do FlowHandler para lidar com a listagem de modelos de diferentes provedores de forma mais eficiente e dinâmica.

## Alterações Propostas

### 1. Modificar a função `getAvailableModels()`

Atualizar a função para buscar modelos de diferentes provedores:

```typescript
public async getAvailableModels(): Promise<Record<string, ModelInfo>> {
  if (!this.token) {
    await this.authenticate()
  }

  try {
    const providers = ['azure-openai', 'amazon-bedrock']
    this.availableModels = {}

    for (const provider of providers) {
      const providerModels = await this.getProviderModels(provider)
      this.availableModels = { ...this.availableModels, ...providerModels }
    }

    return this.availableModels
  } catch (error) {
    console.error("Error fetching available models:", error)
    // Fallback para modelos estáticos em caso de erro
    return flowModels
  }
}
```

### 2. Adicionar nova função `getProviderModels()`

Implementar uma nova função para buscar modelos de um provedor específico:

```typescript
private async getProviderModels(provider: string): Promise<Record<string, ModelInfo>> {
  try {
    const response = await this.axiosInstance.get(`${API_PATH}/models/${provider}?capabilities=system-instruction,chat-conversation`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        flowTenant: this.options.flowTenant || "edge",
      },
    })

    return response.data.reduce((acc: Record<string, ModelInfo>, model: FlowModel) => {
      acc[model.id] = {
        maxTokens: model.maxTokens || 4096,
        contextWindow: model.contextWindow || 128000,
        supportsImages: model.supportsImages || false,
        supportsComputerUse: model.supportsComputerUse || false,
        supportsPromptCache: false,
        description: model.description || `${provider} model ${model.id}`,
      }
      return acc
    }, {})
  } catch (error) {
    console.error(`Error fetching models for provider ${provider}:`, error)
    return {}
  }
}
```

### 3. Atualizar a função `getModel()`

Manter a lógica existente, mas priorizar os modelos dinâmicos:

```typescript
override getModel(): { id: string; info: ModelInfo } {
  const modelId = this.options.apiModelId
  
  // Se temos modelos dinâmicos disponíveis
  if (Object.keys(this.availableModels).length > 0) {
    if (modelId && modelId in this.availableModels) {
      return { id: modelId, info: this.availableModels[modelId] }
    }
    // Retorna o primeiro modelo disponível como padrão
    const firstModelId = Object.keys(this.availableModels)[0]
    return { id: firstModelId, info: this.availableModels[firstModelId] }
  }
  
  // Fallback para modelos estáticos
  if (modelId && modelId in flowModels) {
    return { id: modelId, info: flowModels[modelId] }
  }
  return { id: flowDefaultModelId, info: flowModels[flowDefaultModelId] }
}
```

## Passos de Implementação

1. Abra o arquivo `src/api/providers/flow.ts`.
2. Localize a função `getAvailableModels()` e substitua seu conteúdo pelo novo código proposto.
3. Adicione a nova função `getProviderModels()` após a função `getAvailableModels()`.
4. Localize a função `getModel()` e atualize seu conteúdo conforme proposto.
5. Certifique-se de que todas as importações necessárias estão presentes no topo do arquivo.
6. Teste as alterações para garantir que a listagem de modelos funcione corretamente para diferentes provedores.

## Considerações Adicionais

- Essa implementação assume que a API do Flow suporta endpoints específicos para cada provedor (`/models/azure-openai` e `/models/amazon-bedrock`). Verifique se esses endpoints estão disponíveis e funcionando conforme esperado.
- Considere adicionar tratamento de erros mais robusto e logging para facilitar a depuração em caso de problemas.
- Avalie a necessidade de adicionar mais provedores à lista `providers` na função `getAvailableModels()` conforme necessário.

## Próximos Passos

Após implementar essas alterações:

1. Revise o código cuidadosamente para garantir que não há erros de sintaxe ou lógica.
2. Execute testes unitários e de integração para verificar se a funcionalidade está correta.
3. Teste a extensão em diferentes cenários para garantir que a listagem de modelos funcione conforme esperado.
4. Atualize a documentação relevante para refletir as novas capacidades de listagem dinâmica de modelos.

## Resumo e Conclusão

As alterações propostas neste plano visam melhorar significativamente a flexibilidade e eficiência do FlowHandler na listagem e gerenciamento de modelos de diferentes provedores. As principais melhorias incluem:

1. Listagem dinâmica de modelos de múltiplos provedores (Azure OpenAI e Amazon Bedrock).
2. Melhor organização do código com a adição de uma função específica para buscar modelos de cada provedor.
3. Priorização de modelos dinâmicos sobre modelos estáticos predefinidos.
4. Maior robustez com tratamento de erros e fallback para modelos estáticos quando necessário.

Essas mudanças permitirão que a extensão se adapte mais facilmente a novos modelos e provedores conforme eles se tornam disponíveis, sem a necessidade de atualizações frequentes no código para adicionar modelos estáticos. Além disso, a implementação proposta melhora a manutenibilidade do código e facilita futuras expansões para suportar outros provedores de modelos de linguagem.

A implementação bem-sucedida dessas alterações resultará em uma experiência mais dinâmica e atualizada para os usuários da extensão, garantindo que eles sempre tenham acesso aos modelos mais recentes disponíveis em cada provedor suportado.
