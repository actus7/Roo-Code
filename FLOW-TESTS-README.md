# Flow Provider Test Scripts

Este diretório contém scripts de teste para a integração com o Flow Provider. Os scripts de teste são:

1. `test-flow-api.http`: Para testes manuais usando a extensão REST Client do VS Code
2. `test-flow-api.sh`: Script bash para testar a API do Flow
3. `test-flow-chat-api.sh`: Script bash para testar a API de chat do Flow
4. `test-flow-integration.js`: Script JavaScript para testar a integração com o Flow
5. `test-flow-models-api.sh`: Script bash para testar a API de modelos do Flow
6. `test-flow-roo-integration.js`: Script JavaScript para testar a integração do Flow com o Roo Code

## Configuração

Para usar estes scripts, você precisa configurar suas credenciais do Flow. **NÃO comite credenciais reais no código**. Em vez disso, siga um dos métodos abaixo:

### Método 1: Arquivo .env (Recomendado)

1. Crie um arquivo `.env` na raiz do projeto baseado no `.env.sample`
2. Adicione suas credenciais do Flow:

```
FLOW_BASE_URL=https://flow.ciandt.com
FLOW_TENANT=seu-tenant
FLOW_CLIENT_ID=seu-client-id
FLOW_CLIENT_SECRET=seu-client-secret
FLOW_APP_TO_ACCESS=llm-api
```

Os scripts podem ser modificados para ler estas variáveis de ambiente.

### Método 2: Edição manual

Antes de executar qualquer script, substitua os placeholders pelos valores reais:

- `seu-tenant` → Seu tenant ID do Flow 
- `seu-client-id` → Seu Client ID do Flow
- `seu-client-secret` → Seu Client Secret do Flow

## Segurança

- **NUNCA comite credenciais reais no repositório**
- Use variáveis de ambiente ou arquivos .env (que estão no .gitignore) para armazenar credenciais
- Sempre verifique os arquivos antes de fazer commit para garantir que não há credenciais incluídas

## Executando os Testes

### Scripts Shell

```bash
# Execute os scripts shell
./test-flow-api.sh
./test-flow-chat-api.sh
./test-flow-models-api.sh
```

### Scripts JavaScript

```bash
# Execute os scripts JavaScript
node test-flow-integration.js
node test-flow-roo-integration.js
```

### HTTP REST Client

Para o arquivo `test-flow-api.http`, use a extensão REST Client do VS Code para enviar as requisições.
