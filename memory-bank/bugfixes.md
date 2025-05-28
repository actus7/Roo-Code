# Bug Fixes: Flow Provider

## FlowModelSelector Model Selection Persistence Issue

### Problem Description
**Date**: Tue May 27 2025
**Issue**: Usuário selecionava modelo "anthropic.claude-37-sonnet" na configuração do Flow Provider, salvava, mas ao reabrir a configuração estava selecionado um modelo diferente.

### Root Cause Analysis
1. **Validação Automática Sobrescrevendo Seleção**: A função `validateAndApplyModelSelection` estava sendo executada múltiplas vezes e sobrescrevendo seleções válidas do usuário
2. **Mapeamento Incorreto**: Sistema estava detectando modelos válidos como inválidos e aplicando mapeamentos automáticos desnecessários
3. **Conflito de IDs**: Lógica de validação não diferenciava entre seleções automáticas e seleções manuais do usuário
4. **Provider Flow Não Reconhecido**: O hook `useSelectedModel` não tinha um case específico para o provider "flow", fazendo com que caísse no default que usa `anthropicDefaultModelId` ("claude-sonnet-4-20250514")

### Solution Implemented

#### Changes Made to `FlowModelSelector.tsx`:

1. **Added User Selection Tracking**:
   ```typescript
   const [isUserSelection, setIsUserSelection] = useState(false)
   ```

2. **Improved Validation Logic**:
   - Moved model existence check to the beginning
   - Only apply automatic mappings when model is actually invalid AND not a user selection
   - Respect user selections even if model is not in current list

3. **Enhanced Model Change Handler**:
   ```typescript
   const handleModelChange = (event: any) => {
     const selectedValue = event.target.value
     setIsUserSelection(true)  // Mark as user selection
     onModelChange(selectedValue)
     setIsModelValidated(true)
   }
   ```

4. **Fixed Validation Priority**:
   - First: Check if model exists in available models
   - Second: Only apply mappings for invalid models if not user selection
   - Third: Respect user choice even for unknown models

#### Changes Made to `useSelectedModel.ts`:

5. **Added Flow Provider Case**:
   ```typescript
   case "flow": {
     const id = apiConfiguration.apiModelId || "anthropic.claude-37-sonnet"
     // Return basic model info since Flow manages its own model metadata
     const info: ModelInfo = { /* ... */ }
     return { id, info }
   }
   ```

### Key Improvements

#### Before Fix:
- Sistema sobrescrevia seleções válidas do usuário
- Mapeamentos automáticos aconteciam mesmo para modelos válidos
- Validação executava desnecessariamente múltiplas vezes

#### After Fix:
- ✅ Seleções manuais do usuário são respeitadas
- ✅ Mapeamentos automáticos só acontecem quando necessário
- ✅ Validação otimizada para evitar loops desnecessários
- ✅ Logs mais claros para debug

### Testing Recommendations
1. **Teste de Persistência**: Selecionar modelo, salvar, reabrir configuração
2. **Teste de Modelos Válidos**: Verificar que modelos válidos não são alterados
3. **Teste de Mapeamento**: Verificar que modelos inválidos ainda são mapeados corretamente
4. **Teste de Cache**: Verificar comportamento com cache de modelos

### Files Modified
- `webview-ui/src/components/settings/providers/FlowModelSelector.tsx`
- `webview-ui/src/components/ui/hooks/useSelectedModel.ts`

### Impact
- **User Experience**: Configuração de modelo agora persiste corretamente
- **System Reliability**: Redução de validações desnecessárias
- **Debug Capability**: Logs mais informativos para troubleshooting

### Prevention Measures
- Added user selection tracking to differentiate between automatic and manual selections
- Improved validation logic to prioritize user choices
- Enhanced logging for better debugging of model selection issues

## Flow API Service Unavailable Issue

### Problem Description
**Date**: Tue May 27 2025
**Issue**: Usuário recebe erro "Flow chat completion: Service unavailable" ao tentar usar qualquer modelo Flow, mesmo com API funcionando corretamente.

### API Flow Analysis
**Teste da API Flow realizado com sucesso**:
- ✅ **Autenticação**: Funcionando corretamente
- ✅ **Azure OpenAI**: gpt-4, o3-mini, embeddings funcionando
- ✅ **Google Gemini**: gemini-2.5-pro funcionando
- ✅ **Amazon Bedrock**: claude-3-sonnet, claude-37-sonnet funcionando
- ✅ **Azure Foundry**: DeepSeek-R1 funcionando

### Flow API Endpoints e Formatos
**Autenticação**:
```
POST /auth-engine-api/v1/api-key/token
Headers: FlowTenant, Content-Type: application/json
Body: {"clientId":"...", "clientSecret":"...", "appToAccess":"llm-api"}
```

