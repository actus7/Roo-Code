# Testes da API do GitHub Copilot

Este documento descreve como testar a API do GitHub Copilot usando os arquivos de teste fornecidos.

## Arquivos de Teste

- `test-requests.http`: Arquivo para testar a API do GitHub Copilot usando a extensão REST Client do VS Code
- `.env.example`: Exemplo de arquivo de variáveis de ambiente para os testes
- `src/__tests__/github-copilot-auth.test.ts`: Testes automatizados para a API do GitHub Copilot
- `src/__tests__/github-copilot-auth-mock.test.ts`: Testes automatizados com mocks para a API do GitHub Copilot
- `src/utils/github-copilot-api.ts`: Classe utilitária para interagir com a API do GitHub Copilot

## Fluxo de Autenticação

O fluxo de autenticação do GitHub Copilot consiste em:

1. **Obtenção do Token**: Requisição para `https://api.github.com/copilot_internal/v2/token` usando um token de acesso pessoal do GitHub.
2. **Obtenção de Informações do Usuário**: Requisição para `https://api.github.com/user` usando o mesmo token.
3. **Comunicação com a API do Copilot**: Requisições para `https://api.individual.githubcopilot.com/chat/completions` usando o token obtido no passo 1.

## Como Usar o Arquivo test-requests.http

### Pré-requisitos

1. Instale a extensão [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) no VS Code
2. Crie um token de acesso pessoal do GitHub em https://github.com/settings/tokens
   - Permissões necessárias: `read:user`, `repo`, `user:email`

### Configuração

1. Copie o arquivo `.env.example` para `.env`
2. Edite o arquivo `.env` e substitua `seu_token_pessoal_aqui` pelo seu token de acesso pessoal do GitHub

### Execução dos Testes

1. Abra o arquivo `test-requests.http` no VS Code
2. Clique em "Send Request" acima da primeira requisição (Get Token)
3. Copie o token da resposta e atualize a variável `@authToken` no arquivo
4. Execute as demais requisições na ordem em que aparecem no arquivo

## Como Usar os Testes Automatizados

### Testes com Mocks (Recomendado)

```bash
npm test -- src/__tests__/github-copilot-auth-mock.test.ts
npm test -- src/__tests__/github-copilot-api.test.ts
```

### Testes com Requisições Reais (Requer Token Válido)

1. Edite o arquivo `src/__tests__/github-copilot-auth.test.ts` e substitua o valor da constante `GITHUB_TOKEN` por um token válido
2. Execute o teste:

```bash
npm test -- src/__tests__/github-copilot-auth.test.ts
```

## Classe Utilitária GitHubCopilotApi

A classe `GitHubCopilotApi` em `src/utils/github-copilot-api.ts` encapsula as chamadas para a API do GitHub Copilot e pode ser usada em outros projetos.

### Exemplo de Uso

```typescript
import { GitHubCopilotApi } from './utils/github-copilot-api';

// Criar instância da API
const api = new GitHubCopilotApi('seu_token_github_aqui');

// Obter token do Copilot
await api.getCopilotToken();

// Enviar requisição de chat
const response = await api.sendChatRequest({
  messages: [
    {
      role: 'system',
      content: 'You are a helpful AI programming assistant.'
    },
    {
      role: 'user',
      content: 'Olá, tudo bem?'
    }
  ],
  model: 'gpt-4o-mini',
  temperature: 0.1
});

console.log(response.choices[0].message.content);
```

## Notas de Segurança

- Não compartilhe seu token de acesso pessoal do GitHub
- Não compartilhe o token do Copilot obtido na primeira requisição
- Não faça commit de arquivos com seus tokens reais
- Use variáveis de ambiente ou um arquivo .env para armazenar seus tokens
- Adicione arquivos com tokens ao .gitignore
