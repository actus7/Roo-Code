import { z } from "zod"
import {
  nonEmptyStringSchema,
  commandSchema,
  requestIdSchema,
  filePathSchema
} from "./schemas"

/**
 * Schemas específicos para validação de mensagens do webview
 */

// Schema base para todas as mensagens
export const webviewMessageBaseSchema = z.object({
  type: nonEmptyStringSchema,
  text: z.string().optional(),
  images: z.array(z.string()).optional(),
  apiConfiguration: z.any().optional(),
  bool: z.boolean().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  values: z.record(z.any()).optional(),
  requestId: requestIdSchema.optional(),
})

// Schema para mensagens de nova tarefa
export const newTaskMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("newTask"),
  text: z.string()
    .min(1, "Texto da tarefa não pode estar vazio")
    .max(100000, "Texto da tarefa muito longo"),
  images: z.array(z.string()).optional(),
})

// Schema para operações de terminal
export const terminalOperationMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("terminalOperation"),
  terminalOperation: z.object({
    type: z.enum(["run", "kill", "clear"]),
    command: commandSchema.optional(),
    terminalId: z.string().optional(),
  }),
})

// Schema para busca de arquivos
export const searchFilesMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("searchFiles"),
  query: z.string()
    .min(1, "Query de busca não pode estar vazia")
    .max(500, "Query de busca muito longa"),
  requestId: requestIdSchema,
})

// Schema para busca de commits
export const searchCommitsMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("searchCommits"),
  query: z.string()
    .max(500, "Query de busca muito longa")
    .optional(),
})

// Schema para configurações de comandos permitidos
export const allowedCommandsMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("allowedCommands"),
  commands: z.array(z.string())
    .max(100, "Muitos comandos na lista")
    .refine(
      (commands) => commands.every(cmd => cmd.length <= 100),
      "Comando muito longo na lista"
    ),
})

// Schema para operações de arquivo
export const openFileMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("openFile"),
  text: filePathSchema,
  values: z.object({
    create: z.boolean().optional(),
    content: z.string().max(1000000, "Conteúdo muito longo").optional(),
    line: z.number().min(1, "Número da linha deve ser positivo").optional(),
  }).optional(),
})

// Schema para configurações de API
export const apiConfigurationSchema = z.object({
  apiProvider: z.string().min(1, "Provider é obrigatório"),
  apiKey: z.string().optional(),
  baseUrl: z.string().url("URL base deve ser válida").optional(),
  modelId: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(1).max(1000000).optional(),
  // Adicionar outros campos conforme necessário
}).passthrough() // Permite campos adicionais

// Schema para mensagens com configuração de API
export const apiConfigurationMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("apiConfiguration"),
  apiConfiguration: apiConfigurationSchema,
})

// Schema para configurações de áudio - separados por tipo
export const ttsEnabledMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("ttsEnabled"),
  bool: z.boolean().optional(),
})

export const ttsSpeedMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("ttsSpeed"),
  value: z.number().optional(),
})

export const soundEnabledMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("soundEnabled"),
  bool: z.boolean().optional(),
})

export const soundVolumeMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("soundVolume"),
  value: z.number().optional(),
})

// Schema unificado para compatibilidade
export const audioConfigMessageSchema = z.union([
  ttsEnabledMessageSchema,
  ttsSpeedMessageSchema,
  soundEnabledMessageSchema,
  soundVolumeMessageSchema,
])

// Schema para configurações de browser - separados por tipo
export const browserToolEnabledMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("browserToolEnabled"),
  bool: z.boolean().optional(),
})

export const browserViewportSizeMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("browserViewportSize"),
  text: z.string().optional(),
})

export const screenshotQualityMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("screenshotQuality"),
  value: z.number().optional(),
})

// Schema unificado para compatibilidade
export const browserConfigMessageSchema = z.union([
  browserToolEnabledMessageSchema,
  browserViewportSizeMessageSchema,
  screenshotQualityMessageSchema,
])

// Schema para operações de checkpoint - separados por tipo
export const checkpointDiffMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("checkpointDiff"),
  payload: z.object({
    isFirst: z.boolean(),
    from: z.string(),
    to: z.string(),
  }),
})

export const checkpointRestoreMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("checkpointRestore"),
  payload: z.object({
    isFirst: z.boolean(),
    from: z.string(),
    to: z.string(),
  }),
})

// Schema unificado para compatibilidade
export const checkpointMessageSchema = z.union([
  checkpointDiffMessageSchema,
  checkpointRestoreMessageSchema,
])

// Schema para exclusão de múltiplas tarefas
export const deleteMultipleTasksMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("deleteMultipleTasksWithIds"),
  ids: z.array(z.string())
    .min(1, "Lista de IDs não pode estar vazia")
    .max(1000, "Muitos IDs para exclusão em lote"),
})

