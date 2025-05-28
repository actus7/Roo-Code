# Sistema de Validação Runtime com Zod

Este documento descreve o sistema de validação runtime implementado no projeto usando Zod para garantir que todos os inputs sejam sanitizados e validados antes do processamento.

## Visão Geral

O sistema de validação foi implementado para:
- ✅ Validar todas as entradas de dados antes do processamento
- ✅ Sanitizar inputs para prevenir ataques de segurança
- ✅ Fornecer mensagens de erro claras e úteis
- ✅ Garantir type safety em runtime
- ✅ Centralizar regras de validação

## Estrutura do Sistema

### Arquivos Principais

```
src/shared/validation/
├── schemas.ts           # Schemas básicos de validação
├── validator.ts         # Pipeline de validação centralizado
├── webview-schemas.ts   # Schemas específicos para mensagens webview
└── index.ts            # Exports centralizados

src/integrations/terminal/
└── command-validator.ts # Validação específica para comandos

webview-ui/src/utils/
└── input-validation.ts  # Validação para inputs do frontend
```

## Como Usar

### 1. Validação Básica

```typescript
import { ValidationPipeline, chatInputSchema } from "@/shared/validation"

// Validar input de chat
const result = ValidationPipeline.validate(chatInputSchema, userInput)

if (result.success) {
  // Input válido, usar result.data
  processInput(result.data)
} else {
  // Input inválido, mostrar erros
  console.error("Validation errors:", result.errors)
}
```

### 2. Validação de Comandos de Terminal

```typescript
import { TerminalCommandValidator } from "@/integrations/terminal/command-validator"

// Validação básica
const basicResult = TerminalCommandValidator.validateBasic(command)

// Validação com segurança
const secureResult = TerminalCommandValidator.validateSecure(command)

// Validação avançada com comandos permitidos
const advancedResult = TerminalCommandValidator.validateAdvanced(
  command, 
  allowedCommands
)
```

### 3. Validação no Frontend

```typescript
import { InputValidator } from "@/utils/input-validation"

// Validar input de chat
const chatValidation = InputValidator.validateChatInput(input)
if (!chatValidation.isValid) {
  setError(chatValidation.error)
  return
}

// Validar configuração de API
const apiValidation = InputValidator.validateApiConfig(config)
if (!apiValidation.isValid) {
  setErrors(apiValidation.errors)
  return
}
```

### 4. Validação de Mensagens Webview

```typescript
import { ValidationPipeline, webviewMessageBaseSchema } from "@/shared/validation"

// No webviewMessageHandler
const validation = ValidationPipeline.validate(
  webviewMessageBaseSchema, 
  message,
  { context: 'webview_message_handler' }
)

if (!validation.success) {
  console.error("Invalid message:", validation.errors)
  return
}
```

## Schemas Disponíveis

### Schemas Básicos

- `nonEmptyStringSchema` - String não vazia
- `urlSchema` - URL válida
- `emailSchema` - Email válido
- `filePathSchema` - Caminho de arquivo seguro
- `commandSchema` - Comando de terminal básico
- `chatInputSchema` - Input de chat
- `searchQuerySchema` - Query de busca

### Schemas de Configuração

- `apiConfigValidationSchema` - Configuração de API
- `terminalConfigValidationSchema` - Configuração de terminal
- `browserConfigValidationSchema` - Configuração de browser
- `audioConfigValidationSchema` - Configuração de áudio

### Schemas de Mensagens Webview

- `newTaskMessageSchema` - Nova tarefa
- `terminalOperationMessageSchema` - Operação de terminal
- `searchFilesMessageSchema` - Busca de arquivos
- `allowedCommandsMessageSchema` - Comandos permitidos

## Recursos de Segurança

### Validação de Comandos

O sistema bloqueia comandos perigosos como:
- `rm -rf /` - Exclusão recursiva
- `format c:` - Formatação de disco
- `$(...)` - Command substitution
- `` `...` `` - Backtick execution
- Scripts maliciosos

### Sanitização de Inputs

- Remove caracteres HTML perigosos (`<`, `>`)
- Bloqueia JavaScript injection (`javascript:`)
- Remove event handlers (`onclick=`, etc.)
- Limpa null bytes (`\0`)

### Validação de Caminhos

- Previne directory traversal (`../`)
- Bloqueia acesso a diretórios do sistema
- Valida comprimento e caracteres permitidos

## Tratamento de Erros

### Estrutura de Erro

```typescript
interface ValidationError {
  field: string      // Campo que falhou
  message: string    // Mensagem de erro
  code: string       // Código do erro
  value?: any        // Valor que causou o erro (opcional)
}
```

### Exemplo de Uso

```typescript
const result = ValidationPipeline.validate(schema, data)

if (!result.success) {
  result.errors?.forEach(error => {
    console.error(`${error.field}: ${error.message}`)
  })
}
```

## Configuração e Customização

### Criando Novos Schemas

```typescript
import { z } from "zod"

const customSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  age: z.number().min(0).max(120, "Idade inválida"),
  email: z.string().email("Email inválido")
})

// Usar com ValidationPipeline
const result = ValidationPipeline.validate(customSchema, data)
```

### Validação Condicional

```typescript
const conditionalSchema = z.object({
  type: z.enum(["user", "admin"]),
  permissions: z.array(z.string()).optional()
}).refine(
  (data) => data.type !== "admin" || data.permissions,
  "Admin deve ter permissões definidas"
)
```

## Melhores Práticas

### 1. Sempre Validar Inputs Externos

```typescript
// ❌ Não fazer
function processUserInput(input: string) {
  // Usar input diretamente sem validação
  return input.toUpperCase()
}

// ✅ Fazer
function processUserInput(input: string) {
  const validation = ValidationPipeline.validate(inputSchema, input)
  if (!validation.success) {
    throw new Error("Input inválido")
  }
  return validation.data.toUpperCase()
}
```

### 2. Usar Schemas Específicos

```typescript
// ❌ Schema muito genérico
const genericSchema = z.object({
  data: z.any()
})

// ✅ Schema específico
const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(0).max(120)
})
```

### 3. Fornecer Mensagens de Erro Claras

```typescript
const schema = z.object({
  password: z.string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos um número")
})
```

## Integração com Componentes

### React Components

```typescript
import { useState } from "react"
import { InputValidator } from "@/utils/input-validation"

function ChatInput() {
  const [error, setError] = useState<string | null>(null)
  
  const handleSubmit = (input: string) => {
    const validation = InputValidator.validateChatInput(input)
    
    if (!validation.isValid) {
      setError(validation.error)
      return
    }
    
    setError(null)
    // Processar input válido
    submitMessage(input)
  }
  
  return (
    <div>
      {error && <div className="error">{error}</div>}
      {/* Input component */}
    </div>
  )
}
```

## Performance

- Validação é executada de forma síncrona
- Schemas são compilados uma vez e reutilizados
- Cache de validação pode ser implementado para casos específicos
- Validação assíncrona disponível quando necessário

## Testes

```typescript
import { ValidationPipeline, chatInputSchema } from "@/shared/validation"

describe("Chat Input Validation", () => {
  it("should validate correct input", () => {
    const result = ValidationPipeline.validate(chatInputSchema, "Hello world")
    expect(result.success).toBe(true)
  })
  
  it("should reject empty input", () => {
    const result = ValidationPipeline.validate(chatInputSchema, "")
    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.message).toContain("não pode estar vazio")
  })
})
```
