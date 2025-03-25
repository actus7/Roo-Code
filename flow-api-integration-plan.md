# Plano de Integração com a API Flow

## Objetivo
Corrigir o erro 409 (Conflict) e melhorar a integração com a API Flow, alinhando nossa implementação com o exemplo fornecido.

## Ações Necessárias

### 1. Ajuste de Endpoints
- Implementar lógica para selecionar o endpoint correto com base no tipo de modelo:
  - OpenAI: `/ai-orchestration-api/v1/openai/chat/completions`
  - Gemini: `/ai-orchestration-api/v1/google/generateContent`
  - Claude (Bedrock): `/ai-orchestration-api/v1/bedrock/invoke`

### 2. Estrutura do Payload
- Modificar a função `createMessage` para gerar payloads específicos para cada tipo de modelo:
  - OpenAI:
    ```json
    {
      "stream": false,
      "messages": [...],
      "max_tokens": 4096,
      "model": "gpt-4o-mini"
    }
    ```
  - Gemini:
    ```json
    {
      "contents": [...],
      "model": "gemini-1.5-flash"
    }
    ```
  - Claude:
    ```json
    {
      "messages": [...],
      "anthropic_version": "bedrock-2023-05-31",
      "max_tokens": 131072,
      "allowedModels": ["anthropic.claude-37-sonnet"]
    }
    ```

### 3. Headers
- Garantir que todos os headers necessários estejam sendo enviados:
  ```typescript
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
    "flowAgent": "chat",
    "flowTenant": this.options.flowTenant
  }
  ```

### 4. Autenticação
- Revisar o processo de autenticação para garantir que esteja gerando e usando o token corretamente.
- Implementar uma função de renovação de token, se necessário.

### 5. Seleção de Modelo
- Implementar lógica para selecionar o modelo correto com base no tipo de requisição e nas preferências do usuário.
- Atualizar a função `getModel` para retornar o modelo apropriado.

## Próximos Passos
1. Implementar as mudanças no arquivo `src/api/providers/flow.ts`.
2. Testar cada tipo de modelo separadamente para garantir que estão funcionando corretamente.
3. Implementar tratamento de erros mais robusto, incluindo tentativas de novas requisições em caso de falhas específicas.
4. Atualizar a documentação do código para refletir as novas mudanças.
5. Realizar testes de integração para garantir que todas as funcionalidades estão operando como esperado.