// Schema para operações de MCP - separados por tipo
export const deleteMcpServerMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("deleteMcpServer"),
  serverName: z.string().min(1, "Nome do servidor é obrigatório").optional(),
  source: z.enum(["global", "project"]).optional(),
})

export const restartMcpServerMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("restartMcpServer"),
  serverName: z.string().min(1, "Nome do servidor é obrigatório").optional(),
  source: z.enum(["global", "project"]).optional(),
})

export const toggleToolAlwaysAllowMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("toggleToolAlwaysAllow"),
  toolName: z.string().optional(),
  alwaysAllow: z.boolean().optional(),
})

// Schema unificado para compatibilidade
export const mcpOperationMessageSchema = z.union([
  deleteMcpServerMessageSchema,
  restartMcpServerMessageSchema,
  toggleToolAlwaysAllowMessageSchema,
])

// Schema para requisições de modelos - separados por tipo
export const requestRouterModelsMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("requestRouterModels"),
  values: z.object({
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    openAiHeaders: z.record(z.string()).optional(),
    litellmApiKey: z.string().optional(),
    litellmBaseUrl: z.string().url().optional(),
  }).optional(),
})

export const requestOpenAiModelsMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("requestOpenAiModels"),
  values: z.object({
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    openAiHeaders: z.record(z.string()).optional(),
  }).optional(),
})

export const requestOllamaModelsMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("requestOllamaModels"),
  values: z.object({
    baseUrl: z.string().url().optional(),
  }).optional(),
})

export const requestLmStudioModelsMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("requestLmStudioModels"),
  values: z.object({
    baseUrl: z.string().url().optional(),
  }).optional(),
})

export const requestVsCodeLmModelsMessageSchema = webviewMessageBaseSchema.extend({
  type: z.literal("requestVsCodeLmModels"),
  values: z.object({}).optional(),
})

// Schema unificado para compatibilidade
export const modelRequestMessageSchema = z.union([
  requestRouterModelsMessageSchema,
  requestOpenAiModelsMessageSchema,
  requestOllamaModelsMessageSchema,
  requestLmStudioModelsMessageSchema,
  requestVsCodeLmModelsMessageSchema,
])

/**
 * Union type para todos os schemas de mensagem
 */
export const webviewMessageSchema = z.discriminatedUnion("type", [
  newTaskMessageSchema,
  terminalOperationMessageSchema,
  searchFilesMessageSchema,
  searchCommitsMessageSchema,
  allowedCommandsMessageSchema,
  openFileMessageSchema,
  apiConfigurationMessageSchema,
  // Audio schemas individuais
  ttsEnabledMessageSchema,
  ttsSpeedMessageSchema,
  soundEnabledMessageSchema,
  soundVolumeMessageSchema,
  // Browser schemas individuais
  browserToolEnabledMessageSchema,
  browserViewportSizeMessageSchema,
  screenshotQualityMessageSchema,
  // Checkpoint schemas individuais
  checkpointDiffMessageSchema,
  checkpointRestoreMessageSchema,
  deleteMultipleTasksMessageSchema,
  // MCP schemas individuais
  deleteMcpServerMessageSchema,
  restartMcpServerMessageSchema,
  toggleToolAlwaysAllowMessageSchema,
  // Model request schemas individuais
  requestRouterModelsMessageSchema,
  requestOpenAiModelsMessageSchema,
  requestOllamaModelsMessageSchema,
  requestLmStudioModelsMessageSchema,
  requestVsCodeLmModelsMessageSchema,
])

// Tipos inferidos
export type WebviewMessageBase = z.infer<typeof webviewMessageBaseSchema>
export type NewTaskMessage = z.infer<typeof newTaskMessageSchema>
export type TerminalOperationMessage = z.infer<typeof terminalOperationMessageSchema>
export type SearchFilesMessage = z.infer<typeof searchFilesMessageSchema>
export type SearchCommitsMessage = z.infer<typeof searchCommitsMessageSchema>
export type AllowedCommandsMessage = z.infer<typeof allowedCommandsMessageSchema>
export type OpenFileMessage = z.infer<typeof openFileMessageSchema>
export type ApiConfigurationMessage = z.infer<typeof apiConfigurationMessageSchema>
export type AudioConfigMessage = z.infer<typeof audioConfigMessageSchema>
export type BrowserConfigMessage = z.infer<typeof browserConfigMessageSchema>
export type CheckpointMessage = z.infer<typeof checkpointMessageSchema>
export type DeleteMultipleTasksMessage = z.infer<typeof deleteMultipleTasksMessageSchema>
export type McpOperationMessage = z.infer<typeof mcpOperationMessageSchema>
export type ModelRequestMessage = z.infer<typeof modelRequestMessageSchema>
export type ValidatedWebviewMessage = z.infer<typeof webviewMessageSchema>