**Azure OpenAI**:
```
POST /ai-orchestration-api/v1/openai/chat/completions
Headers: Authorization: Bearer {token}, FlowTenant, FlowAgent
Body: {"messages": [...], "allowedModels": ["gpt-4"]}
```

**Google Gemini**:
```
POST /ai-orchestration-api/v1/google/generateContent
Body: {"allowedModels": ["gemini-2.5-pro"], "contents": [...]}
```

**Amazon Bedrock**:
```
POST /ai-orchestration-api/v1/bedrock/invoke
Body: {"allowedModels": ["anthropic.claude-37-sonnet"], "max_tokens": 8192, "anthropic_version": "bedrock-2023-05-31", "messages": [...], "system": "..."}
```

**Azure Foundry**:
```
POST /ai-orchestration-api/v1/foundry/chat/completions
Body: {"model": "DeepSeek-R1", "messages": [...]}
```

### Root Cause Hypothesis
O problema está na implementação do FlowHandler no Roo Code, não na API Flow. Possíveis causas:
1. **FlowHandler não implementado**: Provider Flow pode não estar completamente implementado
2. **Formato de requisição incorreto**: Diferenças entre formato esperado e enviado
3. **Headers ausentes**: FlowTenant, FlowAgent ou outros headers necessários
4. **Autenticação não funcionando**: Token não sendo obtido ou enviado corretamente
5. **Mapeamento de modelos**: IDs de modelos não sendo mapeados corretamente para endpoints

### Investigation Results
**✅ API Flow funcionando**: Teste direto da API Flow com Node.js funcionou perfeitamente
**✅ Configuração correta**: Simulação da configuração do VSCode passou em todos os testes
**✅ FlowHandler registrado**: Provider "flow" está registrado corretamente no buildApiHandler
**✅ Endpoints corretos**: Mapeamento de modelos e endpoints está correto

### Possible Root Causes Identified
1. **Implementação duplicada**: Existem duas implementações do FlowHandler:
   - `src/api/providers/flow.ts` (principal, usa TokenManager) ✅ **ESTA É A USADA**
   - `Provider Flow/flow.ts` (alternativa, usa autenticação interna) ❌ **NÃO USADA**
2. **Conflito de tipos**: Diferenças nos tipos AuthResponse entre implementações ✅ **CORRIGIDO**
3. **Debug não ativado**: Logs de debug não estão sendo exibidos no VSCode ✅ **ADICIONADO**
4. **Erro de runtime**: Possível erro durante inicialização que não está sendo capturado ✅ **INVESTIGANDO**

### Debugging Actions Taken
1. **✅ Confirmed correct implementation**: Sistema usa `src/api/providers/flow.ts`
2. **✅ Fixed type compatibility**: Corrigido conflito AuthResponse na implementação alternativa
3. **✅ Added debug logging**: Adicionados console.log detalhados no FlowHandler
4. **✅ Enhanced error handling**: Melhorado tratamento de erros com logs específicos

### Root Cause Found and Fixed! 🎯

**Problem Identified from Logs:**
```
"Invalid JSON payload received. Unknown name \"stream\": Cannot find field."
```

**Real Issue**: Google Gemini API não aceita o campo `stream` no payload JSON. O erro "Service unavailable" era apenas o resultado final - o problema real era um payload inválido.

### Solution Implemented ✅

#### **1. Fixed Google Gemini Payload**
- **Removed**: Campo `stream` do payload do Google Gemini
- **Reason**: Google Gemini API não suporta este campo no JSON payload
- **Note**: Streaming é controlado via HTTP headers, não payload

#### **2. Updated Type Definitions**
- **Modified**: `GeminiPayload` interface para remover campo `stream`
- **Added**: Comentários explicativos sobre streaming no Gemini

#### **3. Enhanced Error Handling**
- **Improved**: Debug logging para futuras investigações
- **Maintained**: Logs estruturados para troubleshooting

### Files Modified ✅
- `src/api/providers/flow/payload-generator.ts` - Removido campo stream do Gemini
- `src/api/providers/flow/types.ts` - Atualizado interface GeminiPayload
- `src/api/providers/flow.ts` - Melhorado debug logging

### Result 🎉
**O Flow Provider agora deve funcionar corretamente com modelos Google Gemini!**

### Test Instructions
1. **Recompile** o projeto se necessário
2. **Teste** o Flow Provider com modelo Gemini (gemini-2.5-pro)
3. **Verifique** se não há mais erro "Service unavailable"
4. **Confirme** que o streaming funciona corretamente
